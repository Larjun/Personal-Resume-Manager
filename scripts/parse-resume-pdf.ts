/**
 * Parses a resume PDF laid out like seed/resume.pdf into ResumeContent.
 *
 * Extraction (pdfjs) produces positioned lines; `parseLines` is a pure,
 * heuristic classifier for this specific template:
 *   - all-caps line at the left margin            → section heading
 *   - line starting with "●"                      → bullet (indented follow-up lines are wrapped continuations)
 *   - line starting with "➔"                      → education degree (dates on the right)
 *   - left-margin line in an entries section      → entry header "Title | Org" / "Location | Dates"
 *   - "Category: a, b, c" in a skills section     → skill row
 */
import { createRequire } from "node:module";
import { NO_BULLET_SOURCE, NO_ITEM_SOURCE, newId as defaultNewId } from "@/lib/resume/factories";
import { parseDateRange, parseYearMonth } from "@/lib/resume/dates";
import { classifyContacts, guessEntryKind } from "@/lib/resume/migrate";
import {
  CONTENT_VERSION,
  ResumeContentSchema,
  type DateRange,
  type ResumeContent,
  type Section,
} from "@/lib/resume/schema";

export type PdfLine = {
  page: number;
  /** x of the first non-empty item, in PDF points. */
  x: number;
  /** Text left of the large gap (or the whole line). */
  left: string;
  /** Right-aligned text after a large gap, if any. */
  right: string;
  /** Link annotations that overlap items on this line: visible text → url. */
  links: Record<string, string>;
};

/** Whitespace items wider than this (pt) separate left and right columns. */
const COLUMN_GAP = 40;

export async function extractLines(data: Uint8Array): Promise<PdfLine[]> {
  const require = createRequire(import.meta.url);
  const pdfjs = await import(require.resolve("pdfjs-dist/legacy/build/pdf.mjs"));
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const lines: PdfLine[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const annotations: { subtype: string; url?: string; rect: number[] }[] = await page.getAnnotations();
    const linkRects = annotations.filter((a) => a.subtype === "Link" && a.url);
    const { items } = await page.getTextContent();

    // Group items by baseline (items arrive in reading order).
    const rows = new Map<number, { x: number; y: number; w: number; str: string }[]>();
    for (const it of items) {
      if (!("str" in it) || it.str === "") continue;
      const y = Math.round(it.transform[5] * 2) / 2;
      const row = rows.get(y) ?? [];
      row.push({ x: it.transform[4], y: it.transform[5], w: it.width, str: it.str });
      rows.set(y, row);
    }

    const ys = [...rows.keys()].sort((a, b) => b - a); // top to bottom
    for (const y of ys) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      let left = "";
      let right = "";
      let inRight = false;
      const links: Record<string, string> = {};
      for (const it of row) {
        if (it.str.trim() === "" && it.w > COLUMN_GAP) {
          inRight = true;
          continue;
        }
        if (inRight) right += it.str;
        else left += it.str;
        const cx = it.x + it.w / 2;
        const link = linkRects.find(
          (a) => cx >= a.rect[0] && cx <= a.rect[2] && it.y >= a.rect[1] && it.y <= a.rect[3],
        );
        if (link && it.str.trim()) links[it.str.trim()] = link.url!;
      }
      const first = row.find((it) => it.str.trim() !== "");
      if (!first) continue;
      lines.push({ page: p, x: first.x, left: clean(left), right: clean(right), links });
    }
  }
  return lines;
}

const clean = (s: string) => s.replace(/[​ ]/g, " ").replace(/\s+/g, " ").trim();

const isHeading = (l: PdfLine) =>
  l.right === "" && /[A-Z]/.test(l.left) && /^[A-Z0-9&/,'’ -]+$/.test(l.left);

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => (w === "&" || w === "and" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

function splitDates(s: string): DateRange {
  const [start = "", end = ""] = s.split(/\s+[-–—]\s+/);
  return parseDateRange(start, end);
}

/** "A | B" → ["A", "B"]; no separator → [s, ""]. Splits on the first (or last) bar. */
function splitBar(s: string, from: "first" | "last"): [string, string] {
  const i = from === "first" ? s.indexOf("|") : s.lastIndexOf("|");
  if (i < 0) return [s.trim(), ""];
  return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

function sectionTypeFor(heading: string): Section["type"] {
  const h = heading.toLowerCase();
  if (h.includes("education")) return "education";
  if (h.includes("summary") || h.includes("profile") || h.includes("objective")) return "summary";
  if (h.includes("skill")) return "skills";
  if (h.includes("publication") || h.includes("papers")) return "publications";
  return "entries";
}

export function parseLines(lines: PdfLine[], newId: () => string = defaultNewId): ResumeContent {
  const [nameLine, contactLine, ...rest] = lines;
  if (!nameLine || !contactLine) throw new Error("PDF has too few lines to be a resume");

  const contacts = contactLine.left
    .split("•")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => {
      const url = contactLine.links[text];
      return url ? { id: newId(), text, url } : { id: newId(), text };
    });

  const sections: Section[] = [];
  let section: Section | null = null;
  // The last bullet-bearing text we can append wrapped lines to.
  let appendTarget: { text: string } | null = null;

  for (const line of rest) {
    if (isHeading(line)) {
      const heading = titleCase(line.left);
      const type = sectionTypeFor(heading);
      const base = { id: newId(), heading };
      section =
        type === "summary"
          ? { ...base, type, text: "", ...NO_ITEM_SOURCE }
          : type === "education"
            ? { ...base, type, schools: [] }
            : type === "skills"
              ? { ...base, type, rows: [] }
              : type === "publications"
                ? { ...base, type, papers: [] }
                : { ...base, type, entryKind: guessEntryKind(heading), entries: [] };
      sections.push(section);
      appendTarget = null;
      continue;
    }
    if (!section) continue;

    switch (section.type) {
      case "summary":
        section.text = section.text ? `${section.text} ${line.left}` : line.left;
        break;

      case "skills": {
        const i = line.left.indexOf(":");
        const category = i >= 0 ? line.left.slice(0, i).trim() : "";
        const items = (i >= 0 ? line.left.slice(i + 1) : line.left)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        section.rows.push({ id: newId(), category, items, ...NO_ITEM_SOURCE });
        break;
      }

      case "education": {
        if (line.left.startsWith("➔")) {
          const school = section.schools.at(-1);
          if (!school) break;
          school.degrees.push({
            id: newId(),
            name: line.left.replace(/^➔\s*/, ""),
            dates: splitDates(line.right),
          });
        } else {
          const [school, location] = splitBar(line.left, "first");
          section.schools.push({ id: newId(), school, location, degrees: [], ...NO_ITEM_SOURCE });
        }
        break;
      }

      case "publications": {
        // "Title | Venue" on the left, date on the right; an indented line
        // without a bullet glyph right after the title row is the author list.
        const paper = section.papers.at(-1);
        if (line.left.startsWith("●")) {
          if (!paper) break;
          const bullet = { id: newId(), text: line.left.replace(/^●\s*/, ""), ...NO_BULLET_SOURCE };
          paper.bullets.push(bullet);
          appendTarget = bullet;
        } else if (line.x > 40 && appendTarget) {
          appendTarget.text = `${appendTarget.text} ${line.left}`;
        } else if (paper && !line.right && !paper.authors && paper.bullets.length === 0) {
          paper.authors = line.left;
        } else {
          const [title, venue] = splitBar(line.left, "first");
          section.papers.push({
            id: newId(),
            title,
            authors: "",
            venue,
            date: parseYearMonth(line.right),
            bullets: [],
            visible: true,
            ...NO_ITEM_SOURCE,
          });
          appendTarget = null;
        }
        break;
      }

      case "entries": {
        const entry = section.entries.at(-1);
        if (line.left.startsWith("●")) {
          if (!entry) break;
          const bullet = { id: newId(), text: line.left.replace(/^●\s*/, ""), ...NO_BULLET_SOURCE };
          entry.bullets.push(bullet);
          appendTarget = bullet;
        } else if (line.x > 40 && appendTarget) {
          // Indented line without a bullet glyph: wrapped continuation.
          appendTarget.text = `${appendTarget.text} ${line.left}`;
        } else {
          const [title, org] = splitBar(line.left, "first");
          const [location, dates] = line.right.includes("|")
            ? splitBar(line.right, "last")
            : ["", line.right];
          section.entries.push({
            id: newId(),
            title,
            org,
            location,
            dates: splitDates(dates),
            bullets: [],
            visible: true,
            ...NO_ITEM_SOURCE,
          });
          appendTarget = null;
        }
        break;
      }
    }
  }

  return ResumeContentSchema.parse({
    version: CONTENT_VERSION,
    settings: { dateFormat: "long" },
    header: { name: nameLine.left, ...classifyContacts(contacts) },
    sections,
  });
}

export async function parseResumePdf(data: Uint8Array, newId?: () => string): Promise<ResumeContent> {
  return parseLines(await extractLines(data), newId);
}
