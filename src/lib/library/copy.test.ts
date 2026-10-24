import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { newEntriesSection, newEntry, newSection } from "@/lib/resume/factories";
import { CONTENT_VERSION, ResumeContentSchema, type ResumeContent, type Section } from "@/lib/resume/schema";
import { addLibraryItems, defaultBulletChoices, itemIdsInResume, libraryKindFor, type CopySource } from "./copy";

const counter = () => {
  let n = 0;
  return () => `new-${++n}`;
};
const UPDATED = new Date("2026-10-20T08:00:00.000Z");

const job: CopySource = {
  id: "item-job",
  kind: "experience",
  fields: { title: "Engineer", org: "Acme", location: "Remote", dates: { start: { year: 2023, month: 8 }, end: "present" } },
  updatedAt: UPDATED,
  bullets: [
    { id: "b1", variants: [{ id: "b1v1", text: "Built an API" }, { id: "b1v2", text: "Built a Flask API" }] },
    { id: "b2", variants: [{ id: "b2v1", text: "  " }] }, // blank
    { id: "b3", variants: [{ id: "b3v1", text: "Led a team" }] },
  ],
};

const project: CopySource = {
  id: "item-proj",
  kind: "project",
  fields: { title: "Wildfire App", org: "", location: "", dates: { start: null, end: null } },
  updatedAt: UPDATED,
  bullets: [],
};

const resume = (...sections: Section[]): ResumeContent => ({
  version: CONTENT_VERSION,
  settings: { dateFormat: "long" },
  header: { name: "", email: "", location: "", phone: "", links: [] },
  sections,
});
const experience = () => ({ ...newSection("entries", "Experience"), entries: [newEntry()] }) as Section;

describe("defaultBulletChoices", () => {
  it("picks every non-blank bullet with its first wording", () => {
    expect(defaultBulletChoices(job)).toEqual([
      { bulletId: "b1", variantId: "b1v1" },
      { bulletId: "b3", variantId: "b3v1" },
    ]);
  });
});

describe("addLibraryItems", () => {
  it("copies an experience with the chosen bullets and variant, setting source ids and fresh ids", () => {
    const out = produce(resume(experience()), (d) =>
      addLibraryItems(d, [{ item: job, bullets: [{ bulletId: "b3", variantId: "b3v1" }, { bulletId: "b1", variantId: "b1v2" }] }], { newId: counter() }),
    );
    const [exp] = out.sections;
    if (exp.type !== "entries") throw new Error("unreachable");
    expect(exp.entries).toHaveLength(2); // appended after the existing entry
    expect(exp.entries[1]).toEqual({
      id: "new-3",
      title: "Engineer",
      org: "Acme",
      location: "Remote",
      dates: { start: { year: 2023, month: 8 }, end: "present" },
      bullets: [
        { id: "new-1", text: "Led a team", sourceBulletId: "b3", sourceVariantId: "b3v1" },
        { id: "new-2", text: "Built a Flask API", sourceBulletId: "b1", sourceVariantId: "b1v2" },
      ],
      visible: true,
      sourceItemId: "item-job",
      sourceItemUpdatedAt: UPDATED.toISOString(),
    });
    expect(() => ResumeContentSchema.parse(out)).not.toThrow();
  });

  it("puts projects in a Projects section, creating it when missing", () => {
    const out = produce(resume(experience()), (d) => addLibraryItems(d, [{ item: project, bullets: [] }], { newId: counter() }));
    expect(out.sections.map((s) => [s.type, s.heading])).toEqual([
      ["entries", "Experience"],
      ["entries", "Projects"],
    ]);
    const proj = out.sections[1];
    expect(proj.type === "entries" && proj.entries.map((e) => e.title)).toEqual(["Wildfire App"]);
  });

  it("puts experience in the Experience section even when a Projects section comes first", () => {
    const projects = { ...newEntriesSection("project", "Side Projects"), entries: [] } as Section;
    const out = produce(resume(projects, experience()), (d) => addLibraryItems(d, [{ item: job, bullets: [] }], { newId: counter() }));
    const [p, e] = out.sections;
    expect(p.type === "entries" && p.entries).toHaveLength(0);
    expect(e.type === "entries" && e.entries).toHaveLength(2);
  });

  it("replaces the summary text, or adds a summary at the top", () => {
    const summary: CopySource = { id: "item-sum", kind: "summary", fields: { text: "New summary" }, updatedAt: UPDATED, bullets: [] };
    const replaced = produce(resume(experience(), { ...newSection("summary"), text: "Old" } as Section), (d) =>
      addLibraryItems(d, [{ item: summary, bullets: [] }]),
    );
    expect(replaced.sections[1]).toMatchObject({ type: "summary", text: "New summary", sourceItemId: "item-sum" });

    const added = produce(resume(experience()), (d) => addLibraryItems(d, [{ item: summary, bullets: [] }]));
    expect(added.sections[0]).toMatchObject({ type: "summary", heading: "Summary", text: "New summary" });
  });

  it("gives copied degrees fresh ids and never shares objects with the library item", () => {
    const school: CopySource = {
      id: "item-edu",
      kind: "education",
      fields: { school: "CU Boulder", location: "", degrees: [{ id: "deg-lib", name: "BS CS", dates: { start: null, end: null } }] },
      updatedAt: UPDATED,
      bullets: [],
    };
    const content = resume();
    addLibraryItems(content, [{ item: school, bullets: [] }], { newId: counter() });
    const edu = content.sections[0];
    if (edu.type !== "education") throw new Error("unreachable");
    expect(edu.schools[0].degrees[0].id).not.toBe("deg-lib");
    edu.schools[0].degrees[0].name = "changed";
    expect(school.fields.school === "CU Boulder" && school.fields.degrees[0].name).toBe("BS CS");
  });
});

describe("addLibraryItems into a chosen section", () => {
  it("puts items in the section they were added from", () => {
    const first = { ...newEntriesSection("project", "Projects"), entries: [] } as Section;
    const second = { ...newEntriesSection("project", "More Projects"), entries: [] } as Section;
    const out = produce(resume(first, second), (d) => addLibraryItems(d, [{ item: project, bullets: [] }], { sectionId: second.id }));
    const [a, b] = out.sections;
    expect(a.type === "entries" && a.entries).toHaveLength(0);
    expect(b.type === "entries" && b.entries.map((x) => x.title)).toEqual(["Wildfire App"]);
  });

  it("never puts a project into an Experience section, even when chosen", () => {
    const exp = experience();
    const out = produce(resume(exp), (d) => addLibraryItems(d, [{ item: project, bullets: [] }], { sectionId: exp.id }));
    expect(out.sections.map((s) => s.type === "entries" && [s.heading, s.entryKind, s.entries.length])).toEqual([
      ["Experience", "experience", 1],
      ["Projects", "project", 1],
    ]);
  });

  it("falls back to normal placement when the chosen section can't hold the kind", () => {
    const skills = { ...newSection("skills"), rows: [] } as Section;
    const out = produce(resume(skills), (d) => addLibraryItems(d, [{ item: job, bullets: [] }], { sectionId: skills.id }));
    expect(out.sections.map((s) => s.type)).toEqual(["skills", "entries"]);
  });
});

describe("libraryKindFor", () => {
  it("follows the section's entryKind, not its heading", () => {
    expect(libraryKindFor(newEntriesSection("project", "Things I Built"))).toBe("project");
    expect(libraryKindFor(newEntriesSection("experience", "Projects (misnamed)"))).toBe("experience");
    expect(libraryKindFor(newSection("publications"))).toBe("publication");
    expect(libraryKindFor(newSection("skills"))).toBe("skills");
  });
});

describe("addLibraryItems duplicates", () => {
  it("never adds an item the resume already has, or the same item twice in one call", () => {
    const content = resume(experience());
    addLibraryItems(content, [{ item: job, bullets: [] }, { item: job, bullets: [] }]);
    addLibraryItems(content, [{ item: job, bullets: defaultBulletChoices(job) }]);
    const [exp] = content.sections;
    expect(exp.type === "entries" && exp.entries.filter((e) => e.sourceItemId === "item-job")).toHaveLength(1);
  });
});

describe("itemIdsInResume", () => {
  it("lists the library items a resume copied from", () => {
    const content = resume(experience());
    addLibraryItems(content, [{ item: job, bullets: [] }, { item: project, bullets: [] }]);
    expect([...itemIdsInResume(content)].sort()).toEqual(["item-job", "item-proj"]);
  });
});
