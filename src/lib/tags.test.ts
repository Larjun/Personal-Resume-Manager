import { describe, expect, it } from "vitest";
import { MAX_TAG_LENGTH, normalizeTag, normalizeTags, resolveTag } from "./tags";

describe("normalizeTag", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTag("  sim   racing ")).toBe("sim racing");
  });

  it("caps the length", () => {
    expect(normalizeTag("x".repeat(100))).toHaveLength(MAX_TAG_LENGTH);
  });

  it.each([
    ["ts", "TypeScript"],
    ["TS", "TypeScript"],
    ["typescript", "TypeScript"],
    ["js", "JavaScript"],
    ["postgres", "PostgreSQL"],
    ["Postgresql", "PostgreSQL"],
    ["k8s", "Kubernetes"],
    ["golang", "Go"],
    ["nodejs", "Node.js"],
    ["next", "Next.js"],
    ["  full   stack ", "Full-stack"],
    ["front-end", "Frontend"],
    ["ci-cd", "CI/CD"],
    ["restful", "REST APIs"],
    ["ml", "Machine Learning"],
    ["gcp", "Google Cloud"],
  ])("maps %s to %s", (raw, canonical) => {
    expect(normalizeTag(raw)).toBe(canonical);
  });

  it("keeps unknown tags as written", () => {
    expect(normalizeTag("Sim Racing")).toBe("Sim Racing");
    expect(normalizeTag("fraud prevention")).toBe("fraud prevention");
  });
});

describe("normalizeTags", () => {
  it("drops blanks and duplicates, including aliases of the same tag", () => {
    expect(normalizeTags(["React", " ", "react", "SQL", "ts", "TypeScript", "sql "])).toEqual(["React", "SQL", "TypeScript"]);
  });
});

describe("resolveTag", () => {
  it("prefers the alias map, then an existing spelling, then the input", () => {
    const existing = ["Sim Racing", "Python", "Fraud Prevention"];
    expect(resolveTag("py", existing)).toBe("Python");
    expect(resolveTag("sim racing", existing)).toBe("Sim Racing");
    expect(resolveTag("Leadership", existing)).toBe("Leadership");
  });
});
