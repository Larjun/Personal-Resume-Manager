import { formatRange, formatYearMonth } from "@/lib/resume/dates";
import { newId as defaultNewId } from "@/lib/resume/factories";
import type { Bullet, Entry, Paper, School, SkillRow, Section } from "@/lib/resume/schema";
import type { LibraryItemData } from "./schema";

/**
 * Sync between a resume's copies and the library items they came from.
 * Edits in a resume never change the library by themselves; a bullet edited
 * in the resume can be pushed back with "Update library" (see bulletSync).
 * "Pull latest" makes a copy match its library item again:
 *  - every copied field takes the library's value;
 *  - each linked bullet whose library wording changed takes the new text (or
 *    its bullet's first wording if that one was deleted), unless the bullet
 *    was edited in this resume: resume edits are never overwritten;
 *  - bullets the resume added itself, or whose library bullet was deleted, stay;
 *  - library bullets the resume didn't pick are not added.
 */

export type SyncSource = LibraryItemData & {
  id: string;
  updatedAt: Date;
  bullets: { id: string; variants: { id: string; text: string }[] }[];
};

type Summary = Extract<Section, { type: "summary" }>;
/** Anything in a resume that can be copied from the library. */
export type Copy = Entry | Paper | School | SkillRow | Summary;

/** One difference between a copy and its library item, as display text. */
export type Change = { key: string; label: string; before: string; after: string };

export type CopyStatus =
  | "none" // not from the library
  | "unknown" // source not loaded yet
  | "current"
  | "updated" // the library changed since the copy, and pulling would change it
  | "deleted"; // the library item no longer exists

const degreesText = (degrees: School["degrees"]) =>
  degrees.map((d) => [d.name, formatRange(d.dates, "long")].filter(Boolean).join(" · ")).join("\n");

/** Field-level text of a copy or a library item of the same kind, in display order. */
function fieldTexts(data: LibraryItemData): [key: string, label: string, text: string][] {
  switch (data.kind) {
    case "experience":
    case "project": {
      const f = data.fields;
      return [
        ["title", "Title", f.title],
        ["org", "Organization", f.org],
        ["location", "Location", f.location],
        ["dates", "Dates", formatRange(f.dates, "long")],
      ];
    }
    case "publication": {
      const f = data.fields;
      return [
        ["title", "Title", f.title],
        ["authors", "Authors", f.authors],
        ["venue", "Venue", f.venue],
        ["date", "Date", formatYearMonth(f.date, "long")],
        ["url", "Link", f.url ?? ""],
      ];
    }
    case "education": {
      const f = data.fields;
      return [
        ["school", "School", f.school],
        ["location", "Location", f.location],
        ["degrees", "Degrees", degreesText(f.degrees)],
      ];
    }
    case "skills":
      return [
        ["category", "Category", data.fields.category],
        ["items", "Skills", data.fields.items.join(", ")],
      ];
    case "summary":
      return [["text", "Summary", data.fields.text]];
  }
}

/** The copy's fields, read as the library item's kind. */
const asData = (copy: Copy, kind: LibraryItemData["kind"]) => ({ kind, fields: copy }) as LibraryItemData;

const copyBullets = (copy: Copy): Bullet[] => ("bullets" in copy ? copy.bullets : []);

export type BulletSync = {
  /** Changed in this resume since it was copied, pulled or pushed. */
  edited: boolean;
  /** The library wording changed (or was deleted) since then. */
  libraryChanged: boolean;
  /** The library wording this bullet came from, if it still exists. */
  libraryText: string | null;
};

/**
 * A linked bullet compared with its library bullet: null when it isn't linked,
 * the source isn't loaded, or the library bullet was deleted.
 */
export function bulletSync(bullet: Bullet, source: SyncSource | null | undefined): BulletSync | null {
  if (!bullet.sourceBulletId || !source) return null;
  const lib = source.bullets.find((b) => b.id === bullet.sourceBulletId);
  if (!lib) return null;
  const variant = lib.variants.find((v) => v.id === bullet.sourceVariantId);
  const base = bullet.sourceText ?? variant?.text ?? bullet.text;
  return { edited: bullet.text !== base, libraryChanged: variant?.text !== base, libraryText: variant?.text ?? null };
}

/** What a linked bullet would become on pull, or null if it stays as it is. */
function latestBullet(bullet: Bullet, source: SyncSource): { text: string; variantId: string } | null {
  const sync = bulletSync(bullet, source);
  if (!sync || sync.edited || !sync.libraryChanged) return null;
  const lib = source.bullets.find((b) => b.id === bullet.sourceBulletId)!;
  const variant = lib.variants.find((v) => v.id === bullet.sourceVariantId) ?? lib.variants[0];
  return variant ? { text: variant.text, variantId: variant.id } : null;
}

/** What pulling the latest library version would change in `copy`. */
export function copyChanges(copy: Copy, source: SyncSource): Change[] {
  const before = fieldTexts(asData(copy, source.kind));
  const after = fieldTexts(source);
  const changes: Change[] = [];
  before.forEach(([key, label, text], i) => {
    if (text !== after[i][2]) changes.push({ key, label, before: text, after: after[i][2] });
  });
  copyBullets(copy).forEach((b, i) => {
    const latest = latestBullet(b, source);
    if (latest && latest.text !== b.text) {
      changes.push({ key: `bullet:${b.id}`, label: `Bullet ${i + 1}`, before: b.text, after: latest.text });
    }
  });
  return changes;
}

/**
 * The copy's sync state. `source` is undefined while sources are loading and
 * null once they've loaded without this item (deleted, or never the user's).
 */
export function copyStatus(copy: Copy, source: SyncSource | null | undefined): CopyStatus {
  if (!copy.sourceItemId) return "none";
  if (source === undefined) return "unknown";
  if (source === null) return "deleted";
  const copiedAt = copy.sourceItemUpdatedAt ? Date.parse(copy.sourceItemUpdatedAt) : 0;
  if (source.updatedAt.getTime() <= copiedAt) return "current";
  return copyChanges(copy, source).length > 0 ? "updated" : "current";
}

/** Pulls the latest library version into `copy` (mutates it; use on an immer draft). */
export function applyLatest(copy: Copy, source: SyncSource, newId: () => string = defaultNewId) {
  const fields = structuredClone(source.fields) as Record<string, unknown>;
  if (source.kind === "education") {
    // The resume's degrees get their own ids, as when the item was first copied.
    fields.degrees = source.fields.degrees.map((d) => ({ ...d, id: newId() }));
  }
  if (source.kind === "publication" && source.fields.url === undefined) delete (copy as Paper).url;
  Object.assign(copy, fields);
  for (const b of copyBullets(copy)) {
    const latest = latestBullet(b, source);
    if (!latest) continue;
    b.text = latest.text;
    b.sourceVariantId = latest.variantId;
    b.sourceText = latest.text;
  }
  copy.sourceItemUpdatedAt = source.updatedAt.toISOString();
}
