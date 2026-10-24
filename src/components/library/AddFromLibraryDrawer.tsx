"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronIcon } from "@/components/editor/fields";
import { defaultBulletChoices, itemIdsInResume, libraryKindFor, type LibraryPick } from "@/lib/library/copy";
import {
  itemDates,
  itemDetail,
  itemTitle,
  KIND_LABEL,
  matchesQuery,
  matchesTags,
  tagCounts,
} from "@/lib/library/display";
import type { ResumeContent, Section } from "@/lib/resume/schema";
import type { LibraryItem } from "@/db/library-queries";
import { fetchLibraryItems } from "@/server/library-actions";

/** Chosen variant per bullet id, for one selected item. */
type Choices = Map<string, string>;

/**
 * Side panel for copying library items into one section of the resume. It
 * only offers the kind that section takes (experience for an Experience
 * section, projects for Projects…). Mount it only while open: it loads the
 * library on mount, so it always shows the latest version.
 */
export function AddFromLibraryDrawer({
  section,
  content,
  onAdd,
  onClose,
}: {
  /** The section the items will be added to. */
  section: Section;
  content: ResumeContent;
  onAdd: (picks: LibraryPick[]) => void;
  onClose: () => void;
}) {
  const kind = libraryKindFor(section);
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<Map<string, Choices>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchLibraryItems()
      .then((list) => !cancelled && setItems(list))
      .catch((err) => {
        console.error("Loading the library failed", err);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inResume = useMemo(() => itemIdsInResume(content), [content]);
  // Only the kind this section takes.
  const all = useMemo(() => (items ?? []).filter((i) => i.kind === kind), [items, kind]);
  const visible = all.filter((i) => matchesQuery(i, query) && matchesTags(i, selectedTags));
  const tags = useMemo(() => tagCounts(all), [all]);

  const toggleItem = (item: LibraryItem) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else {
        // A resume has one summary, so picking a summary unpicks any other.
        if (item.kind === "summary") for (const i of all) if (i.kind === "summary") next.delete(i.id);
        next.set(item.id, new Map(defaultBulletChoices(item).map((c) => [c.bulletId, c.variantId])));
      }
      return next;
    });

  const setBullet = (item: LibraryItem, bulletId: string, variantId: string | null) =>
    setSelected((prev) => {
      const next = new Map(prev);
      const choices = new Map(next.get(item.id) ?? []);
      if (variantId) choices.set(bulletId, variantId);
      else choices.delete(bulletId);
      next.set(item.id, choices); // picking a bullet selects its item
      return next;
    });

  const toggleTag = (tag: string) =>
    setSelectedTags((sel) =>
      sel.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? sel.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...sel, tag],
    );

  const add = () => {
    // Bullets keep their library order, whatever order they were ticked in.
    const picks: LibraryPick[] = all
      .filter((i) => selected.has(i.id))
      .map((item) => {
        const choices = selected.get(item.id)!;
        return {
          item,
          bullets: item.bullets.flatMap((b) => {
            const variantId = choices.get(b.id);
            return variantId ? [{ bulletId: b.id, variantId }] : [];
          }),
        };
      });
    const summary = picks.find((p) => p.item.kind === "summary");
    const current = content.sections.find((s) => s.type === "summary");
    if (
      summary &&
      current?.text.trim() &&
      !confirm("Replace the resume's current summary with the one from your library?")
    ) {
      return;
    }
    onAdd(picks);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Add from library">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-zinc-900/20" />
      <div className="relative flex h-full w-[min(560px,100%)] flex-col border-l border-zinc-200 bg-white shadow-xl">
        <header className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
            Add to <span className="text-zinc-500">{section.heading || "this section"}</span>
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
            Close
          </button>
        </header>

        <div className="space-y-2 border-b border-zinc-200 px-4 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, bullets, tags…"
            aria-label="Search library"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
          />
          {tags.length > 0 && (
            <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto" aria-label="Filter by tag">
              {tags.map(({ tag }) => {
                const on = selectedTags.some((t) => t.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    aria-pressed={on}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      on
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 text-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadError ? (
            <p className="p-6 text-sm text-red-600">Couldn&apos;t load your library. Close this panel and try again.</p>
          ) : items === null ? (
            <p className="p-6 text-sm text-zinc-500">Loading library…</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">
              {all.length === 0
                ? `Your library has no ${KIND_LABEL[kind].many.toLowerCase()} yet. Add some on the Library page.`
                : "No items match."}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {visible.map((item) => (
                <PickerRow
                  key={item.id}
                  item={item}
                  alreadyIn={inResume.has(item.id)}
                  choices={selected.get(item.id)}
                  expanded={expanded.has(item.id)}
                  onToggle={() => toggleItem(item)}
                  onExpand={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (!next.delete(item.id)) next.add(item.id);
                      return next;
                    })
                  }
                  onBullet={(bulletId, variantId) => setBullet(item, bulletId, variantId)}
                />
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={add}
            disabled={selected.size === 0}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {selected.size === 0 ? "Add" : `Add ${selected.size} ${selected.size === 1 ? "item" : "items"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

function PickerRow({
  item,
  alreadyIn,
  choices,
  expanded,
  onToggle,
  onExpand,
  onBullet,
}: {
  item: LibraryItem;
  alreadyIn: boolean;
  choices: Choices | undefined;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onBullet: (bulletId: string, variantId: string | null) => void;
}) {
  const title = itemTitle(item);
  const detail = itemDetail(item);
  const dates = itemDates(item);
  const bullets = item.bullets.filter((b) => b.variants.some((v) => v.text.trim()));
  const canExpand = !alreadyIn && bullets.length > 0;

  return (
    <li className={alreadyIn ? "bg-zinc-50" : undefined}>
      <div className="flex items-start gap-2 px-4 py-2.5">
        <input
          type="checkbox"
          checked={alreadyIn || !!choices}
          disabled={alreadyIn}
          onChange={onToggle}
          aria-label={alreadyIn ? `"${title}" is already in this resume` : `Add "${title}"`}
          title={alreadyIn ? "Already in this resume. Remove it in the editor if you want to add it again." : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-900 disabled:cursor-not-allowed"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`min-w-0 flex-1 truncate text-sm font-medium ${alreadyIn ? "text-zinc-500" : ""}`}>
              {title}
            </span>
            {dates && <span className="shrink-0 text-xs text-zinc-500">{dates}</span>}
          </div>
          {detail && <p className="truncate text-xs text-zinc-500">{detail}</p>}
          {alreadyIn && <p className="text-xs text-zinc-500">Already in this resume</p>}
          {canExpand && (
            <button
              onClick={onExpand}
              aria-expanded={expanded}
              className="mt-1 flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              <ChevronIcon open={expanded} />
              {choices ? `${choices.size} of ${bullets.length} bullets` : `${bullets.length} bullets`}
            </button>
          )}
        </div>
      </div>

      {canExpand && expanded && (
        <ul className="space-y-1.5 pb-3 pl-10 pr-4">
          {bullets.map((b) => {
            const variants = b.variants.filter((v) => v.text.trim());
            const chosen = choices?.get(b.id);
            const shown = variants.find((v) => v.id === chosen) ?? variants[0];
            return (
              <li key={b.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={!!chosen}
                  onChange={(e) => onBullet(b.id, e.target.checked ? shown.id : null)}
                  aria-label={`Include bullet: ${shown.text}`}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-zinc-900"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-snug ${chosen ? "text-zinc-800" : "text-zinc-400"}`}>{shown.text}</p>
                  {variants.length > 1 && (
                    <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" aria-label="Wording">
                      {variants.map((v, n) => (
                        <button
                          key={v.id}
                          role="radio"
                          aria-checked={v.id === shown.id}
                          onClick={() => onBullet(b.id, v.id)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            v.id === shown.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          }`}
                        >
                          {v.label ?? `Wording ${n + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
