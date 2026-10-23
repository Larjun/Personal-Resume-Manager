import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Editor } from "@/components/editor/Editor";
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

  return (
    <Editor
      // Next keeps this route's state alive across navigations (Activity).
      // Remount when the stored resume changed elsewhere so we never edit stale data.
      key={`${resume.id}:${resume.updatedAt.getTime()}`}
      id={resume.id}
      initial={{ title: resume.title, pageSize: resume.pageSize, content: resume.content }}
    />
  );
}
