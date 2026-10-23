"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveResume } from "@/server/actions";
import type { PageSize, ResumeContent } from "@/lib/resume/schema";

export type EditorDoc = { title: string; pageSize: PageSize; content: ResumeContent };
export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

const DELAY_MS = 800;

type Patch = Parameters<typeof saveResume>[1];

/** Fields of `doc` that differ from what the server has. Blank titles are never sent. */
function diff(doc: EditorDoc, base: EditorDoc): Patch {
  const patch: Patch = {};
  const title = doc.title.trim();
  if (title && title !== base.title) patch.title = title;
  if (doc.pageSize !== base.pageSize) patch.pageSize = doc.pageSize;
  if (doc.content !== base.content) patch.content = doc.content;
  return patch;
}

const isEmpty = (patch: Patch) => Object.keys(patch).length === 0;

/**
 * Debounced autosave. Only fields that changed since the last successful
 * save are sent, so a stale editor can't clobber e.g. a rename done elsewhere.
 * Server Actions are dispatched sequentially by Next, so saves never reorder.
 */
export function useAutosave(id: string, initial: EditorDoc) {
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
    const patch = diff(doc, base);
    if (isEmpty(patch)) return lastSave.current;

    inFlight.current++;
    setStatus("saving");
    lastSave.current = saveResume(id, patch)
      .then(() => {
        // Record what was saved; later edits stay pending against it.
        saved.current = { ...doc, title: patch.title ?? base.title };
        if (--inFlight.current === 0) setStatus(isEmpty(diff(latest.current, saved.current)) ? "saved" : "unsaved");
        return true;
      })
      .catch((err) => {
        inFlight.current--;
        console.error("Autosave failed", err);
        setStatus("error");
        return false;
      });
    return lastSave.current;
  }, [id]);

  const schedule = useCallback(
    (doc: EditorDoc) => {
      latest.current = doc;
      if (inFlight.current === 0) setStatus("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isEmpty(diff(latest.current, saved.current))) {
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
  }, [flush]);

  return { status, schedule, flush };
}
