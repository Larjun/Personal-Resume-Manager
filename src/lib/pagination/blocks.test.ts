import { describe, expect, it } from "vitest";
import { newBullet, newEntry, newPaper, newSection } from "@/lib/resume/factories";
import { CONTENT_VERSION, type ResumeContent, type Section } from "@/lib/resume/schema";
import { toBlocks } from "./blocks";

const entriesSection = (visibility: boolean[]): Section => {
  const section = newSection("entries");
  if (section.type !== "entries") throw new Error("unreachable");
  section.entries = visibility.map((visible, i) => ({
    ...newEntry(),
    title: `Job ${i}`,
    bullets: [newBullet("a"), newBullet("b")],
    visible,
  }));
  return section;
};

const content = (...sections: Section[]): ResumeContent => ({
  version: CONTENT_VERSION,
  settings: { dateFormat: "long" },
  header: { name: "N", email: "", location: "", phone: "", links: [] },
  sections,
});

const kinds = (c: ResumeContent) => toBlocks(c).map((b) => b.kind);

describe("toBlocks", () => {
  it("glues headings and entry headers to what follows", () => {
    const blocks = toBlocks(content(entriesSection([true])));
    expect(blocks.map((b) => [b.kind, b.keepWithNext])).toEqual([
      ["header", false],
      ["heading", true],
      ["entryHeader", true],
      ["bullet", false],
      ["bullet", false],
    ]);
  });

  it("leaves unchecked entries out", () => {
    const blocks = toBlocks(content(entriesSection([true, false, true])));
    const titles = blocks.flatMap((b) => (b.kind === "entryHeader" ? [b.entry.title] : []));
    expect(titles).toEqual(["Job 0", "Job 2"]);
  });

  it("drops the whole section when every entry is unchecked", () => {
    expect(kinds(content(entriesSection([false, false])))).toEqual(["header"]);
  });

  it("skips blank bullets and entirely blank entries", () => {
    const section = entriesSection([true]);
    if (section.type !== "entries") throw new Error("unreachable");
    section.entries[0].bullets.push(newBullet("   "));
    section.entries.push(newEntry()); // blank, as when just added
    expect(kinds(content(section))).toEqual(["header", "heading", "entryHeader", "bullet", "bullet"]);
  });

  it("keeps the heading of an entries section that has no entries yet", () => {
    expect(kinds(content(entriesSection([])))).toEqual(["header", "heading"]);
  });

  it("renders visible papers, glued to their bullets", () => {
    const section = newSection("publications");
    if (section.type !== "publications") throw new Error("unreachable");
    section.papers = [
      { ...newPaper(), title: "Shown", bullets: [newBullet("Best paper award")] },
      { ...newPaper(), title: "Hidden", visible: false },
      newPaper(), // blank, as when just added
    ];
    const blocks = toBlocks(content(section));
    expect(blocks.map((b) => [b.kind, b.keepWithNext])).toEqual([
      ["header", false],
      ["heading", true],
      ["paper", true],
      ["bullet", false],
    ]);
  });

  it("drops a publications section whose papers are all unchecked", () => {
    const section = newSection("publications");
    if (section.type !== "publications") throw new Error("unreachable");
    section.papers = [{ ...newPaper(), title: "X", visible: false }];
    expect(kinds(content(section))).toEqual(["header"]);
  });
});
