import { formatRange, formatYearMonth } from "@/lib/resume/dates";
import type { Bullet, Degree, Entry, Header, Paper, ResumeContent, School, SkillRow } from "@/lib/resume/schema";

/**
 * The smallest unit placed on a page. Pagination never splits a block.
 * `keepWithNext` glues a block to the one after it (heading → first entry,
 * entry header / paper → first bullet, school → first degree).
 */
export type Block = { key: string; keepWithNext: boolean } & (
  | { kind: "header"; header: Header }
  | { kind: "heading"; text: string }
  | { kind: "summary"; text: string }
  | { kind: "entryHeader"; entry: Entry; dateText: string }
  | { kind: "paper"; paper: Paper; dateText: string }
  | { kind: "bullet"; bullet: Bullet }
  | { kind: "school"; school: School }
  | { kind: "degree"; degree: Degree; dateText: string }
  | { kind: "skillRow"; row: SkillRow }
);

export function toBlocks(content: ResumeContent): Block[] {
  // Every date is formatted here, with the resume's one format.
  const fmt = content.settings.dateFormat;
  const blocks: Block[] = [{ kind: "header", key: "header", keepWithNext: false, header: content.header }];

  for (const section of content.sections) {
    const body: Block[] = [];
    switch (section.type) {
      case "summary":
        if (section.text.trim()) body.push({ kind: "summary", key: `${section.id}:text`, keepWithNext: false, text: section.text });
        break;
      case "entries":
        for (const entry of section.entries) {
          if (!entry.visible) continue;
          const bullets = entry.bullets.filter((b) => b.text.trim());
          const { title, org, location, dates } = entry;
          const dateText = formatRange(dates, fmt);
          const blankHeader = ![title, org, location, dateText].some((v) => v.trim());
          if (blankHeader && bullets.length === 0) continue; // a just-added, empty entry
          body.push({ kind: "entryHeader", key: entry.id, keepWithNext: bullets.length > 0, entry, dateText });
          for (const bullet of bullets) body.push({ kind: "bullet", key: bullet.id, keepWithNext: false, bullet });
        }
        break;
      case "publications":
        for (const paper of section.papers) {
          if (!paper.visible) continue;
          const bullets = paper.bullets.filter((b) => b.text.trim());
          const dateText = formatYearMonth(paper.date, fmt);
          const blank = ![paper.title, paper.authors, paper.venue, dateText].some((v) => v.trim());
          if (blank && bullets.length === 0) continue;
          body.push({ kind: "paper", key: paper.id, keepWithNext: bullets.length > 0, paper, dateText });
          for (const bullet of bullets) body.push({ kind: "bullet", key: bullet.id, keepWithNext: false, bullet });
        }
        break;
      case "education":
        for (const school of section.schools) {
          body.push({ kind: "school", key: school.id, keepWithNext: school.degrees.length > 0, school });
          for (const degree of school.degrees)
            body.push({ kind: "degree", key: degree.id, keepWithNext: false, degree, dateText: formatRange(degree.dates, fmt) });
        }
        break;
      case "skills":
        for (const row of section.rows) body.push({ kind: "skillRow", key: row.id, keepWithNext: false, row });
        break;
    }
    // A section whose entries/papers are all unchecked disappears entirely.
    const items = section.type === "entries" ? section.entries : section.type === "publications" ? section.papers : [];
    const allHidden = items.length > 0 && items.every((item) => !item.visible);
    if (allHidden) continue;
    blocks.push({ kind: "heading", key: section.id, keepWithNext: body.length > 0, text: section.heading });
    blocks.push(...body);
  }
  return blocks;
}
