import { z } from "zod";
import { DATE_FORMATS } from "./dates";
import { migrateContent } from "./migrate";

export const PAGE_SIZES = ["Letter", "A4"] as const;
export const PageSizeSchema = z.enum(PAGE_SIZES);
export type PageSize = z.infer<typeof PageSizeSchema>;

const Id = z.string().min(1);

/** Month is optional (year-only dates); 1 = January. */
export const YearMonthSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12).nullable(),
});

export const DateRangeSchema = z.object({
  start: YearMonthSchema.nullable(),
  end: z.union([YearMonthSchema, z.literal("present")]).nullable(),
});

export const DateFormatSchema = z.enum(DATE_FORMATS);

export const SettingsSchema = z.object({
  /** One format for every date on the resume. */
  dateFormat: DateFormatSchema,
});

export const LinkSchema = z.object({
  id: Id,
  /** Shown on the resume; falls back to the URL without its protocol. */
  text: z.string(),
  url: z.string(),
});

export const HeaderSchema = z.object({
  name: z.string(),
  // Plain text, rendered in this order on the contact line, then the links.
  email: z.string(),
  location: z.string(),
  phone: z.string(),
  links: z.array(LinkSchema),
});

/**
 * Where a copied item came from in the master library. Resume content is a
 * self-contained copy; these ids only drive "Library updated" / "Pull latest".
 */
const itemSource = {
  sourceItemId: Id.nullable(),
  /** The library item's updatedAt when it was copied (ISO string). */
  sourceItemUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
};

export const BulletSchema = z.object({
  id: Id,
  /** The resume's own copy of the text. */
  text: z.string(),
  sourceBulletId: Id.nullable(),
  sourceVariantId: Id.nullable(),
  /**
   * The library wording's text when it was copied (or last pulled / pushed).
   * text ≠ sourceText: edited in this resume. Library text ≠ sourceText: the
   * library wording changed. Resume edits never reach the library on their own.
   */
  sourceText: z.string().nullable(),
});

export const EntrySchema = z.object({
  id: Id,
  title: z.string(),
  org: z.string(),
  location: z.string(),
  dates: DateRangeSchema,
  bullets: z.array(BulletSchema),
  /** Unchecked entries stay in the editor but are left out of the resume. */
  visible: z.boolean().default(true),
  ...itemSource,
});

export const PaperSchema = z.object({
  id: Id,
  title: z.string(),
  authors: z.string(),
  /** Journal, conference or preprint server. */
  venue: z.string(),
  date: YearMonthSchema.nullable(),
  /** DOI, arXiv or publisher link; the title links to it. */
  url: z.string().optional(),
  bullets: z.array(BulletSchema),
  visible: z.boolean().default(true),
  ...itemSource,
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
  ...itemSource,
});

export const SkillRowSchema = z.object({
  id: Id,
  category: z.string(),
  items: z.array(z.string()),
  ...itemSource,
});

const sectionBase = { id: Id, heading: z.string() };

export const SummarySectionSchema = z.object({
  ...sectionBase,
  type: z.literal("summary"),
  text: z.string(),
  ...itemSource,
});

export const ENTRY_KINDS = ["experience", "project"] as const;
export const EntryKindSchema = z.enum(ENTRY_KINDS);

export const EntriesSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("entries"),
  /** Experience or projects. Fixed per section; the library picker offers only this kind. */
  entryKind: EntryKindSchema,
  entries: z.array(EntrySchema),
});

export const PublicationsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("publications"),
  papers: z.array(PaperSchema),
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
  PublicationsSectionSchema,
  EducationSectionSchema,
  SkillsSectionSchema,
]);

export const CONTENT_VERSION = 6;

const CurrentContentSchema = z.object({
  version: z.literal(CONTENT_VERSION),
  settings: SettingsSchema,
  header: HeaderSchema,
  sections: z.array(SectionSchema),
});

/** Accepts any stored version and returns current-version content. */
export const ResumeContentSchema = z.preprocess(migrateContent, CurrentContentSchema);

export type YearMonth = z.infer<typeof YearMonthSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type Header = z.infer<typeof HeaderSchema>;
export type Bullet = z.infer<typeof BulletSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type Paper = z.infer<typeof PaperSchema>;
export type Degree = z.infer<typeof DegreeSchema>;
export type School = z.infer<typeof SchoolSchema>;
export type SkillRow = z.infer<typeof SkillRowSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type EntryKind = z.infer<typeof EntryKindSchema>;
export type SectionType = Section["type"];
export type ResumeContent = z.infer<typeof CurrentContentSchema>;

export const ResumeIdSchema = z.uuid();

export const ResumeTitleSchema = z.string().trim().min(1).max(200);
