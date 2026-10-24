import type {
  Bullet,
  Degree,
  Entry,
  EntryKind,
  Link,
  Paper,
  ResumeContent,
  School,
  Section,
  SectionType,
  SkillRow,
} from "./schema";
import { CONTENT_VERSION } from "./schema";

export const newId = () => crypto.randomUUID();

export const newLink = (text = "", url = ""): Link => ({ id: newId(), text, url });

/** Source fields for an item that wasn't copied from the library. */
export const NO_ITEM_SOURCE = { sourceItemId: null, sourceItemUpdatedAt: null } as const;

export const NO_BULLET_SOURCE = { sourceBulletId: null, sourceVariantId: null, sourceText: null } as const;

export const newBullet = (text = ""): Bullet => ({ id: newId(), text, ...NO_BULLET_SOURCE });

export const newEntry = (): Entry => ({
  id: newId(),
  title: "",
  org: "",
  location: "",
  dates: { start: null, end: null },
  bullets: [newBullet()],
  visible: true,
  ...NO_ITEM_SOURCE,
});

export const newPaper = (): Paper => ({
  id: newId(),
  title: "",
  authors: "",
  venue: "",
  date: null,
  bullets: [],
  visible: true,
  ...NO_ITEM_SOURCE,
});

export const newDegree = (): Degree => ({
  id: newId(),
  name: "",
  dates: { start: null, end: null },
});

export const newSchool = (): School => ({
  id: newId(),
  school: "",
  location: "",
  degrees: [newDegree()],
  ...NO_ITEM_SOURCE,
});

export const newSkillRow = (category = "", items: string[] = []): SkillRow => ({
  id: newId(),
  category,
  items,
  ...NO_ITEM_SOURCE,
});

export const DEFAULT_HEADINGS: Record<SectionType, string> = {
  summary: "Summary",
  entries: "Experience",
  publications: "Publications",
  education: "Education",
  skills: "Skills",
};

/** An Experience or Projects section with one blank entry. */
export function newEntriesSection(entryKind: EntryKind, heading = entryKind === "project" ? "Projects" : "Experience"): Section {
  return { id: newId(), heading, type: "entries", entryKind, entries: [newEntry()] };
}

/** A section of `type`; an "entries" section is Experience (see newEntriesSection). */
export function newSection(type: SectionType, heading = DEFAULT_HEADINGS[type]): Section {
  const base = { id: newId(), heading };
  switch (type) {
    case "summary":
      return { ...base, type, text: "", ...NO_ITEM_SOURCE };
    case "entries":
      return newEntriesSection("experience", heading);
    case "publications":
      return { ...base, type, papers: [newPaper()] };
    case "education":
      return { ...base, type, schools: [newSchool()] };
    case "skills":
      return { ...base, type, rows: [newSkillRow()] };
  }
}

export function emptyResume(): ResumeContent {
  return {
    version: CONTENT_VERSION,
    settings: { dateFormat: "long" },
    header: { name: "Your Name", email: "you@example.com", location: "", phone: "", links: [] },
    sections: [
      newSection("summary"),
      newSection("entries", "Experience"),
      newSection("education"),
      newSection("skills"),
    ],
  };
}

/**
 * Deep copy with fresh ids for every entity (used by duplicate). Only `id`
 * keys change: source fields still point at the same library items.
 */
export function cloneWithNewIds(content: ResumeContent): ResumeContent {
  const copy = structuredClone(content);
  const reId = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(reId);
    else if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (typeof obj.id === "string") obj.id = newId();
      Object.values(obj).forEach(reId);
    }
  };
  reId(copy);
  return copy;
}
