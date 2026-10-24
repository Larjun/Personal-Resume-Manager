import type { BulletInput } from "./schema";

/**
 * Diffing for saveLibraryItem: what the editor sent vs. the rows in the DB.
 * Pure, so the write plan and the "did content change" rule are unit-tested.
 */

export type StoredBullet = { id: string; position: number; tags: string[] };
export type StoredVariant = { id: string; bulletId: string; position: number; text: string; label: string | null };

export type BulletRowWrite = { id: string; position: number; tags: string[] };
export type VariantRowWrite = { id: string; bulletId: string; position: number; text: string; label: string | null };

export type PoolWritePlan = {
  insertBullets: BulletRowWrite[];
  updateBullets: BulletRowWrite[];
  deleteBulletIds: string[];
  insertVariants: VariantRowWrite[];
  updateVariants: VariantRowWrite[];
  /** Variants removed from bullets that still exist (a deleted bullet's variants cascade). */
  deleteVariantIds: string[];
};

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);

/**
 * Rows to write so the stored pool matches `incoming`. An id that isn't among
 * this item's stored rows is planned as an insert, so an id belonging to another
 * item (or user) fails on its primary key instead of being overwritten.
 */
export function planPoolWrites(
  stored: { bullets: StoredBullet[]; variants: StoredVariant[] },
  incoming: BulletInput[],
): PoolWritePlan {
  const plan: PoolWritePlan = {
    insertBullets: [],
    updateBullets: [],
    deleteBulletIds: [],
    insertVariants: [],
    updateVariants: [],
    deleteVariantIds: [],
  };
  const storedBullets = new Map(stored.bullets.map((b) => [b.id, b]));
  const storedVariants = new Map(stored.variants.map((v) => [v.id, v]));
  const keptBullets = new Set<string>();
  const keptVariants = new Set<string>();

  incoming.forEach((bullet, position) => {
    keptBullets.add(bullet.id);
    const row = { id: bullet.id, position, tags: bullet.tags };
    const prev = storedBullets.get(bullet.id);
    if (!prev) plan.insertBullets.push(row);
    else if (prev.position !== position || !sameTags(prev.tags, bullet.tags)) plan.updateBullets.push(row);

    bullet.variants.forEach((variant, vPosition) => {
      keptVariants.add(variant.id);
      const vRow = { id: variant.id, bulletId: bullet.id, position: vPosition, text: variant.text, label: variant.label };
      const vPrev = storedVariants.get(variant.id);
      if (!vPrev) plan.insertVariants.push(vRow);
      else if (
        vPrev.bulletId !== vRow.bulletId ||
        vPrev.position !== vRow.position ||
        vPrev.text !== vRow.text ||
        vPrev.label !== vRow.label
      )
        plan.updateVariants.push(vRow);
    });
  });

  plan.deleteBulletIds = stored.bullets.filter((b) => !keptBullets.has(b.id)).map((b) => b.id);
  plan.deleteVariantIds = stored.variants
    .filter((v) => !keptVariants.has(v.id) && keptBullets.has(v.bulletId))
    .map((v) => v.id);
  return plan;
}

/**
 * Everything about a pool that a resume copy depends on: bullet order and each
 * variant's id, text and label. Tags are left out, so retagging never marks
 * the item as updated for resumes.
 */
export function poolSignature(bullets: { id: string; variants: { id: string; text: string; label: string | null }[] }[]) {
  return JSON.stringify(bullets.map((b) => [b.id, b.variants.map((v) => [v.id, v.text, v.label])]));
}

/** Stored rows → the editor's shape, in position order. */
export function storedPool(stored: { bullets: StoredBullet[]; variants: StoredVariant[] }) {
  const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
  return [...stored.bullets].sort(byPosition).map((b) => ({
    id: b.id,
    tags: b.tags,
    variants: stored.variants
      .filter((v) => v.bulletId === b.id)
      .sort(byPosition)
      .map((v) => ({ id: v.id, text: v.text, label: v.label })),
  }));
}
