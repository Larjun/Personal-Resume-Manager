import { and, count, desc, eq, inArray } from "drizzle-orm";
import { storedPool } from "@/lib/library/pool";
import { LIBRARY_FIELDS_SCHEMAS, LibraryKindSchema, type LibraryItemData, type VariantSource } from "@/lib/library/schema";
import type { DbOrTx } from "./resume-links";
import { bulletVariants, libraryBullets, libraryItems, resumeItemLinks } from "./schema";

// Library read queries that take an explicit user id. Not "server-only", so
// scripts can use them; app code goes through src/server/library.ts, which
// gets the user id from requireUser().

export type LibraryVariant = { id: string; text: string; label: string | null; source: VariantSource };
export type LibraryBullet = { id: string; tags: string[]; variants: LibraryVariant[] };

export type LibraryItem = LibraryItemData & {
  id: string;
  tags: string[];
  bullets: LibraryBullet[];
  /** Number of resumes that copied from this item. */
  usedIn: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Items with their pools and usage counts: all of the user's, or only those in `itemIds`. */
export async function loadLibraryItems(db: DbOrTx, userId: string, itemIds?: string[]): Promise<LibraryItem[]> {
  if (itemIds?.length === 0) return [];
  const items = await db
    .select()
    .from(libraryItems)
    .where(and(eq(libraryItems.userId, userId), itemIds ? inArray(libraryItems.id, itemIds) : undefined))
    .orderBy(desc(libraryItems.updatedAt));
  if (items.length === 0) return [];

  const [bullets, usage] = await Promise.all([
    db
      .select({ id: libraryBullets.id, itemId: libraryBullets.itemId, position: libraryBullets.position, tags: libraryBullets.tags })
      .from(libraryBullets)
      .where(and(eq(libraryBullets.userId, userId), itemIds ? inArray(libraryBullets.itemId, itemIds) : undefined)),
    db
      .select({ itemId: resumeItemLinks.itemId, n: count() })
      .from(resumeItemLinks)
      .where(and(eq(resumeItemLinks.userId, userId), itemIds ? inArray(resumeItemLinks.itemId, itemIds) : undefined))
      .groupBy(resumeItemLinks.itemId),
  ]);

  const bulletIds = bullets.map((b) => b.id);
  const variants =
    bulletIds.length === 0
      ? []
      : await db
          .select({
            id: bulletVariants.id,
            bulletId: bulletVariants.bulletId,
            position: bulletVariants.position,
            text: bulletVariants.text,
            label: bulletVariants.label,
            source: bulletVariants.source,
          })
          .from(bulletVariants)
          .where(
            and(
              eq(bulletVariants.userId, userId),
              // For some items, only their bullets' variants; for the whole library, all of the user's.
              itemIds ? inArray(bulletVariants.bulletId, bulletIds) : undefined,
            ),
          );

  const sourceOf = new Map(variants.map((v) => [v.id, v.source]));
  const usedIn = new Map(usage.map((u) => [u.itemId, u.n]));
  const bulletsByItem = groupBy(bullets, (b) => b.itemId);
  const variantsByBullet = groupBy(variants, (v) => v.bulletId);

  return items.map((row) => {
    const kind = LibraryKindSchema.parse(row.kind);
    const itemBullets = bulletsByItem.get(row.id) ?? [];
    const pool = storedPool({
      bullets: itemBullets,
      variants: itemBullets.flatMap((b) => variantsByBullet.get(b.id) ?? []),
    });
    return {
      id: row.id,
      ...({ kind, fields: LIBRARY_FIELDS_SCHEMAS[kind].parse(row.fields) } as LibraryItemData),
      tags: row.tags,
      bullets: pool.map((b) => ({
        ...b,
        variants: b.variants.map((v) => ({ ...v, source: sourceOf.get(v.id) ?? "user" })),
      })),
      usedIn: usedIn.get(row.id) ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}
