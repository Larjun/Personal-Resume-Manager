import type {
  Bullet,
  Contact,
  Degree,
  Entry,
  ResumeContent,
  School,
  Section,
  SectionType,
  SkillRow,
} from "./schema";

export const newId = () => crypto.randomUUID();

export const newContact = (text = "", url?: string): Contact => ({
  id: newId(),
  text,
  ...(url ? { url } : {}),
});

export const newBullet = (text = ""): Bullet => ({ id: newId(), text });

export const newEntry = (): Entry => ({
  id: newId(),
  title: "",
  org: "",
  location: "",
  dates: { start: "", end: "" },
  bullets: [newBullet()],
});

export const newDegree = (): Degree => ({
  id: newId(),
  name: "",
  dates: { start: "", end: "" },
});

export const newSchool = (): School => ({
  id: newId(),
  school: "",
  location: "",
  degrees: [newDegree()],
});

export const newSkillRow = (category = "", items: string[] = []): SkillRow => ({
  id: newId(),
  category,
  items,
});

export const DEFAULT_HEADINGS: Record<SectionType, string> = {
  summary: "Summary",
  entries: "Experience",
  education: "Education",
  skills: "Skills",
};

export function newSection(type: SectionType, heading = DEFAULT_HEADINGS[type]): Section {
  const base = { id: newId(), heading };
  switch (type) {
    case "summary":
      return { ...base, type, text: "" };
    case "entries":
      return { ...base, type, entries: [newEntry()] };
    case "education":
      return { ...base, type, schools: [newSchool()] };
    case "skills":
      return { ...base, type, rows: [newSkillRow()] };
  }
}

export function emptyResume(): ResumeContent {
  return {
    version: 1,
    header: { name: "Your Name", contacts: [newContact("email@example.com")] },
    sections: [
      newSection("summary"),
      newSection("entries", "Experience"),
      newSection("education"),
      newSection("skills"),
    ],
  };
}

/** Deep copy with fresh ids for every entity (used by duplicate). */
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
