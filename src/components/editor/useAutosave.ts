"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveResume } from "@/server/actions";
import type { PageSize, ResumeContent } from "@/lib/resume/schema";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

/**
 * How one kind of document is saved. Define adapters at module level so their
 * identity is stable (the hook's callbacks depend on them).
 */
export type AutosaveAdapter<Doc, Patch extends object> = {
  /** Fields of `doc` that differ from `base` (what the server has). `{}` = nothing to save. */
  diff: (doc: Doc, base: Doc) => Patch;
  save: (id: string, patch: Patch) => Promise<unknown>;
  /** What the server holds once `patch` is saved. Defaults to `doc`. */
  saved?: (doc: Doc, base: Doc, patch: Patch) => Doc;
};

const DELAY_MS = 800;

const isEmpty = (patch: object) => Object.keys(patch).length === 0;

/**
 * Debounced autosave. Only fields that changed since the last successful
 * save are sent, so a stale editor can't clobber e.g. a rename done elsewhere.
 * Server Actions are dispatched sequentially by Next, so saves never reorder.
 */
export function useAutosave<Doc, Patch extends object>(id: string, initial: Doc, adapter: AutosaveAdapter<Doc, Patch>) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const saved = useRef(initial); // last doc the server acknowledged
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef(0);
  // Settles after the most recent save; saves are sequential, so also after all earlier ones.
  const lastSave = useRef<Promise<boolean>>(Promise.resolve(true));

  /** Saves pending changes now. Resolves true once everything is saved. */
  const flush = useCallback((): Promise<boolean> => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const doc = latest.current;
    const base = saved.current;
    const patch = adapter.diff(doc, base);
    if (isEmpty(patch)) return lastSave.current;

    inFlight.current++;
    setStatus("saving");
    lastSave.current = adapter
      .save(id, patch)
      .then(() => {
        // Record what was saved; later edits stay pending against it.
        saved.current = adapter.saved ? adapter.saved(doc, base, patch) : doc;
        if (--inFlight.current === 0) {
          setStatus(isEmpty(adapter.diff(latest.current, saved.current)) ? "saved" : "unsaved");
        }
        return true;
      })
      .catch((err) => {
        inFlight.current--;
        console.error("Autosave failed", err);
        setStatus("error");
        return false;
      });
    return lastSave.current;
  }, [id, adapter]);

  const schedule = useCallback(
    (doc: Doc) => {
      latest.current = doc;
      if (inFlight.current === 0) setStatus("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, DELAY_MS);
    },
    [flush],
  );

  /** Drops pending changes without saving (e.g. the document is being deleted). */
  const discard = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    latest.current = saved.current;
  }, []);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isEmpty(adapter.diff(latest.current, saved.current))) {
        flush();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Runs on unmount and when Next hides this route (Activity): save now.
      flush();
    };
  }, [flush, adapter]);

  return { status, schedule, flush, discard };
}

// ── Resume editor ──────────────────────────────────────────────────────

export type EditorDoc = { title: string; pageSize: PageSize; content: ResumeContent };

type ResumePatch = Parameters<typeof saveResume>[1];

export const resumeAutosave: AutosaveAdapter<EditorDoc, ResumePatch> = {
  /** Blank titles are never sent. */
  diff(doc, base) {
    const patch: ResumePatch = {};
    const title = doc.title.trim();
    if (title && title !== base.title) patch.title = title;
    if (doc.pageSize !== base.pageSize) patch.pageSize = doc.pageSize;
    if (doc.content !== base.content) patch.content = doc.content;
    return patch;
  },
  save: saveResume,
  saved: (doc, base, patch) => ({ ...doc, title: patch.title ?? base.title }),
};
