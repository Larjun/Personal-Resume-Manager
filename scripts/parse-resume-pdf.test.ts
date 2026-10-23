import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseLines, parseResumePdf, type PdfLine } from "./parse-resume-pdf";

const counter = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const line = (left: string, right = "", x = 28.8): PdfLine => ({ page: 1, x, left, right, links: {} });

describe("parseLines", () => {
  it("classifies headings, entries, bullets, continuations, degrees and skills", () => {
    const content = parseLines(
      [
        line("Jane Doe", "", 220),
        { ...line("jane@x.com • Denver • jane.dev", "", 70), links: { "jane.dev": "https://jane.dev/" } },
        line("EXPERIENCE"),
        line("Engineer | Acme", "Remote | Jan 2020 - Present"),
        line("● Did a thing that wrapped", "", 46.8),
        line("onto a second line.", "", 64.8),
        line("● Second", "", 46.8),
        line("EDUCATION"),
        line("State U | Boulder, CO"),
        line("➔ BS in CS", "Aug 2015 - May 2019", 31.8),
        line("SKILLS & TECHNOLOGIES"),
        line("Languages: Go, Rust"),
      ],
      counter(),
    );

    expect(content.header.contacts).toEqual([
      { id: "id-1", text: "jane@x.com" },
      { id: "id-2", text: "Denver" },
      { id: "id-3", text: "jane.dev", url: "https://jane.dev/" },
    ]);
    const [exp, edu, skills] = content.sections;
    expect(exp).toMatchObject({
      type: "entries",
      heading: "Experience",
      entries: [
        {
          title: "Engineer",
          org: "Acme",
          location: "Remote",
          dates: { start: "Jan 2020", end: "Present" },
          bullets: [{ text: "Did a thing that wrapped onto a second line." }, { text: "Second" }],
        },
      ],
    });
    expect(edu).toMatchObject({
      type: "education",
      schools: [{ school: "State U", location: "Boulder, CO", degrees: [{ name: "BS in CS", dates: { start: "Aug 2015", end: "May 2019" } }] }],
    });
    expect(skills).toMatchObject({
      type: "skills",
      heading: "Skills & Technologies",
      rows: [{ category: "Languages", items: ["Go", "Rust"] }],
    });
  });
});

describe("parseResumePdf(seed/resume.pdf)", () => {
  it("matches the snapshot", async () => {
    const data = new Uint8Array(readFileSync(path.resolve(__dirname, "../seed/resume.pdf")));
    const content = await parseResumePdf(data, counter());
    expect(content.sections.map((s) => [s.type, s.heading])).toEqual([
      ["education", "Education"],
      ["summary", "Summary"],
      ["entries", "Experience"],
      ["entries", "Projects"],
      ["skills", "Skills & Technologies"],
    ]);
    expect(content).toMatchSnapshot();
  });
});
