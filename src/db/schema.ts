import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { PageSize, ResumeContent } from "@/lib/resume/schema";

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Owner (Supabase auth.users.id). Nullable until auth lands; no FK yet
  // because auth.users is managed by Supabase, not by our migrations.
  userId: uuid("user_id"),
  title: text("title").notNull(),
  pageSize: text("page_size").$type<PageSize>().notNull().default("Letter"),
  content: jsonb("content").$type<ResumeContent>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
  // RLS on with no policies: Supabase's public Data API (anon/authenticated keys)
  // can't read or write this table. The server connects as the postgres role,
  // which bypasses RLS, so access control is enforced in our server code.
  .enableRLS();

export type ResumeRow = typeof resumes.$inferSelect;
