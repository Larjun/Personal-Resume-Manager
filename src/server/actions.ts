"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { resumes } from "@/db/schema";
import { cloneWithNewIds, emptyResume, newId } from "@/lib/resume/factories";
import { PageSizeSchema, ResumeContentSchema, ResumeIdSchema, ResumeTitleSchema } from "@/lib/resume/schema";
import { requireUser } from "./auth";
import { getResume } from "./resumes";

// Every action starts with requireUser() and scopes its query to that user's rows.

/** WHERE clause for "this resume, and only if the user owns it". */
function ownResume(id: string, userId: string) {
  return and(eq(resumes.id, ResumeIdSchema.parse(id)), eq(resumes.userId, userId));
}

export async function createResume(title: string): Promise<string> {
  const user = await requireUser();
  const now = new Date();
  const id = newId();
  await db.insert(resumes).values({
    id,
    userId: user.id,
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
  const user = await requireUser();
  await db
    .update(resumes)
    .set({ title: ResumeTitleSchema.parse(title), updatedAt: new Date() })
    .where(ownResume(id, user.id));
  revalidatePath("/");
}

export async function duplicateResume(id: string): Promise<string | null> {
  const user = await requireUser();
  // getResume is scoped to the same user, so someone else's id returns null.
  const source = await getResume(ResumeIdSchema.parse(id));
  if (!source) return null;
  const now = new Date();
  const copyId = newId();
  await db.insert(resumes).values({
    id: copyId,
    userId: user.id,
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
  const user = await requireUser();
  await db.delete(resumes).where(ownResume(id, user.id));
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
  const user = await requireUser();
  const data = SavePatchSchema.parse(patch);
  const updatedAt = new Date();
  const saved = await db
    .update(resumes)
    .set({ ...data, updatedAt })
    .where(ownResume(id, user.id))
    .returning({ id: resumes.id });
  // Not found or not ours: fail loudly so the editor shows a save error instead of "Saved".
  if (saved.length === 0) throw new Error("Resume not found.");
  return { updatedAt };
}
