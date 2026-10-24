import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
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
