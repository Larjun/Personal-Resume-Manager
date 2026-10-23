import type {
  Bullet,
  Degree,
  Entry,
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

export const newBullet = (text = ""): Bullet => ({ id: newId(), text });

export const newEntry = (): Entry => ({
  id: newId(),
  title: "",
  org: "",
  location: "",
  dates: { start: null, end: null },
  bullets: [newBullet()],
  visible: true,
});

export const newPaper = (): Paper => ({
  id: newId(),
  title: "",
  authors: "",
  venue: "",
  date: null,
  bullets: [],
  visible: true,
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
});

export const newSkillRow = (category = "", items: string[] = []): SkillRow => ({
  id: newId(),
  category,
  items,
});

export const DEFAULT_HEADINGS: Record<SectionType, string> = {
  summary: "Summary",
  entries: "Experience",
  publications: "Publications",
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
