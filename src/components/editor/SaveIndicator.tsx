"use client";

import type { SaveStatus } from "./useAutosave";

export function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "error") {
    return (
      <button onClick={onRetry} className="text-xs font-medium text-red-600 hover:underline">
        Save failed, retry
      </button>
    );
  }
  const label = { saved: "Saved", unsaved: "Unsaved changes", saving: "Saving…" }[status];
  return (
    <span className="text-xs text-zinc-500" aria-live="polite">
      {label}
    </span>
  );
}
