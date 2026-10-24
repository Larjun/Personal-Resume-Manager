import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import type { LibraryFields, LibraryKind, VariantSource } from "@/lib/library/schema";
import type { PageSize, ResumeContent } from "@/lib/resume/schema";

// Every user-data table: user_id → auth.users (cascade), indexed, and RLS on with
// no policies. Supabase's public Data API (anon/authenticated keys) can't read or
// write these tables. The server connects as the postgres role, which bypasses
// RLS, so access control is enforced in our server code (src/server/).

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    pageSize: text("page_size").$type<PageSize>().notNull().default("Letter"),
    content: jsonb("content").$type<ResumeContent>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resumes_user_id_idx").on(t.userId)],
).enableRLS();

export type ResumeRow = typeof resumes.$inferSelect;

/** Account-level data we own (auth.users belongs to Supabase). One row per user, created lazily. */
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type ProfileRow = typeof profiles.$inferSelect;

// ── Master library ─────────────────────────────────────────────────────
// item → bullets → variants, linked by foreign keys (deleting an item deletes
// its bullets and variants). Every table also carries user_id so each query
// can be scoped to the signed-in user without joins.

/** One experience, project, paper, school, skill group or summary. */
export const libraryItems = pgTable(
  "library_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    kind: text("kind").$type<LibraryKind>().notNull(),
    /** Shape depends on kind; validated by LIBRARY_FIELDS_SCHEMAS. */
    fields: jsonb("fields").$type<LibraryFields>().notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last change to fields, bullets or variants (resumes compare against it). */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("library_items_user_id_idx").on(t.userId)],
).enableRLS();

/** One bullet in an item's pool. Its wording lives in bullet_variants. */
export const libraryBullets = pgTable(
  "library_bullets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => libraryItems.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("library_bullets_user_id_idx").on(t.userId), index("library_bullets_item_id_idx").on(t.itemId)],
).enableRLS();

/** One wording of a bullet ("short", "detailed", an AI rewrite…). */
export const bulletVariants = pgTable(
  "bullet_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    bulletId: uuid("bullet_id")
      .notNull()
      .references(() => libraryBullets.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    label: text("label"),
    source: text("source").$type<VariantSource>().notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bullet_variants_user_id_idx").on(t.userId), index("bullet_variants_bullet_id_idx").on(t.bulletId)],
).enableRLS();

/**
 * Which library items each resume copied from. Derived from resumes.content
 * (the source of truth) and rewritten whenever a resume's content is saved, so
 * "Used in N resumes" is an indexed count instead of a scan of resume JSON.
 */
export const resumeItemLinks = pgTable(
  "resume_item_links",
  {
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => libraryItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.resumeId, t.itemId] }),
    index("resume_item_links_user_id_idx").on(t.userId),
    index("resume_item_links_item_id_idx").on(t.itemId),
  ],
).enableRLS();

export type LibraryItemRow = typeof libraryItems.$inferSelect;
export type LibraryBulletRow = typeof libraryBullets.$inferSelect;
export type BulletVariantRow = typeof bulletVariants.$inferSelect;
