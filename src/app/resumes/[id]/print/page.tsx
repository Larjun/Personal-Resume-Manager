import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintView } from "@/components/print/PrintView";
import { getResume } from "@/server/resumes";

export default function PrintPage({ params }: PageProps<"/resumes/[id]/print">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Preparing pages…</p>}>
      <PrintLoader params={params} />
    </Suspense>
  );
}

async function PrintLoader({ params }: { params: PageProps<"/resumes/[id]/print">["params"] }) {
  const { id } = await params;
  const resume = await getResume(id);
  if (!resume) notFound();
  return (
    <PrintView
      key={`${resume.id}:${resume.updatedAt.getTime()}`}
      id={resume.id}
      title={resume.title}
      pageSize={resume.pageSize}
      content={resume.content}
    />
  );
}
