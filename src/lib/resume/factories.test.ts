import { describe, expect, it } from "vitest";
import { cloneWithNewIds, emptyResume, newSection } from "./factories";
import { CONTENT_VERSION, ResumeContentSchema, type ResumeContent } from "./schema";

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
        version: CONTENT_VERSION,
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

  it("cloneWithNewIds() keeps library source ids", () => {
    const original = emptyResume();
    const section = original.sections.find((s) => s.type === "entries")!;
    if (section.type !== "entries") throw new Error("unreachable");
    Object.assign(section.entries[0], { sourceItemId: "item-1", sourceItemUpdatedAt: "2026-10-24T10:00:00.000Z" });
    Object.assign(section.entries[0].bullets[0], { sourceBulletId: "bullet-1", sourceVariantId: "variant-1" });

    const copy = cloneWithNewIds(original).sections.find((s) => s.type === "entries")!;
    if (copy.type !== "entries") throw new Error("unreachable");
    expect(copy.entries[0]).toMatchObject({ sourceItemId: "item-1", sourceItemUpdatedAt: "2026-10-24T10:00:00.000Z" });
    expect(copy.entries[0].bullets[0]).toMatchObject({ sourceBulletId: "bullet-1", sourceVariantId: "variant-1" });
    expect(copy.entries[0].id).not.toBe(section.entries[0].id);
  });
});
