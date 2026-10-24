import { formatRange, formatYearMonth } from "@/lib/resume/dates";
import type { LibraryItemData, LibraryKind } from "./schema";

/** The parts of a library item that listing, search and filtering need. */
export type ItemLike = LibraryItemData & {
  tags: string[];
  bullets: { tags: string[]; variants: { text: string; label: string | null }[] }[];
};

export const KIND_LABEL: Record<LibraryKind, { one: string; many: string }> = {
  experience: { one: "Experience", many: "Experience" },
  project: { one: "Project", many: "Projects" },
  publication: { one: "Publication", many: "Publications" },
  education: { one: "Education", many: "Education" },
  skills: { one: "Skill group", many: "Skills" },
  summary: { one: "Summary", many: "Summaries" },
};

/** The item's name in lists and editor headers. */
export function itemTitle(item: LibraryItemData): string {
  switch (item.kind) {
    case "experience":
    case "project":
      return [item.fields.title, item.fields.org].filter(Boolean).join(" · ") || `Untitled ${item.kind}`;
    case "publication":
      return item.fields.title || "Untitled publication";
    case "education":
      return item.fields.school || "Untitled school";
    case "skills":
      return item.fields.category || item.fields.items.slice(0, 3).join(", ") || "Untitled skill group";
    case "summary": {
      const text = item.fields.text.trim().replace(/\s+/g, " ");
      return text.length > 90 ? `${text.slice(0, 90)}…` : text || "Empty summary";
    }
  }
}

/** A second line of detail under the title ("" when there's nothing to add). */
export function itemDetail(item: LibraryItemData): string {
  switch (item.kind) {
    case "experience":
    case "project":
      return item.fields.location;
    case "publication":
      return [item.fields.venue, item.fields.authors].filter(Boolean).join(" · ");
    case "education":
      return item.fields.degrees.map((d) => d.name).filter(Boolean).join(" · ");
    case "skills":
      return item.fields.category ? item.fields.items.join(", ") : "";
    case "summary":
      return "";
  }
}

/** Dates in the short format ("Aug 2023 - Present"), or "". */
export function itemDates(item: LibraryItemData): string {
  switch (item.kind) {
    case "experience":
    case "project":
      return formatRange(item.fields.dates, "short");
    case "publication":
      return formatYearMonth(item.fields.date, "short");
    case "education": {
      const first = item.fields.degrees[0];
      return first ? formatRange(first.dates, "short") : "";
    }
    default:
      return "";
  }
}

/** The item's own tags plus its bullets' tags, without case-insensitive duplicates. */
export function allTags(item: ItemLike): string[] {
  const seen = new Map<string, string>();
  for (const tag of [...item.tags, ...item.bullets.flatMap((b) => b.tags)]) {
    if (!seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
  }
  return [...seen.values()];
}

/** Every word of `query` appears somewhere in the item (fields, tags, any bullet variant). */
export function matchesQuery(item: ItemLike, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    itemTitle(item),
    itemDetail(item),
    item.kind === "summary" ? item.fields.text : "",
    ...allTags(item),
    ...item.bullets.flatMap((b) => b.variants.map((v) => v.text)),
  ]
    .join("\n")
    .toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

/** The item (or one of its bullets) has every selected tag, ignoring case. */
export function matchesTags(item: ItemLike, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  const have = new Set(allTags(item).map((t) => t.toLowerCase()));
  return selected.every((t) => have.has(t.toLowerCase()));
}

/** Tags across all items, most used first, then alphabetically. */
export function tagCounts(items: ItemLike[]): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const item of items) {
    for (const tag of allTags(item)) {
      const entry = counts.get(tag.toLowerCase());
      if (entry) entry.count++;
      else counts.set(tag.toLowerCase(), { tag, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
