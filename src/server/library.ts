import { db } from "@/db";
import { loadLibraryItems, loadLibraryTags, type LibraryItem } from "@/db/library-queries";
import { LibraryItemIdSchema } from "@/lib/library/schema";
import { requireUser } from "./auth";

// Read-side queries for the master library. Mutations live in ./library-actions.ts.
// Every query is scoped to the signed-in user (requireUser()).

export type { LibraryBullet, LibraryItem, LibraryVariant } from "@/db/library-queries";

/** Every library item the user has, most recently updated first. */
export async function listLibraryItems(): Promise<LibraryItem[]> {
  const user = await requireUser();
  return loadLibraryItems(db, user.id);
}

/** The user's library item, or null if it doesn't exist or belongs to someone else. */
export async function getLibraryItem(id: string): Promise<LibraryItem | null> {
  const user = await requireUser();
  if (!LibraryItemIdSchema.safeParse(id).success) return null;
  const [item] = await loadLibraryItems(db, user.id, [id]);
  return item ?? null;
}

/** Every tag the user has used, most used first (tag autocomplete). */
export async function listLibraryTags(): Promise<string[]> {
  const user = await requireUser();
  return loadLibraryTags(db, user.id);
}

/**
 * The library items a resume copied from, for its sync badges. Ids that are
 * malformed, deleted or someone else's are simply absent from the result.
 */
export async function getLibrarySources(ids: string[]): Promise<LibraryItem[]> {
  const user = await requireUser();
  const valid = ids.filter((id) => LibraryItemIdSchema.safeParse(id).success);
  return loadLibraryItems(db, user.id, valid);
}
