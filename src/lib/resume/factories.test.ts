import { describe, expect, it } from "vitest";
import { cloneWithNewIds, emptyResume, newSection } from "./factories";
import { ResumeContentSchema, type ResumeContent } from "./schema";

const collectIds = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) value.forEach((v) => collectIds(v, out));
  else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.id === "string") out.push(obj.id);
    Object.values(obj).forEach((v) => collectIds(v, out));
  }
  return out;
};

describe("factories", () => {
  it("emptyResume() is valid content", () => {
    expect(() => ResumeContentSchema.parse(emptyResume())).not.toThrow();
  });

  it("newSection() produces valid sections of each type", () => {
    for (const type of ["summary", "entries", "publications", "education", "skills"] as const) {
      const content: ResumeContent = {
        version: 3,
        settings: { dateFormat: "long" },
        header: { name: "", email: "", location: "", phone: "", links: [] },
        sections: [newSection(type)],
      };
      expect(ResumeContentSchema.parse(content).sections[0].type).toBe(type);
    }
  });

  it("cloneWithNewIds() keeps content but replaces every id", () => {
    const original = emptyResume();
    const copy = cloneWithNewIds(original);
    const before = collectIds(original);
    const after = collectIds(copy);
    expect(after).toHaveLength(before.length);
    expect(after.some((id) => before.includes(id))).toBe(false);
    expect(new Set(after).size).toBe(after.length);
    const strip = (c: ResumeContent) => JSON.parse(JSON.stringify(c, (k, v) => (k === "id" ? undefined : v)));
    expect(strip(copy)).toEqual(strip(original));
  });
});
