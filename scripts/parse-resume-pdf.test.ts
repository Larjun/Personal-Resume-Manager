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

    expect(content.header).toEqual({
      name: "Jane Doe",
      email: "jane@x.com",
      location: "Denver",
      phone: "",
      links: [{ id: "id-3", text: "jane.dev", url: "https://jane.dev/" }],
    });
    const [exp, edu, skills] = content.sections;
    expect(exp).toMatchObject({
      type: "entries",
      heading: "Experience",
      entries: [
        {
          title: "Engineer",
          org: "Acme",
          location: "Remote",
          dates: { start: { year: 2020, month: 1 }, end: "present" },
          bullets: [{ text: "Did a thing that wrapped onto a second line." }, { text: "Second" }],
        },
      ],
    });
    expect(edu).toMatchObject({
      type: "education",
      schools: [{ school: "State U", location: "Boulder, CO", degrees: [{ name: "BS in CS", dates: { start: { year: 2015, month: 8 }, end: { year: 2019, month: 5 } } }] }],
    });
    expect(skills).toMatchObject({
      type: "skills",
      heading: "Skills & Technologies",
      rows: [{ category: "Languages", items: ["Go", "Rust"] }],
    });
  });
});

describe("parseLines: publications", () => {
  it("reads title | venue, date, authors and bullets", () => {
    const content = parseLines(
      [
        line("Jane Doe", "", 220),
        line("jane@x.com", "", 70),
        line("PUBLICATIONS"),
        line("Fast Things | NeurIPS 2025", "Dec 2025"),
        line("J. Doe, A. Smith"),
        line("● Spotlight talk", "", 46.8),
        line("Slow Things", "2024"),
      ],
      counter(),
    );
    expect(content.sections[0]).toMatchObject({
      type: "publications",
      heading: "Publications",
      papers: [
        { title: "Fast Things", venue: "NeurIPS 2025", date: { year: 2025, month: 12 }, authors: "J. Doe, A. Smith", bullets: [{ text: "Spotlight talk" }] },
        { title: "Slow Things", venue: "", date: { year: 2024, month: null }, authors: "", bullets: [] },
      ],
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
