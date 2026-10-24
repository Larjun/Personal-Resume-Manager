"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { LibraryItem } from "@/db/library-queries";
import { sourceItemIds } from "@/lib/library/links";
import { bulletSync, copyStatus, type Copy, type SyncSource } from "@/lib/library/sync";
import type { Bullet, ResumeContent } from "@/lib/resume/schema";
import { fetchLibrarySources, pushBulletToLibrary } from "@/server/library-actions";

type Sources = { items: Map<string, LibraryItem>; loaded: Set<string> };

type SyncContext = {
  /** undefined while loading; null when the library item no longer exists. */
  sourceFor: (copy: Copy) => SyncSource | null | undefined;
  /** Refetches the library items this resume copied from. */
  refresh: () => Promise<void>;
};

const LibrarySyncContext = createContext<SyncContext>({ sourceFor: () => undefined, refresh: async () => {} });
export const LibrarySyncProvider = LibrarySyncContext.Provider;
export const useLibrarySync = () => useContext(LibrarySyncContext);

/**
 * The library items a resume copied from. Starts from what the page loaded and
 * refetches when the resume links a new item and when the tab regains focus,
 * so edits made on the Library page (or in another tab) show up.
 */
export function useLibrarySources(content: ResumeContent, initial: LibraryItem[], initialContent: ResumeContent): SyncContext {
  const [sources, setSources] = useState<Sources>(() => ({
    items: new Map(initial.map((i) => [i.id, i])),
    loaded: new Set(sourceItemIds(initialContent)),
  }));
  const idsKey = [...sourceItemIds(content)].sort().join(",");
  const latestIds = useRef<string[]>([]);
  const mounted = useRef(false);

  useEffect(() => {
    latestIds.current = idsKey ? idsKey.split(",") : [];
  }, [idsKey]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const wanted = latestIds.current;
    try {
      const list = await fetchLibrarySources(wanted);
      if (mounted.current) setSources({ items: new Map(list.map((i) => [i.id, i])), loaded: new Set(wanted) });
    } catch (err) {
      console.error("Refreshing library sources failed", err);
    }
  }, []);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // A newly linked item (e.g. just added from the library) hasn't been loaded yet.
  useEffect(() => {
    const wanted = idsKey ? idsKey.split(",") : [];
    if (!wanted.every((id) => sources.loaded.has(id))) void refresh();
  }, [idsKey, sources.loaded, refresh]);

  return {
    sourceFor: (copy) => {
      const id = copy.sourceItemId;
      if (!id || !sources.loaded.has(id)) return undefined;
      return sources.items.get(id) ?? null;
    },
    refresh,
  };
}

/** "Library updated" / "Source deleted" pill for a copied item; nothing otherwise. */
export function SyncBadge({ copy }: { copy: Copy }) {
  const { sourceFor } = useLibrarySync();
  const status = copyStatus(copy, sourceFor(copy));
  if (status === "updated") {
    return (
      <span
        className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200"
        title="The library version of this item changed after you copied it."
      >
        Library updated
      </span>
    );
  }
  if (status === "deleted") {
    return (
      <span
        className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500"
        title="The library item this was copied from was deleted. This copy is unaffected."
      >
        Source deleted
      </span>
    );
  }
  return null;
}

const quote = (s: string) => (s.length > 80 ? `“${s.slice(0, 80)}…”` : `“${s}”`);

/**
 * Shown under a bullet that was edited in this resume. Resume edits stay in
 * the resume; this is the only way to send one to the library, either
 * replacing the wording it came from or adding it as a new wording.
 */
export function UpdateLibraryControl({
  copy,
  bullet,
  onPushed,
}: {
  /** The entry or paper the bullet belongs to. */
  copy: Copy;
  bullet: Bullet;
  /** Called with the wording the bullet now matches in the library, and the text that was sent. */
  onPushed: (variantId: string, text: string) => void;
}) {
  const { sourceFor, refresh } = useLibrarySync();
  const [choosing, setChoosing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sync = bulletSync(bullet, sourceFor(copy));
  if (!sync?.edited || !bullet.text.trim()) return null;

  const push = async (mode: "replace" | "variant") => {
    if (
      mode === "replace" &&
      sync.libraryChanged &&
      !confirm("The library wording was also changed since you copied it. Replace it with this resume's text?")
    ) {
      return;
    }
    const text = bullet.text;
    setPending(true);
    setError(null);
    try {
      const { variantId } = await pushBulletToLibrary({
        bulletId: bullet.sourceBulletId!,
        variantId: bullet.sourceVariantId,
        text,
        mode,
      });
      onPushed(variantId, text);
      setChoosing(false);
      await refresh();
    } catch (err) {
      console.error("Updating the library failed", err);
      setError(err instanceof Error ? err.message : "Couldn't update the library.");
    } finally {
      setPending(false);
    }
  };

  const btn =
    "rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-medium text-zinc-700 hover:border-zinc-400 disabled:opacity-50";
  return (
    <div className="ml-6 mt-1 space-y-1 text-[11px] text-zinc-500">
      <div className="flex flex-wrap items-center gap-1.5">
        <span>Edited in this resume. The library still has the old wording.</span>
        {!choosing ? (
          <button type="button" className={btn} onClick={() => setChoosing(true)}>
            Update library
          </button>
        ) : (
          <>
            {sync.libraryText !== null && (
              <button type="button" className={btn} disabled={pending} onClick={() => void push("replace")}>
                Replace library wording
              </button>
            )}
            <button type="button" className={btn} disabled={pending} onClick={() => void push("variant")}>
              Save as new variant
            </button>
            <button
              type="button"
              className="px-1 text-zinc-500 hover:text-zinc-800"
              disabled={pending}
              onClick={() => setChoosing(false)}
            >
              Cancel
            </button>
          </>
        )}
      </div>
      {sync.libraryChanged && (
        <p className="text-amber-700">
          {sync.libraryText === null
            ? "The library wording this came from was deleted; you can save this as a new variant."
            : `The library wording also changed: ${quote(sync.libraryText)}`}
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
