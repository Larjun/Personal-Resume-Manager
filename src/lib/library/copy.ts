import { DEFAULT_HEADINGS, newEntriesSection, newId as defaultNewId, newSection } from "@/lib/resume/factories";
import type { Bullet, ResumeContent, Section } from "@/lib/resume/schema";
import type { LibraryItemData, LibraryKind } from "./schema";

/**
 * "Add from library": copy library items into a resume. The resume gets its
 * own copy of every field and chosen bullet (fresh ids, source ids set), so
 * later library edits never change it by themselves.
 */

export type CopySource = LibraryItemData & {
  id: string;
  updatedAt: Date;
  bullets: { id: string; variants: { id: string; text: string }[] }[];
};

/** Which bullets to copy, in order, and which wording of each. */
export type BulletChoice = { bulletId: string; variantId: string };

export type LibraryPick = { item: CopySource; bullets: BulletChoice[] };

/** Every non-blank bullet, in pool order, with its first non-blank variant. */
export function defaultBulletChoices(item: CopySource): BulletChoice[] {
  return item.bullets.flatMap((b) => {
    const v = b.variants.find((x) => x.text.trim());
    return v ? [{ bulletId: b.id, variantId: v.id }] : [];
  });
}

/** The one library kind a section can take: Experience sections take experience, Projects sections projects. */
export function libraryKindFor(section: Section): LibraryKind {
  switch (section.type) {
    case "entries":
      return section.entryKind;
    case "publications":
      return "publication";
    default:
      return section.type;
  }
}

/**
 * The section an item of `kind` goes into: the chosen section if it takes that
 * kind, else the first section that does, else a new one at the end.
 */
function targetSection<T extends Section["type"]>(
  content: ResumeContent,
  chosen: Section | undefined,
  kind: LibraryKind,
  make: () => Section,
): Extract<Section, { type: T }> {
  const takes = (s: Section) => libraryKindFor(s) === kind;
  if (chosen && takes(chosen)) return chosen as Extract<Section, { type: T }>;
  const found = content.sections.find(takes);
  if (found) return found as Extract<Section, { type: T }>;
  const section = make();
  // Start empty: newSection adds a blank starter item.
  if (section.type === "entries") section.entries = [];
  if (section.type === "publications") section.papers = [];
  if (section.type === "education") section.schools = [];
  if (section.type === "skills") section.rows = [];
  content.sections.push(section);
  return section as Extract<Section, { type: T }>;
}

/**
 * Copies each pick into `content` (mutates it; use on an immer draft).
 * With `sectionId`, items go into that section when it takes their kind;
 * otherwise into the first section that does (Experience for experience,
 * Projects for projects…), created if missing. A summary replaces the
 * summary text. An item the resume already copied from is never added twice.
 */
export function addLibraryItems(
  content: ResumeContent,
  picks: LibraryPick[],
  { sectionId, newId = defaultNewId }: { sectionId?: string; newId?: () => string } = {},
) {
  const chosen = sectionId ? content.sections.find((s) => s.id === sectionId) : undefined;
  const present = itemIdsInResume(content);
  for (const { item, bullets: choices } of picks) {
    if (present.has(item.id)) continue;
    present.add(item.id);
    const source = { sourceItemId: item.id, sourceItemUpdatedAt: item.updatedAt.toISOString() };
    const bullets: Bullet[] = choices.flatMap(({ bulletId, variantId }) => {
      const variant = item.bullets.find((b) => b.id === bulletId)?.variants.find((v) => v.id === variantId);
      return variant
        ? [{ id: newId(), text: variant.text, sourceBulletId: bulletId, sourceVariantId: variantId, sourceText: variant.text }]
        : [];
    });
    const fields = structuredClone(item.fields);

    switch (item.kind) {
      case "experience":
      case "project": {
        const kind = item.kind;
        const section = targetSection<"entries">(content, chosen, kind, () => newEntriesSection(kind));
        section.entries.push({ id: newId(), ...(fields as typeof item.fields), bullets, visible: true, ...source });
        break;
      }
      case "publication": {
        const section = targetSection<"publications">(content, chosen, "publication", () =>
          newSection("publications", DEFAULT_HEADINGS.publications),
        );
        section.papers.push({ id: newId(), ...(fields as typeof item.fields), bullets, visible: true, ...source });
        break;
      }
      case "education": {
        const f = fields as typeof item.fields;
        const section = targetSection<"education">(content, chosen, "education", () => newSection("education"));
        section.schools.push({ id: newId(), ...f, degrees: f.degrees.map((d) => ({ ...d, id: newId() })), ...source });
        break;
      }
      case "skills": {
        const section = targetSection<"skills">(content, chosen, "skills", () => newSection("skills"));
        section.rows.push({ id: newId(), ...(fields as typeof item.fields), ...source });
        break;
      }
      case "summary": {
        const existing = chosen?.type === "summary" ? chosen : content.sections.find((s) => s.type === "summary");
        if (existing) Object.assign(existing, { text: item.fields.text, ...source });
        // A new summary goes first, right under the header.
        else content.sections.unshift({ ...newSection("summary"), text: item.fields.text, ...source } as Section);
        break;
      }
    }
  }
}

/** Library item ids this resume already copied from (to mark them in the drawer). */
export function itemIdsInResume(content: ResumeContent): Set<string> {
  const ids = new Set<string>();
  for (const s of content.sections) {
    const items: { sourceItemId: string | null }[] =
      s.type === "summary" ? [s] : s.type === "entries" ? s.entries : s.type === "publications" ? s.papers : s.type === "education" ? s.schools : s.rows;
    for (const i of items) if (i.sourceItemId) ids.add(i.sourceItemId);
  }
  return ids;
}
