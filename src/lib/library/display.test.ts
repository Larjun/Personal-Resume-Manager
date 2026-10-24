import { describe, expect, it } from "vitest";
import { itemDates, itemTitle, matchesQuery, matchesTags, tagCounts, type ItemLike } from "./display";

const job: ItemLike = {
  kind: "experience",
  fields: { title: "Software Engineer", org: "Acme", location: "Remote", dates: { start: { year: 2023, month: 8 }, end: "present" } },
  tags: ["Backend"],
  bullets: [
    { tags: ["Python"], variants: [{ text: "Built a Flask API for file uploads", label: null }] },
    { tags: [], variants: [{ text: "Led a team of four", label: "short" }] },
  ],
};

const skills: ItemLike = {
  kind: "skills",
  fields: { category: "Languages", items: ["Python", "TypeScript"] },
  tags: ["python"],
  bullets: [],
};

describe("itemTitle / itemDates", () => {
  it("names items by kind", () => {
    expect(itemTitle(job)).toBe("Software Engineer · Acme");
    expect(itemTitle(skills)).toBe("Languages");
    expect(itemTitle({ kind: "project", fields: { title: "", org: "", location: "", dates: { start: null, end: null } } })).toBe(
      "Untitled project",
    );
    expect(itemDates(job)).toBe("Aug 2023 - Present");
  });
});

describe("matchesQuery", () => {
  it("matches every word against fields, tags and bullet text", () => {
    expect(matchesQuery(job, "flask acme")).toBe(true);
    expect(matchesQuery(job, "python")).toBe(true); // bullet tag
    expect(matchesQuery(job, "flask google")).toBe(false);
    expect(matchesQuery(job, "  ")).toBe(true);
  });
});

describe("matchesTags", () => {
  it("requires every selected tag on the item or one of its bullets, ignoring case", () => {
    expect(matchesTags(job, ["backend", "Python"])).toBe(true);
    expect(matchesTags(job, ["Backend", "Go"])).toBe(false);
    expect(matchesTags(job, [])).toBe(true);
  });
});

describe("tagCounts", () => {
  it("counts each tag once per item, merging case, most used first", () => {
    expect(tagCounts([job, skills])).toEqual([
      { tag: "Python", count: 2 },
      { tag: "Backend", count: 1 },
    ]);
  });
});
