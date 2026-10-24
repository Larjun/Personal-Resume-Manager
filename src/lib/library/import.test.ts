import { describe, expect, it } from "vitest";
import { newBullet, newEntriesSection, newEntry, newSection } from "@/lib/resume/factories";
import { CONTENT_VERSION, type Entry, type ResumeContent, type Section } from "@/lib/resume/schema";
import { planResumeImport, type ExistingItem } from "./import";

const counter = () => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
};
const NOW = new Date("2026-10-24T12:00:00.000Z");
const EARLIER = new Date("2026-10-01T09:00:00.000Z");

const entries = (heading: string, list: Entry[]): Section =>
  ({ ...newEntriesSection(heading === "Projects" ? "project" : "experience", heading), entries: list }) as Section;
const job = (title: string, org: string, bullets: string[]): Entry => ({
  ...newEntry(),
  title,
  org,
  bullets: bullets.map((t) => newBullet(t)),
});
const resume = (...sections: Section[]): ResumeContent => ({
  version: CONTENT_VERSION,
  settings: { dateFormat: "long" },
  header: { name: "", email: "", location: "", phone: "", links: [] },
  sections,
});

describe("planResumeImport", () => {
  it("creates items with bullets and links the resume to them", () => {
    const content = resume(
      entries("Experience", [job("Engineer", "Acme", ["Built an API", "  "])]),
      entries("Projects", [job("Wildfire App", "", ["Shipped it"])]),
      { ...newSection("summary"), text: "Hello" } as Section,
    );
    const plan = planResumeImport(content, [], NOW, counter());

    expect(plan.counts).toEqual({ created: 3, linked: 0, alreadyLinked: 0, skipped: 0 });
    expect(plan.create.map((c) => [c.kind, c.bullets.map((b) => b.variants[0].text)])).toEqual([
      ["experience", ["Built an API"]], // blank bullet left out
      ["project", ["Shipped it"]],
      ["summary", []],
    ]);
    const [exp] = plan.content.sections;
    if (exp.type !== "entries") throw new Error("unreachable");
    const [e] = exp.entries;
    expect(e.sourceItemId).toBe(plan.create[0].id);
    expect(e.sourceItemUpdatedAt).toBe(NOW.toISOString());
    expect(e.bullets[0]).toMatchObject({
      sourceBulletId: plan.create[0].bullets[0].id,
      sourceVariantId: plan.create[0].bullets[0].variants[0].id,
    });
    expect(e.bullets[1].sourceBulletId).toBe(null);
    // The input isn't mutated.
    expect(content.sections[0].type === "entries" && content.sections[0].entries[0].sourceItemId).toBe(null);
  });

  it("is idempotent: a second run over the linked result does nothing", () => {
    const first = planResumeImport(resume(entries("Experience", [job("Engineer", "Acme", ["Built an API"])])), [], NOW, counter());
    const library: ExistingItem[] = first.create.map((c) => ({ ...c, updatedAt: NOW }));
    const second = planResumeImport(first.content, library, NOW, counter());
    expect(second.counts).toEqual({ created: 0, linked: 0, alreadyLinked: 1, skipped: 0 });
    expect(second.create).toEqual([]);
    expect(second.content).toEqual(first.content);
  });

  it("links an unlinked item to a matching library item (e.g. after re-seeding) and appends new bullets", () => {
    const library: ExistingItem[] = [
      {
        id: "lib-1",
        kind: "experience",
        fields: { title: "Engineer", org: "ACME ", location: "", dates: { start: null, end: null } },
        updatedAt: EARLIER,
        bullets: [{ id: "lb-1", variants: [{ id: "lv-1", text: "Built an API" }] }],
      },
    ];
    const plan = planResumeImport(
      resume(entries("Experience", [job("engineer", "Acme", ["Built  an API", "Led a team"])])),
      library,
      NOW,
      counter(),
    );
    expect(plan.counts).toEqual({ created: 0, linked: 1, alreadyLinked: 0, skipped: 0 });
    expect(plan.append).toEqual([
      { itemId: "lib-1", bullets: [expect.objectContaining({ variants: [expect.objectContaining({ text: "Led a team" })] })] },
    ]);
    const [exp] = plan.content.sections;
    if (exp.type !== "entries") throw new Error("unreachable");
    expect(exp.entries[0].bullets[0]).toMatchObject({ sourceBulletId: "lb-1", sourceVariantId: "lv-1" });
    // Appending bullets updates the library item, so the copy time is now.
    expect(exp.entries[0].sourceItemUpdatedAt).toBe(NOW.toISOString());
  });

  it("keeps the library item's own updatedAt when nothing was appended", () => {
    const library: ExistingItem[] = [
      { id: "lib-1", kind: "summary", fields: { text: "Hello there" }, updatedAt: EARLIER, bullets: [] },
    ];
    const plan = planResumeImport(resume({ ...newSection("summary"), text: "hello  there" } as Section), library, NOW, counter());
    expect(plan.content.sections[0]).toMatchObject({ sourceItemId: "lib-1", sourceItemUpdatedAt: EARLIER.toISOString() });
  });

  it("re-imports an item whose library source was deleted, and skips blank items", () => {
    const linkedToDeleted = { ...job("Engineer", "Acme", []), sourceItemId: "gone", sourceItemUpdatedAt: EARLIER.toISOString() };
    const plan = planResumeImport(resume(entries("Experience", [linkedToDeleted, newEntry()])), [], NOW, counter());
    expect(plan.counts).toEqual({ created: 1, linked: 0, alreadyLinked: 0, skipped: 1 });
  });

  it("links duplicate items within one resume to a single new item", () => {
    const plan = planResumeImport(
      resume(entries("Experience", [job("Engineer", "Acme", ["A"]), job("Engineer", "Acme", ["A", "B"])])),
      [],
      NOW,
      counter(),
    );
    expect(plan.counts).toMatchObject({ created: 1, linked: 1 });
    expect(plan.create[0].bullets.map((b) => b.variants[0].text)).toEqual(["A", "B"]);
  });
});
