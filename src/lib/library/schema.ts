import { z } from "zod";
import { EntrySchema, PaperSchema, SchoolSchema, SkillRowSchema, SummarySectionSchema } from "@/lib/resume/schema";
import { MAX_TAG_LENGTH, normalizeTags } from "@/lib/tags";

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

/** An item's kind together with its fields, narrowed by `kind`. */
export type LibraryItemData = { [K in LibraryKind]: { kind: K; fields: LibraryFields<K> } }[LibraryKind];

/** Kinds that have a bullet pool (the others are fields only). */
export const KINDS_WITH_BULLETS: readonly LibraryKind[] = ["experience", "project", "publication"];

export const VARIANT_SOURCES = ["user", "ai"] as const;
export type VariantSource = (typeof VARIANT_SOURCES)[number];

export const LibraryItemIdSchema = z.uuid();

export const TagsSchema = z.array(z.string().max(MAX_TAG_LENGTH * 4)).max(200).transform(normalizeTags);

// ── Bullet pool, as the editor sends it ────────────────────────────────
// Ids are created client-side (crypto.randomUUID) like every other entity.
// Array order is the stored order. `source` is server-controlled: new variants
// saved by the editor are "user"; existing ones keep theirs.

export const MAX_BULLETS_PER_ITEM = 200;
export const MAX_VARIANTS_PER_BULLET = 20;

export const VariantInputSchema = z.object({
  id: z.uuid(),
  text: z.string().max(2000),
  /** Optional, e.g. "short" or "detailed". Blank means no label. */
  label: z
    .string()
    .max(40)
    .nullable()
    .transform((l) => l?.trim() || null),
});

export const BulletInputSchema = z.object({
  id: z.uuid(),
  tags: TagsSchema,
  variants: z.array(VariantInputSchema).min(1).max(MAX_VARIANTS_PER_BULLET),
});

export const BulletPoolInputSchema = z
  .array(BulletInputSchema)
  .max(MAX_BULLETS_PER_ITEM)
  .refine((bullets) => {
    const ids = bullets.flatMap((b) => [b.id, ...b.variants.map((v) => v.id)]);
    return new Set(ids).size === ids.length;
  }, "Duplicate bullet or variant id");

export type VariantInput = z.output<typeof VariantInputSchema>;
export type BulletInput = z.output<typeof BulletInputSchema>;
