import { z } from "zod";
import { EntrySchema, PaperSchema, SchoolSchema, SkillRowSchema, SummarySectionSchema } from "@/lib/resume/schema";

/**
 * The master library: everything the user has done, stored once. Resumes copy
 * items out of it (see the source fields on the content schemas). Field shapes
 * reuse the resume content schemas, so copying is a plain field-for-field copy.
 */

export const LIBRARY_KINDS = ["experience", "project", "publication", "education", "skills", "summary"] as const;
export const LibraryKindSchema = z.enum(LIBRARY_KINDS);
export type LibraryKind = z.infer<typeof LibraryKindSchema>;

/** Experience and project both map to the resume's "entries" section. */
const EntryFieldsSchema = EntrySchema.pick({ title: true, org: true, location: true, dates: true });
const PaperFieldsSchema = PaperSchema.pick({ title: true, authors: true, venue: true, date: true, url: true });
const SchoolFieldsSchema = SchoolSchema.pick({ school: true, location: true, degrees: true });
const SkillsFieldsSchema = SkillRowSchema.pick({ category: true, items: true });
const SummaryFieldsSchema = SummarySectionSchema.pick({ text: true });

export const LIBRARY_FIELDS_SCHEMAS = {
  experience: EntryFieldsSchema,
  project: EntryFieldsSchema,
  publication: PaperFieldsSchema,
  education: SchoolFieldsSchema,
  skills: SkillsFieldsSchema,
  summary: SummaryFieldsSchema,
} satisfies Record<LibraryKind, z.ZodType>;

export type LibraryFields<K extends LibraryKind = LibraryKind> = z.infer<(typeof LIBRARY_FIELDS_SCHEMAS)[K]>;

/** Kinds that have a bullet pool (the others are fields only). */
export const KINDS_WITH_BULLETS: readonly LibraryKind[] = ["experience", "project", "publication"];

export const VARIANT_SOURCES = ["user", "ai"] as const;
export type VariantSource = (typeof VARIANT_SOURCES)[number];

export const LibraryItemIdSchema = z.uuid();
