import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getResume } from "@/server/resumes";

export default function ResumePage({ params }: PageProps<"/resumes/[id]">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading resume…</p>}>
      <ResumeLoader params={params} />
    </Suspense>
  );
}

async function ResumeLoader({ params }: { params: PageProps<"/resumes/[id]">["params"] }) {
  const { id } = await params;
  const resume = await getResume(id);
  if (!resume) notFound();

  // Placeholder until milestone 1b (editor).
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← All resumes
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{resume.title}</h1>
      <p className="text-sm text-zinc-500">Editor arrives in milestone 1b. Stored content:</p>
      <pre className="mt-4 overflow-auto rounded-lg border border-zinc-200 bg-white p-4 text-xs">
        {JSON.stringify(resume.content, null, 2)}
      </pre>
    </main>
  );
}
