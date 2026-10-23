"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { resumes } from "@/db/schema";
import { cloneWithNewIds, emptyResume, newId } from "@/lib/resume/factories";
import { PageSizeSchema, ResumeContentSchema, ResumeIdSchema, ResumeTitleSchema } from "@/lib/resume/schema";
import { getResume } from "./resumes";

export async function createResume(title: string): Promise<string> {
  const now = new Date();
  const id = newId();
  await db.insert(resumes).values({
    id,
    title: ResumeTitleSchema.parse(title || "Untitled resume"),
    pageSize: "Letter",
    content: emptyResume(),
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath("/");
  return id;
}

export async function renameResume(id: string, title: string): Promise<void> {
  await db
    .update(resumes)
    .set({ title: ResumeTitleSchema.parse(title), updatedAt: new Date() })
    .where(eq(resumes.id, ResumeIdSchema.parse(id)));
  revalidatePath("/");
}

export async function duplicateResume(id: string): Promise<string | null> {
  const source = await getResume(ResumeIdSchema.parse(id));
  if (!source) return null;
  const now = new Date();
  const copyId = newId();
  await db.insert(resumes).values({
    id: copyId,
    title: `${source.title} (copy)`.slice(0, 200),
    pageSize: source.pageSize,
    content: cloneWithNewIds(source.content),
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath("/");
  return copyId;
}

export async function deleteResume(id: string): Promise<void> {
  await db.delete(resumes).where(eq(resumes.id, ResumeIdSchema.parse(id)));
  revalidatePath("/");
}

const SavePatchSchema = z.object({
  title: ResumeTitleSchema.optional(),
  pageSize: PageSizeSchema.optional(),
  content: ResumeContentSchema.optional(),
});

/** Editor autosave. Does not revalidate: the editor owns its state client-side. */
export async function saveResume(
  id: string,
  patch: z.input<typeof SavePatchSchema>,
): Promise<{ updatedAt: Date }> {
  const data = SavePatchSchema.parse(patch);
  const updatedAt = new Date();
  await db
    .update(resumes)
    .set({ ...data, updatedAt })
    .where(eq(resumes.id, ResumeIdSchema.parse(id)));
  return { updatedAt };
}
