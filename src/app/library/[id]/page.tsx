import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LibraryItemEditor } from "@/components/library/LibraryItemEditor";
import { getLibraryItem, listLibraryTags } from "@/server/library";

export const metadata: Metadata = { title: "Library item · Resume Manager" };

export default function LibraryItemPage({ params }: PageProps<"/library/[id]">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading item…</p>}>
      <ItemLoader params={params} />
    </Suspense>
  );
}

async function ItemLoader({ params }: { params: PageProps<"/library/[id]">["params"] }) {
  const { id } = await params;
  const [item, allTags] = await Promise.all([getLibraryItem(id), listLibraryTags()]);
  if (!item) notFound();
  return (
    <LibraryItemEditor
      // Next keeps this route's state alive across navigations (Activity).
      // Remount when the stored item changed elsewhere so we never edit stale data.
      key={`${item.id}:${item.updatedAt.getTime()}`}
      item={item}
      allTags={allTags}
    />
  );
}
