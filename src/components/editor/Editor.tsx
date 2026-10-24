"use client";

import { produce } from "immer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AddFromLibraryDrawer } from "@/components/library/AddFromLibraryDrawer";
import { addLibraryItems } from "@/lib/library/copy";
import { newEntriesSection, newSection } from "@/lib/resume/factories";
import { DATE_FORMAT_LABEL, DATE_FORMATS, type DateFormat } from "@/lib/resume/dates";
import { PAGE_SIZES, type Section } from "@/lib/resume/schema";
import { usePagination } from "@/lib/pagination/usePagination";
import { DateFormatContext } from "./dateFields";
import type { LibraryItem } from "@/db/library-queries";
import { HeaderForm, SectionCard, type Update } from "./forms";
import { LibrarySyncProvider, useLibrarySources } from "./librarySync";
import { moveItem, SortableList } from "./SortableList";
import { resumeAutosave, useAutosave, type EditorDoc } from "./useAutosave";
import { Preview } from "./Preview";
import { SaveIndicator } from "./SaveIndicator";

export function Editor({
  id,
  initial,
  librarySources,
}: {
  id: string;
  initial: EditorDoc;
  /** The library items this resume copied from, as loaded with the page. */
  librarySources: LibraryItem[];
}) {
  const router = useRouter();
  const [doc, setDoc] = useState(initial);
  const docRef = useRef(initial);
  const { status, schedule, flush } = useAutosave(id, initial, resumeAutosave);
  // The section whose "From library" panel is open.
  const [librarySectionId, setLibrarySectionId] = useState<string | null>(null);
  const closeLibrary = useCallback(() => setLibrarySectionId(null), []);
  const librarySection = sectionsById(doc.content.sections, librarySectionId);

  const update: Update<EditorDoc> = useCallback(
    (recipe) => {
      const next = produce(docRef.current, recipe);
      if (next === docRef.current) return;
      docRef.current = next;
      setDoc(next);
      schedule(next);
    },
    [schedule],
  );

  const sync = useLibrarySources(doc.content, librarySources, initial.content);
  const sections = doc.content.sections;
  const pagination = usePagination(doc.content, doc.pageSize);
  const pageCount = pagination.pages?.length;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-200 bg-white px-4 py-2">
        <Link href="/" onClick={() => void flush()} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Resumes
        </Link>
        <input
          aria-label="Resume title"
          value={doc.title}
          maxLength={200}
          onChange={(e) => {
            const v = e.target.value;
            update((d) => void (d.title = v));
          }}
          className="min-w-40 flex-1 rounded px-2 py-1 text-sm font-semibold outline-none hover:bg-zinc-50 focus:bg-zinc-50 focus:ring-1 focus:ring-zinc-300"
        />
        <SaveIndicator status={status} onRetry={() => void flush()} />
        {pageCount !== undefined && (
          <span className={`text-xs font-medium ${pageCount > 1 ? "text-amber-700" : "text-zinc-500"}`}>
            {pageCount} {pageCount === 1 ? "page" : "pages"}
          </span>
        )}
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">
          Dates
          <select
            aria-label="Date format"
            value={doc.content.settings.dateFormat}
            onChange={(e) => {
              const v = e.target.value as DateFormat;
              update((d) => void (d.content.settings.dateFormat = v));
            }}
            className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-500"
          >
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {DATE_FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
        <div role="radiogroup" aria-label="Page size" className="flex rounded-md border border-zinc-300 p-0.5 text-xs">
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              role="radio"
              aria-checked={doc.pageSize === size}
              onClick={() => update((d) => void (d.pageSize = size))}
              className={`rounded px-2.5 py-1 font-medium ${
                doc.pageSize === size ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        <button
          onClick={async () => {
            // Open the tab synchronously (popup blockers), then point it at the
            // print view once every pending edit is saved, so it never prints stale content.
            const tab = window.open("", "_blank");
            const ok = await flush();
            if (!ok) {
              tab?.close();
              alert("Couldn't save your latest changes, so the PDF would be out of date. Please try again.");
              return;
            }
            const url = `/resumes/${id}/print?autoprint=1`;
            if (tab) tab.location.href = url;
            else router.push(url);
          }}
          title="Opens the print view; choose “Save as PDF” in the dialog"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
        >
          Print / PDF
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <section aria-label="Editor" className="w-[44%] min-w-[420px] overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-4">
          <LibrarySyncProvider value={sync}>
            <DateFormatContext value={doc.content.settings.dateFormat}>
              <div className="space-y-3">
                <HeaderForm header={doc.content.header} update={(recipe) => update((d) => recipe(d.content.header))} />
                <SortableList
                  items={sections}
                  className="space-y-3"
                  onMove={(from, to) => update((d) => moveItem(d.content.sections, from, to))}
                  renderItem={(section, i, handle) => (
                    <SectionCard
                      section={section}
                      handle={handle}
                      update={(recipe) => update((d) => recipe(d.content.sections[i]))}
                      onDelete={() => update((d) => void d.content.sections.splice(i, 1))}
                      onAddFromLibrary={() => setLibrarySectionId(section.id)}
                    />
                  )}
                />
                <AddSection onAdd={(section) => update((d) => void d.content.sections.push(section))} />
              </div>
            </DateFormatContext>
          </LibrarySyncProvider>
        </section>

        <section aria-label="Preview" className="min-w-0 flex-1 overflow-y-auto bg-zinc-200/70">
          <Preview pagination={pagination} />
        </section>
      </div>

      {librarySection && (
        <AddFromLibraryDrawer
          section={librarySection}
          content={doc.content}
          onClose={closeLibrary}
          onAdd={(picks) => {
            update((d) => addLibraryItems(d.content, picks, { sectionId: librarySection.id }));
            closeLibrary();
          }}
        />
      )}
    </div>
  );
}

const SECTION_CHOICES: { label: string; make: () => Section }[] = [
  { label: "Experience", make: () => newEntriesSection("experience") },
  { label: "Projects", make: () => newEntriesSection("project") },
  { label: "Publications", make: () => newSection("publications") },
  { label: "Education", make: () => newSection("education") },
  { label: "Skills", make: () => newSection("skills") },
  { label: "Summary", make: () => newSection("summary") },
];

function AddSection({ onAdd }: { onAdd: (section: Section) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-3">
      <span className="text-xs font-medium text-zinc-500">Add section:</span>
      {SECTION_CHOICES.map(({ label, make }) => (
        <button
          key={label}
          type="button"
          onClick={() => onAdd(make())}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const sectionsById = (sections: Section[], id: string | null) => (id ? sections.find((s) => s.id === id) : undefined);
