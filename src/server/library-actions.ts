"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { loadLibraryItems, type LibraryItem } from "@/db/library-queries";
import type { DbOrTx } from "@/db/resume-links";
import { bulletVariants, libraryBullets, libraryItems } from "@/db/schema";
import { emptyLibraryItem, newLibraryBullet } from "@/lib/library/factories";
import { planPoolWrites, poolSignature, storedPool, type PoolWritePlan } from "@/lib/library/pool";
import {
  BulletPoolInputSchema,
  KINDS_WITH_BULLETS,
  LIBRARY_FIELDS_SCHEMAS,
  LibraryItemIdSchema,
  LibraryKindSchema,
  MAX_VARIANTS_PER_BULLET,
  TagsSchema,
} from "@/lib/library/schema";
import { newId } from "@/lib/resume/factories";
import { requireUser } from "./auth";

// Every action starts with requireUser() and scopes its queries to that user's rows.

/** WHERE clause for "this library item, and only if the user owns it". */
function ownItem(id: string, userId: string) {
  return and(eq(libraryItems.id, LibraryItemIdSchema.parse(id)), eq(libraryItems.userId, userId));
}

/** The user's whole library, for the resume editor's "Add from library" drawer (loaded when it opens). */
export async function fetchLibraryItems(): Promise<LibraryItem[]> {
  const user = await requireUser();
  return loadLibraryItems(db, user.id);
}

/** Like fetchLibraryItems, but only the items a resume copied from (its sync badges refresh with this). */
export async function fetchLibrarySources(ids: string[]): Promise<LibraryItem[]> {
  const user = await requireUser();
  const valid = z.array(z.string()).max(500).parse(ids).filter((id) => LibraryItemIdSchema.safeParse(id).success);
  return loadLibraryItems(db, user.id, valid);
}

/** Creates a blank item (with one empty bullet if the kind has a pool). Returns its id. */
export async function createLibraryItem(kind: string): Promise<string> {
  const user = await requireUser();
  const { kind: k, fields } = emptyLibraryItem(LibraryKindSchema.parse(kind));
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(libraryItems).values({ id, userId: user.id, kind: k, fields });
    if (KINDS_WITH_BULLETS.includes(k)) await writePool(tx, user.id, id, planPoolWrites({ bullets: [], variants: [] }, [newLibraryBullet()]));
  });
  revalidatePath("/library");
  return id;
}

/** Deletes an item and its pool. Resumes keep their copies (their links cascade away). */
export async function deleteLibraryItem(id: string): Promise<void> {
  const user = await requireUser();
  await db.delete(libraryItems).where(ownItem(id, user.id));
  revalidatePath("/library");
}

const SavePatchSchema = z.object({
  /** Validated against the item's kind once the item is loaded. */
  fields: z.unknown().optional(),
  tags: TagsSchema.optional(),
  bullets: BulletPoolInputSchema.optional(),
});

/**
 * Library editor autosave: any of fields, tags and the whole bullet pool, in one
 * transaction. `updatedAt` moves only when something a resume copies changed
 * (fields, bullet order, variant text or labels), never for tag edits, so
 * retagging doesn't flag resumes as "Library updated". Does not revalidate:
 * the editor owns its state client-side.
 */
export async function saveLibraryItem(
  id: string,
  patch: z.input<typeof SavePatchSchema>,
): Promise<{ updatedAt: Date }> {
  const user = await requireUser();
  const data = SavePatchSchema.parse(patch);

  return db.transaction(async (tx) => {
    // Row lock: two tabs saving the same item can't interleave their pool writes.
    const [item] = await tx
      .select({ id: libraryItems.id, kind: libraryItems.kind, fields: libraryItems.fields, updatedAt: libraryItems.updatedAt })
      .from(libraryItems)
      .where(ownItem(id, user.id))
      .for("update");
    // Not found or not ours: fail loudly so the editor shows a save error instead of "Saved".
    if (!item) throw new Error("Library item not found.");

    const kind = LibraryKindSchema.parse(item.kind);
    const set: Partial<typeof libraryItems.$inferInsert> = {};
    let contentChanged = false;

    if (data.fields !== undefined) {
      const schema = LIBRARY_FIELDS_SCHEMAS[kind];
      const fields = schema.parse(data.fields);
      // Both sides go through the same schema, so key order matches and JSON comparison is exact.
      const before = schema.safeParse(item.fields);
      if (!before.success || JSON.stringify(before.data) !== JSON.stringify(fields)) {
        set.fields = fields;
        contentChanged = true;
      }
    }

    if (data.tags) set.tags = data.tags;

    if (data.bullets) {
      if (!KINDS_WITH_BULLETS.includes(kind) && data.bullets.length > 0) {
        throw new Error(`A ${kind} item has no bullets.`);
      }
      const stored = await loadStoredPool(tx, user.id, item.id);
      if (poolSignature(storedPool(stored)) !== poolSignature(data.bullets)) contentChanged = true;
      await writePool(tx, user.id, item.id, planPoolWrites(stored, data.bullets));
    }

    const updatedAt = contentChanged ? new Date() : item.updatedAt;
    if (contentChanged) set.updatedAt = updatedAt;
    if (Object.keys(set).length > 0) await tx.update(libraryItems).set(set).where(ownItem(item.id, user.id));
    return { updatedAt };
  });
}

const PushBulletSchema = z.object({
  bulletId: z.uuid(),
  /** The wording the resume bullet came from; required to replace it. */
  variantId: z.uuid().nullable(),
  text: z.string().max(2000).refine((t) => t.trim().length > 0, "Bullet text is empty"),
  mode: z.enum(["replace", "variant"]),
});

/**
 * "Update library" on a bullet edited in a resume: replace the library wording
 * it came from, or save the text as a new wording of that library bullet.
 * The only way resume edits reach the library. Marks the item updated, so
 * other resumes using a replaced wording see "Library updated".
 * Returns the wording the resume bullet now points at.
 */
export async function pushBulletToLibrary(input: z.input<typeof PushBulletSchema>): Promise<{ variantId: string }> {
  const user = await requireUser();
  const { bulletId, variantId, text, mode } = PushBulletSchema.parse(input);

  return db.transaction(async (tx) => {
    const [bullet] = await tx
      .select({ id: libraryBullets.id, itemId: libraryBullets.itemId })
      .from(libraryBullets)
      .where(and(eq(libraryBullets.id, bulletId), eq(libraryBullets.userId, user.id)))
      .for("update");
    if (!bullet) throw new Error("That bullet is no longer in your library.");

    let id: string;
    if (mode === "replace") {
      if (!variantId) throw new Error("No library wording to replace.");
      const updated = await tx
        .update(bulletVariants)
        .set({ text })
        .where(and(eq(bulletVariants.id, variantId), eq(bulletVariants.bulletId, bullet.id), eq(bulletVariants.userId, user.id)))
        .returning({ id: bulletVariants.id });
      if (updated.length === 0) throw new Error("That wording is no longer in your library.");
      id = variantId;
    } else {
      const existing = await tx
        .select({ id: bulletVariants.id })
        .from(bulletVariants)
        .where(and(eq(bulletVariants.bulletId, bullet.id), eq(bulletVariants.userId, user.id)));
      if (existing.length >= MAX_VARIANTS_PER_BULLET) {
        throw new Error(`A bullet can have at most ${MAX_VARIANTS_PER_BULLET} wordings.`);
      }
      const [{ last }] = await tx
        .select({ last: max(bulletVariants.position) })
        .from(bulletVariants)
        .where(eq(bulletVariants.bulletId, bullet.id));
      id = newId();
      await tx
        .insert(bulletVariants)
        .values({ id, userId: user.id, bulletId: bullet.id, position: (last ?? -1) + 1, text, label: null, source: "user" });
    }

    await tx
      .update(libraryItems)
      .set({ updatedAt: new Date() })
      .where(and(eq(libraryItems.id, bullet.itemId), eq(libraryItems.userId, user.id)));
    return { variantId: id };
  });
}

async function loadStoredPool(tx: DbOrTx, userId: string, itemId: string) {
  const bullets = await tx
    .select({ id: libraryBullets.id, position: libraryBullets.position, tags: libraryBullets.tags })
    .from(libraryBullets)
    .where(and(eq(libraryBullets.itemId, itemId), eq(libraryBullets.userId, userId)));
  const variants =
    bullets.length === 0
      ? []
      : await tx
          .select({
            id: bulletVariants.id,
            bulletId: bulletVariants.bulletId,
            position: bulletVariants.position,
            text: bulletVariants.text,
            label: bulletVariants.label,
          })
          .from(bulletVariants)
          .where(
            and(
              eq(bulletVariants.userId, userId),
              inArray(
                bulletVariants.bulletId,
                bullets.map((b) => b.id),
              ),
            ),
          );
  return { bullets, variants };
}

/**
 * Applies a write plan. Inserts use the client's ids, so an id that already
 * exists elsewhere fails on its primary key and rolls the transaction back.
 */
async function writePool(tx: DbOrTx, userId: string, itemId: string, plan: PoolWritePlan) {
  const ownBullet = (id: string) =>
    and(eq(libraryBullets.id, id), eq(libraryBullets.itemId, itemId), eq(libraryBullets.userId, userId));
  const ownVariant = (id: string) => and(eq(bulletVariants.id, id), eq(bulletVariants.userId, userId));

  if (plan.deleteBulletIds.length > 0) {
    await tx
      .delete(libraryBullets)
      .where(
        and(
          inArray(libraryBullets.id, plan.deleteBulletIds),
          eq(libraryBullets.itemId, itemId),
          eq(libraryBullets.userId, userId),
        ),
      );
  }
  if (plan.deleteVariantIds.length > 0) {
    await tx
      .delete(bulletVariants)
      .where(and(inArray(bulletVariants.id, plan.deleteVariantIds), eq(bulletVariants.userId, userId)));
  }
  // Bullets before variants: a new variant may belong to a new bullet.
  if (plan.insertBullets.length > 0) {
    await tx.insert(libraryBullets).values(plan.insertBullets.map((b) => ({ ...b, userId, itemId })));
  }
  for (const { id, position, tags } of plan.updateBullets) {
    await tx.update(libraryBullets).set({ position, tags }).where(ownBullet(id));
  }
  if (plan.insertVariants.length > 0) {
    await tx.insert(bulletVariants).values(plan.insertVariants.map((v) => ({ ...v, userId, source: "user" as const })));
  }
  for (const { id, ...rest } of plan.updateVariants) {
    await tx.update(bulletVariants).set(rest).where(ownVariant(id));
  }
}
