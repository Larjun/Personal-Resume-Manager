import Link from "next/link";
import { Suspense } from "react";
import { listResumes } from "@/server/resumes";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { CreateResumeForm } from "@/components/list/CreateResumeForm";
import { ResumeRowItem } from "@/components/list/ResumeRowItem";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumes</h1>
          <p className="text-sm text-zinc-500">Create, edit and export your resumes.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/library" className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline">
            Library
          </Link>
          <Suspense>
            <AccountMenu />
          </Suspense>
        </div>
      </header>
      <CreateResumeForm />
      <Suspense fallback={<p className="mt-6 text-sm text-zinc-500">Loading resumes…</p>}>
        <ResumeList />
      </Suspense>
    </main>
  );
}

async function ResumeList() {
  const items = await listResumes();
  if (items.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
        No resumes yet. Create one above, or run <code>npm run seed</code>.
      </p>
    );
  }
  return (
    <ul className="mt-6 divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {items.map((r) => (
        <ResumeRowItem key={r.id} resume={r} />
      ))}
    </ul>
  );
}
