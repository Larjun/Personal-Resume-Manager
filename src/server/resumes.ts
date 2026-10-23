import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { resumes } from "@/db/schema";
import {
  PageSizeSchema,
  ResumeContentSchema,
  ResumeIdSchema,
  type PageSize,
  type ResumeContent,
} from "@/lib/resume/schema";

// Read-side queries. Mutations live in ./actions.ts ("use server").

export type ResumeSummary = {
  id: string;
  title: string;
  pageSize: PageSize;
  updatedAt: Date;
};

export type Resume = ResumeSummary & { content: ResumeContent; createdAt: Date };

export async function listResumes(): Promise<ResumeSummary[]> {
  return db
    .select({
      id: resumes.id,
      title: resumes.title,
      pageSize: resumes.pageSize,
      updatedAt: resumes.updatedAt,
    })
    .from(resumes)
    .orderBy(desc(resumes.updatedAt));
}

export async function getResume(id: string): Promise<Resume | null> {
  // Malformed ids would make Postgres throw (invalid uuid); treat them as not found.
  if (!ResumeIdSchema.safeParse(id).success) return null;
  const [row] = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1);
  if (!row) return null;
  return {
    ...row,
    pageSize: PageSizeSchema.parse(row.pageSize),
    content: ResumeContentSchema.parse(row.content),
  };
}
