import { describe, expect, it } from "vitest";
import { MAX_TAG_LENGTH, normalizeTag, normalizeTags } from "./tags";

describe("normalizeTag", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTag("  machine   learning ")).toBe("machine learning");
  });

  it("caps the length", () => {
    expect(normalizeTag("x".repeat(100))).toHaveLength(MAX_TAG_LENGTH);
  });
});

describe("normalizeTags", () => {
  it("drops blanks and case-insensitive duplicates, keeping the first spelling", () => {
    expect(normalizeTags(["React", " ", "react", "SQL", "REACT", "sql "])).toEqual(["React", "SQL"]);
  });
});
