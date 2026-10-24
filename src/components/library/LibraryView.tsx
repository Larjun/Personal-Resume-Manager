"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  allTags,
  itemDates,
  itemDetail,
  itemTitle,
  KIND_LABEL,
  matchesQuery,
  matchesTags,
  tagCounts,
} from "@/lib/library/display";
import { LIBRARY_KINDS, type LibraryKind } from "@/lib/library/schema";
import { createLibraryItem } from "@/server/library-actions";
import type { LibraryItem } from "@/server/library";

export type LibraryTab = LibraryKind | "all";

export function LibraryView({ items, initialTab }: { items: LibraryItem[]; initialTab: LibraryTab }) {
  const [tab, setTab] = useState<LibraryTab>(initialTab);
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const inTab = useMemo(() => (tab === "all" ? items : items.filter((i) => i.kind === tab)), [items, tab]);
  const visible = inTab.filter((i) => matchesQuery(i, query) && matchesTags(i, selectedTags));
  const tags = useMemo(() => tagCounts(inTab), [inTab]);
  const countOf = (t: LibraryTab) => (t === "all" ? items.length : items.filter((i) => i.kind === t).length);

  const selectTab = (next: LibraryTab) => {
    setTab(next);
    // Kept in the URL so "← Library" from an item returns to the same tab.
    window.history.replaceState(null, "", next === "all" ? "/library" : `/library?kind=${next}`);
  };
  const toggleTag = (tag: string) =>
    setSelectedTags((sel) =>
      sel.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? sel.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...sel, tag],
    );

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Kind" className="flex flex-wrap gap-1 border-b border-zinc-200">
        {(["all", ...LIBRARY_KINDS] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => selectTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t === "all" ? "All" : KIND_LABEL[t].many}
            <span className="ml-1.5 text-xs font-normal text-zinc-400">{countOf(t)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, bullets, tags…"
          aria-label="Search library"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <CreateButtons tab={tab} />
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by tag">
          <span className="text-xs font-medium text-zinc-500">Tags:</span>
          {tags.map(({ tag, count }) => {
            const on = selectedTags.some((t) => t.toLowerCase() === tag.toLowerCase());
            return (
              <button
                key={tag}
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                {tag} <span className={on ? "text-zinc-300" : "text-zinc-400"}>{count}</span>
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button onClick={() => setSelectedTags([])} className="text-xs text-zinc-500 underline-offset-2 hover:underline">
              Clear
            </button>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          {inTab.length === 0
            ? `Nothing here yet. Add your first ${tab === "all" ? "item" : KIND_LABEL[tab].one.toLowerCase()} above.`
            : "No items match your search."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {visible.map((item) => (
            <ItemRow key={item.id} item={item} showKind={tab === "all"} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemRow({ item, showKind }: { item: LibraryItem; showKind: boolean }) {
  const detail = itemDetail(item);
  const dates = itemDates(item);
  const tags = allTags(item);
  return (
    <li>
      <Link href={`/library/${item.id}`} className="block px-4 py-3 hover:bg-zinc-50">
        <div className="flex items-baseline gap-2">
          {showKind && <KindBadge kind={item.kind} />}
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{itemTitle(item)}</span>
          {dates && <span className="shrink-0 text-xs text-zinc-500">{dates}</span>}
        </div>
        {detail && <p className="mt-0.5 truncate text-xs text-zinc-500">{detail}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
              {t}
            </span>
          ))}
          <span className="ml-auto flex shrink-0 gap-3 pl-2">
            {item.bullets.length > 0 && (
              <span>
                {item.bullets.length} {item.bullets.length === 1 ? "bullet" : "bullets"}
              </span>
            )}
            <span className={item.usedIn > 0 ? "text-zinc-700" : undefined}>
              Used in {item.usedIn} {item.usedIn === 1 ? "resume" : "resumes"}
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}

export function KindBadge({ kind }: { kind: LibraryKind }) {
  return (
    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
      {KIND_LABEL[kind].one}
    </span>
  );
}

/** "New experience" on a kind tab; one button per kind on the All tab. */
function CreateButtons({ tab }: { tab: LibraryTab }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const create = (kind: LibraryKind) =>
    startTransition(async () => {
      const id = await createLibraryItem(kind);
      router.push(`/library/${id}`);
    });
  if (tab !== "all") {
    return (
      <button
        disabled={pending}
        onClick={() => create(tab)}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : `New ${KIND_LABEL[tab].one.toLowerCase()}`}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs font-medium text-zinc-500">New:</span>
      {LIBRARY_KINDS.map((kind) => (
        <button
          key={kind}
          disabled={pending}
          onClick={() => create(kind)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50"
        >
          {KIND_LABEL[kind].one}
        </button>
      ))}
    </div>
  );
}
