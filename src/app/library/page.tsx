import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { LibraryView } from "@/components/library/LibraryView";
import { LibraryKindSchema } from "@/lib/library/schema";
import { listLibraryItems } from "@/server/library";

export const metadata: Metadata = { title: "Library · Resume Manager" };

export default function LibraryPage({ searchParams }: PageProps<"/library">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Resumes
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-zinc-500">Everything you&apos;ve done, written once. Resumes copy from here.</p>
        </div>
        <Suspense>
          <AccountMenu />
        </Suspense>
      </header>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading library…</p>}>
        <LibraryLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LibraryLoader({ searchParams }: { searchParams: PageProps<"/library">["searchParams"] }) {
  const { kind } = await searchParams;
  const tab = LibraryKindSchema.safeParse(kind).data ?? "all";
  const items = await listLibraryItems();
  // Keyed by tab so arriving with a different ?kind= (e.g. "← Library" from an item) selects it.
  return <LibraryView key={tab} items={items} initialTab={tab} />;
}
