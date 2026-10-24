"use client";

import Link from "next/link";
import { useEffect } from "react";

// Fallback for unexpected errors thrown while rendering a page or running an
// action (expected failures, like a wrong password, are returned as form state).
// In production the server error is replaced by a generic one with a `digest`
// that matches the server log line.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : null;

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-500">
        The page hit an unexpected error. Your saved work is safe. Try again, or go back to your resumes.
      </p>
      {detail && <pre className="mt-4 overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs text-zinc-700">{detail}</pre>}
      {digest && <p className="mt-2 text-xs text-zinc-400">Error reference: {digest}</p>}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Try again
        </button>
        <Link href="/" className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
          My resumes
        </Link>
      </div>
    </main>
  );
}
