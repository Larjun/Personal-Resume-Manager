"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteResume, duplicateResume, renameResume } from "@/server/actions";
import type { ResumeSummary } from "@/server/resumes";

const btn =
  "rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50";

export function ResumeRowItem({ resume }: { resume: ResumeSummary }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(resume.title);
  const [pending, startTransition] = useTransition();

  const commitRename = () => {
    const next = title.trim();
    setEditing(false);
    if (!next || next === resume.title) {
      setTitle(resume.title);
      return;
    }
    startTransition(() => renameResume(resume.id, next));
  };

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${pending ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTitle(resume.title);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500"
          />
        ) : (
          <Link href={`/resumes/${resume.id}`} className="block truncate text-sm font-medium hover:underline">
            {resume.title}
          </Link>
        )}
        <p className="text-xs text-zinc-500">
          {resume.pageSize} · updated <time suppressHydrationWarning>{new Date(resume.updatedAt).toLocaleString()}</time>
        </p>
      </div>
      <Link href={`/resumes/${resume.id}`} className={btn}>
        Open
      </Link>
      <button className={btn} disabled={pending} onClick={() => {
          setTitle(resume.title);
          setEditing(true);
        }}>
        Rename
      </button>
      <button className={btn} disabled={pending} onClick={() => startTransition(async () => void (await duplicateResume(resume.id)))}>
        Duplicate
      </button>
      <button
        className={`${btn} hover:!bg-red-50 hover:!text-red-700`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${resume.title}"? This cannot be undone.`)) {
            startTransition(() => deleteResume(resume.id));
          }
        }}
      >
        Delete
      </button>
    </li>
  );
}
