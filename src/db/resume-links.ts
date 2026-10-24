import { and, eq, inArray } from "drizzle-orm";
import { sourceItemIds } from "@/lib/library/links";
import type { ResumeContent } from "@/lib/resume/schema";
import type { db } from "./index";
import { libraryItems, resumeItemLinks } from "./schema";

/** The db client or a transaction handle. */
export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Rewrites one resume's resume_item_links rows from its content, which is the
 * source of truth. Ids of items that were deleted or belong to someone else are
 * skipped. Not "server-only" so the seed script can use it; callers pass the
 * user id they've already authorized.
 */
export async function syncResumeLinks(tx: DbOrTx, userId: string, resumeId: string, content: ResumeContent) {
  const wanted = sourceItemIds(content);
  const current = await tx
    .select({ itemId: resumeItemLinks.itemId })
    .from(resumeItemLinks)
    .where(and(eq(resumeItemLinks.resumeId, resumeId), eq(resumeItemLinks.userId, userId)));
  const have = new Set(current.map((r) => r.itemId));

  const removed = [...have].filter((id) => !wanted.includes(id));
  const added = wanted.filter((id) => !have.has(id));
  if (removed.length > 0) {
    await tx
      .delete(resumeItemLinks)
      .where(and(eq(resumeItemLinks.resumeId, resumeId), inArray(resumeItemLinks.itemId, removed)));
  }
  if (added.length === 0) return;

  const existing = await tx
    .select({ id: libraryItems.id })
    .from(libraryItems)
    .where(and(eq(libraryItems.userId, userId), inArray(libraryItems.id, added)));
  if (existing.length > 0) {
    await tx
      .insert(resumeItemLinks)
      .values(existing.map(({ id }) => ({ resumeId, itemId: id, userId })))
      .onConflictDoNothing();
  }
}
