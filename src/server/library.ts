import { db } from "@/db";
import { loadLibraryItems, type LibraryItem } from "@/db/library-queries";
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
  const [item] = await loadLibraryItems(db, user.id, id);
  return item ?? null;
}
