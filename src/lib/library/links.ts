import { z } from "zod";
import type { ResumeContent } from "@/lib/resume/schema";

const isUuid = (s: string) => z.uuid().safeParse(s).success;

/**
 * Distinct library item ids a resume copied from (its resume_item_links rows).
 * Malformed ids are skipped, since they can't refer to a library row.
 */
export function sourceItemIds(content: ResumeContent): string[] {
  const ids = new Set<string>();
  const add = (item: { sourceItemId: string | null }) => {
    if (item.sourceItemId && isUuid(item.sourceItemId)) ids.add(item.sourceItemId);
  };
  for (const section of content.sections) {
    switch (section.type) {
      case "summary":
        add(section);
        break;
      case "entries":
        section.entries.forEach(add);
        break;
      case "publications":
        section.papers.forEach(add);
        break;
      case "education":
        section.schools.forEach(add);
        break;
      case "skills":
        section.rows.forEach(add);
        break;
    }
  }
  return [...ids];
}
