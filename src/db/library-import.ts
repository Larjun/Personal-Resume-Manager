import { and, eq, inArray } from "drizzle-orm";
import { planResumeImport, type ImportPlan, type PlannedBullet } from "@/lib/library/import";
import { ResumeContentSchema, type ResumeContent } from "@/lib/resume/schema";
import type { db as Db } from "./index";
import { loadLibraryItems } from "./library-queries";
import { syncResumeLinks } from "./resume-links";
import { bulletVariants, libraryBullets, libraryItems, resumes } from "./schema";

/**
 * Imports one resume into its owner's library (see planResumeImport) in a
 * single transaction: inserts new items, appends bullets to matched items,
 * saves the resume with source ids, and rewrites its links. Not "server-only"
 * so scripts can run it; app code must pass the requireUser() id.
 * Returns the counts and the resume's content with its new source ids, or
 * null if the resume doesn't exist or isn't the user's.
 */
export async function importResumeIntoLibrary(
  db: typeof Db,
  userId: string,
  resumeId: string,
): Promise<{ counts: ImportPlan["counts"]; content: ResumeContent } | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ content: resumes.content })
      .from(resumes)
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .for("update");
    if (!row) return null;

    const now = new Date();
    const library = await loadLibraryItems(tx, userId);
    const plan = planResumeImport(ResumeContentSchema.parse(row.content), library, now);

    const bulletRows = (itemId: string, bullets: PlannedBullet[], start: number) =>
      bullets.map((b, i) => ({ id: b.id, userId, itemId, position: start + i, tags: b.tags }));
    const variantRows = (bullets: PlannedBullet[]) =>
      bullets.flatMap((b) =>
        b.variants.map((v, i) => ({ id: v.id, userId, bulletId: b.id, position: i, text: v.text, label: v.label, source: "user" as const })),
      );

    if (plan.create.length > 0) {
      await tx.insert(libraryItems).values(
        plan.create.map((c) => ({ id: c.id, userId, kind: c.kind, fields: c.fields, createdAt: now, updatedAt: now })),
      );
    }
    const newBullets = [
      ...plan.create.flatMap((c) => bulletRows(c.id, c.bullets, 0)),
      ...plan.append.flatMap((a) => {
        const existing = library.find((i) => i.id === a.itemId)!.bullets.length;
        return bulletRows(a.itemId, a.bullets, existing);
      }),
    ];
    const allPlanned = [...plan.create.flatMap((c) => c.bullets), ...plan.append.flatMap((a) => a.bullets)];
    if (newBullets.length > 0) await tx.insert(libraryBullets).values(newBullets);
    if (allPlanned.length > 0) await tx.insert(bulletVariants).values(variantRows(allPlanned));
    if (plan.append.length > 0) {
      await tx
        .update(libraryItems)
        .set({ updatedAt: now })
        .where(and(eq(libraryItems.userId, userId), inArray(libraryItems.id, plan.append.map((a) => a.itemId))));
    }

    if (plan.counts.created + plan.counts.linked > 0) {
      await tx.update(resumes).set({ content: plan.content, updatedAt: now }).where(eq(resumes.id, resumeId));
    }
    await syncResumeLinks(tx, userId, resumeId, plan.content);
    return { counts: plan.counts, content: plan.content };
  });
}
