import { z } from "zod";

export const PAGE_SIZES = ["Letter", "A4"] as const;
export const PageSizeSchema = z.enum(PAGE_SIZES);
export type PageSize = z.infer<typeof PageSizeSchema>;

const Id = z.string().min(1);

export const DateRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
});

export const ContactSchema = z.object({
  id: Id,
  text: z.string(),
  url: z.string().optional(),
});

export const HeaderSchema = z.object({
  name: z.string(),
  contacts: z.array(ContactSchema),
});

export const BulletSchema = z.object({
  id: Id,
  text: z.string(),
});

export const EntrySchema = z.object({
  id: Id,
  title: z.string(),
  org: z.string(),
  location: z.string(),
  dates: DateRangeSchema,
  bullets: z.array(BulletSchema),
});

export const DegreeSchema = z.object({
  id: Id,
  name: z.string(),
  dates: DateRangeSchema,
});

export const SchoolSchema = z.object({
  id: Id,
  school: z.string(),
  location: z.string(),
  degrees: z.array(DegreeSchema),
});

export const SkillRowSchema = z.object({
  id: Id,
  category: z.string(),
  items: z.array(z.string()),
});

const sectionBase = { id: Id, heading: z.string() };

export const SummarySectionSchema = z.object({
  ...sectionBase,
  type: z.literal("summary"),
  text: z.string(),
});

export const EntriesSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("entries"),
  entries: z.array(EntrySchema),
});

export const EducationSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("education"),
  schools: z.array(SchoolSchema),
});

export const SkillsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("skills"),
  rows: z.array(SkillRowSchema),
});

export const SectionSchema = z.discriminatedUnion("type", [
  SummarySectionSchema,
  EntriesSectionSchema,
  EducationSectionSchema,
  SkillsSectionSchema,
]);

export const ResumeContentSchema = z.object({
  version: z.literal(1),
  header: HeaderSchema,
  sections: z.array(SectionSchema),
});

export type DateRange = z.infer<typeof DateRangeSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Header = z.infer<typeof HeaderSchema>;
export type Bullet = z.infer<typeof BulletSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type Degree = z.infer<typeof DegreeSchema>;
export type School = z.infer<typeof SchoolSchema>;
export type SkillRow = z.infer<typeof SkillRowSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type SectionType = Section["type"];
export type ResumeContent = z.infer<typeof ResumeContentSchema>;

export const ResumeIdSchema = z.uuid();

export const ResumeTitleSchema = z.string().trim().min(1).max(200);
