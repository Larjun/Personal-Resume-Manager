import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { newEntriesSection } from "@/lib/resume/factories";
import type { Entry, ResumeContent, Section } from "@/lib/resume/schema";
import { CONTENT_VERSION } from "@/lib/resume/schema";
import { addLibraryItems, defaultBulletChoices } from "./copy";
import { applyLatest, bulletSync, copyChanges, copyStatus, type SyncSource } from "./sync";

const COPIED = new Date("2026-10-20T08:00:00.000Z");
const LATER = new Date("2026-10-22T08:00:00.000Z");

const source = (patch: Partial<SyncSource> = {}): SyncSource =>
  ({
    id: "item-job",
    kind: "experience",
    fields: { title: "Engineer", org: "Acme", location: "Remote", dates: { start: { year: 2023, month: 8 }, end: "present" } },
    updatedAt: COPIED,
    bullets: [
      { id: "b1", variants: [{ id: "b1v1", text: "Built an API" }, { id: "b1v2", text: "Built a Flask API" }] },
      { id: "b2", variants: [{ id: "b2v1", text: "Led a team" }] },
      { id: "b3", variants: [{ id: "b3v1", text: "Not picked" }] },
    ],
    ...patch,
  }) as SyncSource;

/** A resume entry copied from `source()` with bullets b1 (wording 2) and b2, plus one resume-only bullet. */
function copiedEntry(): Entry {
  const content: ResumeContent = {
    version: CONTENT_VERSION,
    settings: { dateFormat: "long" },
    header: { name: "", email: "", location: "", phone: "", links: [] },
    sections: [{ ...newEntriesSection("experience"), entries: [] } as Section],
  };
  const item = source();
  const out = produce(content, (d) =>
    addLibraryItems(d, [
      {
        item,
        bullets: [
          { bulletId: "b1", variantId: "b1v2" },
          { bulletId: "b2", variantId: "b2v1" },
        ],
      },
    ]),
  );
  const section = out.sections[0];
  if (section.type !== "entries") throw new Error("unreachable");
  return produce(section.entries[0], (e) => {
    e.bullets.push({ id: "own", text: "Resume-only bullet", sourceBulletId: null, sourceVariantId: null, sourceText: null });
  });
}

describe("copyStatus", () => {
  it("is none for items not from the library, unknown until loaded, deleted when missing", () => {
    const entry = copiedEntry();
    expect(copyStatus({ ...entry, sourceItemId: null }, source())).toBe("none");
    expect(copyStatus(entry, undefined)).toBe("unknown");
    expect(copyStatus(entry, null)).toBe("deleted");
  });

  it("is current right after copying", () => {
    expect(copyStatus(copiedEntry(), source())).toBe("current");
  });

  it("is updated when the library changed since the copy and pulling would change something", () => {
    const changed = source({ updatedAt: LATER, fields: { ...source().fields, title: "Senior Engineer" } as never });
    expect(copyStatus(copiedEntry(), changed)).toBe("updated");
  });

  it("stays current when the library changed in ways this copy doesn't use", () => {
    // Only the unpicked bullet b3 and the unpicked wording b1v1 changed.
    const lib = source({ updatedAt: LATER });
    lib.bullets[2].variants[0].text = "Edited, but not in this resume";
    lib.bullets[0].variants[0].text = "Edited wording 1";
    expect(copyStatus(copiedEntry(), lib)).toBe("current");
  });

  it("ignores local edits while the library hasn't changed", () => {
    const edited = produce(copiedEntry(), (e) => void (e.title = "My own title"));
    expect(copyStatus(edited, source())).toBe("current");
  });
});

describe("copyChanges / applyLatest", () => {
  const lib = () => {
    const s = source({ updatedAt: LATER, fields: { ...source().fields, title: "Senior Engineer", location: "" } as never });
    s.bullets[0].variants[1].text = "Built a Flask API used by 200 students";
    s.bullets[1] = { id: "b2", variants: [{ id: "b2v9", text: "Led a team of four" }] }; // wording b2v1 deleted
    return s;
  };

  it("lists field and bullet changes as text", () => {
    expect(copyChanges(copiedEntry(), lib())).toEqual([
      { key: "title", label: "Title", before: "Engineer", after: "Senior Engineer" },
      { key: "location", label: "Location", before: "Remote", after: "" },
      { key: expect.stringMatching(/^bullet:/), label: "Bullet 1", before: "Built a Flask API", after: "Built a Flask API used by 200 students" },
      { key: expect.stringMatching(/^bullet:/), label: "Bullet 2", before: "Led a team", after: "Led a team of four" },
    ]);
  });

  it("applies them, keeps resume-only bullets and ids, and marks the copy current", () => {
    const before = copiedEntry();
    const after = produce(before, (e) => applyLatest(e, lib()));
    expect(after).toMatchObject({ title: "Senior Engineer", location: "", visible: true, id: before.id });
    expect(after.bullets.map((b) => [b.text, b.sourceVariantId])).toEqual([
      ["Built a Flask API used by 200 students", "b1v2"],
      ["Led a team of four", "b2v9"], // fell back to the bullet's remaining wording
      ["Resume-only bullet", null],
    ]);
    expect(after.bullets.map((b) => b.id)).toEqual(before.bullets.map((b) => b.id));
    expect(after.sourceItemUpdatedAt).toBe(LATER.toISOString());
    expect(copyStatus(after, lib())).toBe("current");
    expect(copyChanges(after, lib())).toEqual([]);
  });

  it("never overwrites a bullet edited in the resume", () => {
    const edited = produce(copiedEntry(), (e) => void (e.bullets[0].text = "My resume-only rewording"));
    expect(copyChanges(edited, lib()).map((c) => c.label)).toEqual(["Title", "Location", "Bullet 2"]);
    const after = produce(edited, (e) => applyLatest(e, lib()));
    expect(after.bullets[0]).toMatchObject({ text: "My resume-only rewording", sourceText: "Built a Flask API" });
  });

  it("leaves a bullet alone when its library bullet was deleted", () => {
    const s = lib();
    s.bullets = s.bullets.filter((b) => b.id !== "b1");
    const after = produce(copiedEntry(), (e) => applyLatest(e, s));
    expect(after.bullets[0]).toMatchObject({ text: "Built a Flask API", sourceBulletId: "b1" });
  });
});

describe("bulletSync", () => {
  it("tells resume edits, library changes and both apart", () => {
    const entry = copiedEntry();
    const fresh = source();
    expect(bulletSync(entry.bullets[0], fresh)).toEqual({ edited: false, libraryChanged: false, libraryText: "Built a Flask API" });

    const edited = produce(entry, (e) => void (e.bullets[0].text = "Rewritten here"));
    expect(bulletSync(edited.bullets[0], fresh)).toMatchObject({ edited: true, libraryChanged: false });

    const libChanged = source();
    libChanged.bullets[0].variants[1].text = "Rewritten in the library";
    expect(bulletSync(entry.bullets[0], libChanged)).toMatchObject({ edited: false, libraryChanged: true });
    expect(bulletSync(edited.bullets[0], libChanged)).toMatchObject({
      edited: true,
      libraryChanged: true,
      libraryText: "Rewritten in the library",
    });
  });

  it("is null for resume-only bullets, unloaded sources and deleted library bullets", () => {
    const entry = copiedEntry();
    expect(bulletSync(entry.bullets[2], source())).toBe(null);
    expect(bulletSync(entry.bullets[0], undefined)).toBe(null);
    expect(bulletSync(entry.bullets[0], source({ bullets: [] }))).toBe(null);
  });

  it("reports a deleted wording as a library change with no text to replace", () => {
    const s = source();
    s.bullets[0].variants = s.bullets[0].variants.filter((v) => v.id !== "b1v2");
    expect(bulletSync(copiedEntry().bullets[0], s)).toEqual({ edited: false, libraryChanged: true, libraryText: null });
  });
});

describe("defaultBulletChoices stays compatible with sync sources", () => {
  it("accepts a SyncSource", () => {
    expect(defaultBulletChoices(source())).toHaveLength(3);
  });
});
