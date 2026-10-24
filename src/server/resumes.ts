import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { resumes } from "@/db/schema";
import {
  PageSizeSchema,
  ResumeContentSchema,
  ResumeIdSchema,
  type PageSize,
  type ResumeContent,
} from "@/lib/resume/schema";
import { requireUser } from "./auth";

// Read-side queries. Mutations live in ./actions.ts ("use server").
// Every query is scoped to the signed-in user (requireUser()).

export type ResumeSummary = {
  id: string;
  title: string;
  pageSize: PageSize;
  updatedAt: Date;
};

export type Resume = ResumeSummary & { content: ResumeContent; createdAt: Date };

export async function listResumes(): Promise<ResumeSummary[]> {
  const user = await requireUser();
  return db
    .select({
      id: resumes.id,
      title: resumes.title,
      pageSize: resumes.pageSize,
      updatedAt: resumes.updatedAt,
    })
    .from(resumes)
    .where(eq(resumes.userId, user.id))
    .orderBy(desc(resumes.updatedAt));
}

/** The user's resume, or null if it doesn't exist or belongs to someone else. */
export async function getResume(id: string): Promise<Resume | null> {
  const user = await requireUser();
  // Malformed ids would make Postgres throw (invalid uuid); treat them as not found.
  if (!ResumeIdSchema.safeParse(id).success) return null;
  const [row] = await db
    .select({
      id: resumes.id,
      title: resumes.title,
      pageSize: resumes.pageSize,
      content: resumes.content,
      createdAt: resumes.createdAt,
      updatedAt: resumes.updatedAt,
    })
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    pageSize: PageSizeSchema.parse(row.pageSize),
    content: ResumeContentSchema.parse(row.content),
  };
}
