import { DATE_FORMATS, parseDateRange, parseYearMonth, type DateFormat } from "./dates";

/**
 * Upgrades stored resume content to the current version. Runs inside
 * ResumeContentSchema (z.preprocess), so every read path gets current data;
 * the next save writes the upgraded shape back.
 */

type LegacyContact = { id: string; text: string; url?: string };
export type HeaderContactFields = {
  email: string;
  phone: string;
  location: string;
  links: { id: string; text: string; url: string }[];
};

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const looksLikePhone = (s: string) => /^\+?[\d\s().-]{7,}$/.test(s) && /\d{3}/.test(s);

/**
 * Sorts free-form contact items into the header's fields: anything with a URL
 * is a link; otherwise the first email-, phone- and remaining plain-text item
 * become email, phone and location. Leftovers become links without a URL.
 */
export function classifyContacts(items: LegacyContact[]): HeaderContactFields {
  const out: HeaderContactFields = { email: "", phone: "", location: "", links: [] };
  for (const { id, text, url } of items) {
    const t = text.trim();
    if (!t) continue;
    if (url) out.links.push({ id, text: t, url });
    else if (!out.email && looksLikeEmail(t)) out.email = t;
    else if (!out.phone && looksLikePhone(t)) out.phone = t;
    else if (!out.location) out.location = t;
    else out.links.push({ id, text: t, url: "" });
  }
  return out;
}

export function migrateContent(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  let data = input as Record<string, unknown>;

  // v1 → v2: header.contacts[] split into email / phone / location / links.
  if (data.version === 1) {
    const header = (data.header ?? {}) as { name?: string; contacts?: LegacyContact[] };
    data = {
      ...data,
      version: 2,
      header: { name: header.name ?? "", ...classifyContacts(header.contacts ?? []) },
    };
  }

  // v2 → v3: free-text dates become { year, month } / "present", plus a
  // resume-wide date format inferred from how the dates were written.
  if (data.version === 2) {
    type Range = { start: string; end: string };
    type Sec = { type: string; entries?: { dates: Range }[]; schools?: { degrees: { dates: Range }[] }[]; papers?: { date: string }[] };
    const sections = structuredClone((data.sections ?? []) as Sec[]);
    const texts: string[] = [];
    for (const s of sections) {
      for (const e of s.entries ?? []) {
        texts.push(e.dates.start, e.dates.end);
        (e as { dates: unknown }).dates = parseDateRange(e.dates.start, e.dates.end);
      }
      for (const school of s.schools ?? [])
        for (const d of school.degrees) {
          texts.push(d.dates.start, d.dates.end);
          (d as { dates: unknown }).dates = parseDateRange(d.dates.start, d.dates.end);
        }
      for (const p of s.papers ?? []) {
        texts.push(p.date);
        (p as { date: unknown }).date = parseYearMonth(p.date);
      }
    }
    data = { ...data, version: 3, settings: { dateFormat: inferDateFormat(texts) }, sections };
  }

  // v3 → v4: library source tracking. Existing items weren't copied from the
  // library, so every source field starts as null.
  if (data.version === 3) {
    type Item = Record<string, unknown> & { bullets?: Record<string, unknown>[] };
    type Sec = Record<string, unknown> & { entries?: Item[]; papers?: Item[]; schools?: Item[]; rows?: Item[] };
    const noItemSource = { sourceItemId: null, sourceItemUpdatedAt: null };
    const noBulletSource = { sourceBulletId: null, sourceVariantId: null };
    const sections = structuredClone((data.sections ?? []) as Sec[]).map((s) => {
      const withSource = (items?: Item[]) =>
        items?.map((item) => ({
          ...item,
          ...noItemSource,
          ...(item.bullets && { bullets: item.bullets.map((b) => ({ ...b, ...noBulletSource })) }),
        }));
      const out: Sec = { ...s };
      if (s.type === "summary") Object.assign(out, noItemSource);
      if (s.entries) out.entries = withSource(s.entries);
      if (s.papers) out.papers = withSource(s.papers);
      if (s.schools) out.schools = withSource(s.schools);
      if (s.rows) out.rows = withSource(s.rows);
      return out;
    });
    data = { ...data, version: 4, sections };
  }
  return data;
}

/** Picks the format most of the existing date strings were written in. */
function inferDateFormat(texts: string[]): DateFormat {
  const votes: Record<DateFormat, number> = { long: 0, short: 0, numeric: 0, year: 0 };
  for (const raw of texts) {
    const t = raw.trim();
    if (/^[A-Za-z]{4,},?\s+\d{4}$/.test(t) && !/^sept/i.test(t)) votes.long++;
    else if (/^[A-Za-z]{3,4}\.?\s+\d{4}$/.test(t)) votes.short++;
    else if (/^\d{1,2}\/\d{4}$/.test(t)) votes.numeric++;
    else if (/^\d{4}$/.test(t)) votes.year++;
  }
  return DATE_FORMATS.reduce((best, f) => (votes[f] > votes[best] ? f : best), "long" as DateFormat);
}
