"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createResume } from "@/server/actions";

export function CreateResumeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const id = await createResume(title.trim());
          setTitle("");
          router.push(`/resumes/${id}`);
        });
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New resume title"
        maxLength={200}
        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
