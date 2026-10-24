"use client";

import { diffWords } from "diff";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LibraryItem } from "@/db/library-queries";
import { sourceItemIds } from "@/lib/library/links";
import { bulletSync, copyChanges, copyStatus, type Copy, type SyncSource } from "@/lib/library/sync";
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
export function useLibrarySources(
  content: ResumeContent,
  initial: LibraryItem[],
  initialContent: ResumeContent,
): SyncContext {
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

/**
 * "Library updated" (with Pull latest) or "Source deleted" for a copied item;
 * nothing otherwise. `onPull` applies the latest library version to the copy.
 */
export function SyncBadge({ copy, onPull }: { copy: Copy; onPull: (source: SyncSource) => void }) {
  const { sourceFor } = useLibrarySync();
  const [reviewing, setReviewing] = useState(false);
  const source = sourceFor(copy);
  const status = copyStatus(copy, source);
  if (status === "updated" && source) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <span
          className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200"
          title="The library version of this item changed after you copied it."
        >
          Library updated
        </span>
        <button
          type="button"
          onClick={() => setReviewing(true)}
          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-800 underline-offset-2 hover:underline"
        >
          Pull latest
        </button>
        {reviewing && (
          <PullLatestDialog
            copy={copy}
            source={source}
            onApply={() => {
              onPull(source);
              setReviewing(false);
            }}
            onClose={() => setReviewing(false)}
          />
        )}
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

/** Word-by-word diff of what Pull latest would change, with Apply / Cancel. */
function PullLatestDialog({
  copy,
  source,
  onApply,
  onClose,
}: {
  copy: Copy;
  source: SyncSource;
  onApply: () => void;
  onClose: () => void;
}) {
  const changes = copyChanges(copy, source);
  const keptEdits = ("bullets" in copy ? copy.bullets : []).filter((b) => {
    const s = bulletSync(b, source);
    return s?.edited && s.libraryChanged;
  }).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portal to <body>: the badge sits inside sortable (transformed) list items.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pull latest from library"
    >
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-zinc-900/30" />
      <div className="relative flex max-h-[85vh] w-[min(640px,100%)] flex-col rounded-lg border border-zinc-200 bg-white shadow-xl">
        <header className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Pull latest from library</h2>
          <p className="text-xs text-zinc-500">
            These changes from your library will replace what&apos;s in this resume.{" "}
            <span className="text-red-700 line-through decoration-red-400">Removed</span>{" "}
            <span className="rounded-sm bg-green-50 text-green-800">added</span>.
          </p>
        </header>
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {changes.map((c) => (
            <li key={c.key}>
              <p className="mb-0.5 text-xs font-medium text-zinc-500">{c.label}</p>
              <WordDiff before={c.before} after={c.after} />
            </li>
          ))}
          {changes.length === 0 && (
            <li className="text-sm text-zinc-500">Nothing to pull: this is already up to date.</li>
          )}
        </ul>
        {keptEdits > 0 && (
          <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
            {keptEdits === 1 ? "1 bullet you edited" : `${keptEdits} bullets you edited`} in this resume will be kept as
            you wrote {keptEdits === 1 ? "it" : "them"}.
          </p>
        )}
        <footer className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={changes.length === 0}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            Apply {changes.length} {changes.length === 1 ? "change" : "changes"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function WordDiff({ before, after }: { before: string; after: string }) {
  if (!before && !after) return null;
  return (
    <p className="whitespace-pre-wrap rounded-md bg-zinc-50 px-2 py-1.5 text-sm leading-relaxed">
      {diffWords(before, after).map((part, i) =>
        part.removed ? (
          <span key={i} className="text-red-700 line-through decoration-red-400">
            {part.value}
          </span>
        ) : part.added ? (
          <span key={i} className="rounded-sm bg-green-50 text-green-800">
            {part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
      {!after && <span className="ml-1 text-xs text-zinc-400">(now empty)</span>}
    </p>
  );
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
