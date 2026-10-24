"use client";

import { produce } from "immer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { DegreesEditor, EntryFields, PaperFields, type Update } from "@/components/editor/forms";
import { AddButton, Field, IconButton, ListInput, TextArea, TextInput, TrashIcon } from "@/components/editor/fields";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { TagInput } from "@/components/editor/TagInput";
import { DragHandle, moveItem, SortableList, type DragHandleProps } from "@/components/editor/SortableList";
import { useAutosave, type AutosaveAdapter } from "@/components/editor/useAutosave";
import { itemTitle } from "@/lib/library/display";
import { newLibraryBullet, newVariant } from "@/lib/library/factories";
import { KINDS_WITH_BULLETS, type LibraryFields, type LibraryItemData } from "@/lib/library/schema";
import { deleteLibraryItem, saveLibraryItem } from "@/server/library-actions";
import type { LibraryBullet, LibraryItem } from "@/server/library";
import { KindBadge } from "./LibraryView";

type ItemDoc = { fields: LibraryFields; tags: string[]; bullets: LibraryBullet[] };
type ItemPatch = Parameters<typeof saveLibraryItem>[1];

const libraryAutosave: AutosaveAdapter<ItemDoc, ItemPatch> = {
  diff(doc, base) {
    const patch: ItemPatch = {};
    if (doc.fields !== base.fields) patch.fields = doc.fields;
    if (doc.tags !== base.tags) patch.tags = doc.tags;
    if (doc.bullets !== base.bullets) patch.bullets = doc.bullets;
    return patch;
  },
  save: saveLibraryItem,
};

const LABEL_SUGGESTIONS = ["short", "detailed", "technical", "leadership", "impact"];

export function LibraryItemEditor({ item, allTags }: { item: LibraryItem; allTags: string[] }) {
  const router = useRouter();
  const [initial] = useState<ItemDoc>(() => ({ fields: item.fields, tags: item.tags, bullets: item.bullets }));
  const [doc, setDoc] = useState(initial);
  const docRef = useRef(initial);
  const { status, schedule, flush, discard } = useAutosave(item.id, initial, libraryAutosave);
  const [deleting, startDelete] = useTransition();

  const update: Update<ItemDoc> = useCallback(
    (recipe) => {
      const next = produce(docRef.current, recipe);
      if (next === docRef.current) return;
      docRef.current = next;
      setDoc(next);
      schedule(next);
    },
    [schedule],
  );

  // Tags across the library, plus any added in this editor since it loaded.
  const tagSuggestions = mergeTags(allTags, doc.tags, ...doc.bullets.map((b) => b.tags));

  // The kind never changes, so pairing it with the current fields is safe.
  const data = { kind: item.kind, fields: doc.fields } as LibraryItemData;
  const title = itemTitle(data);
  const backHref = `/library?kind=${item.kind}`;

  const onDelete = () => {
    const note =
      item.usedIn > 0
        ? `\n\n${item.usedIn} ${item.usedIn === 1 ? "resume uses" : "resumes use"} it. They keep their copies.`
        : "";
    if (!confirm(`Delete "${title}" from your library?${note}`)) return;
    discard();
    startDelete(async () => {
      await deleteLibraryItem(item.id);
      router.push(backHref);
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2">
        <Link href={backHref} onClick={() => void flush()} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Library
        </Link>
        <KindBadge kind={item.kind} />
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
        <SaveIndicator status={status} onRetry={() => void flush()} />
        <span className="text-xs text-zinc-500">
          Used in {item.usedIn} {item.usedIn === 1 ? "resume" : "resumes"}
        </span>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-3 p-4">
        <Card title="Details">
          <FieldsForm data={data} update={(recipe) => update((d) => recipe(d.fields))} />
        </Card>

        <Card title="Tags" hint="What kind of role or project this is. Press Enter or comma to add; suggestions come from your other tags.">
          <TagInput
            aria-label="Item tags"
            placeholder="Backend, Full-stack, Volunteer…"
            value={doc.tags}
            suggestions={tagSuggestions}
            onChange={(tags) => update((d) => void (d.tags = tags))}
          />
        </Card>

        {KINDS_WITH_BULLETS.includes(item.kind) && (
          <Card
            title="Bullet pool"
            hint="Keep every bullet you might use here; each resume picks the ones it needs. Variants are alternative wordings of the same bullet."
          >
            <BulletPool
              bullets={doc.bullets}
              tagSuggestions={tagSuggestions}
              update={(recipe) => update((d) => recipe(d.bullets))}
            />
          </Card>
        )}
      </main>

      <datalist id="variant-label-suggestions">
        {LABEL_SUGGESTIONS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** The fields for the item's kind, reusing the resume editor's field groups. */
function FieldsForm({ data, update }: { data: LibraryItemData; update: Update<LibraryFields> }) {
  const narrow = <F,>() => update as unknown as Update<F>;
  switch (data.kind) {
    case "experience":
    case "project":
      return <EntryFields value={data.fields} update={narrow<LibraryFields<"experience">>()} />;
    case "publication":
      return <PaperFields value={data.fields} update={narrow<LibraryFields<"publication">>()} />;
    case "education": {
      const up = narrow<LibraryFields<"education">>();
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="School">
              <TextInput value={data.fields.school} onChange={(v) => up((f) => void (f.school = v))} />
            </Field>
            <Field label="Location">
              <TextInput value={data.fields.location} onChange={(v) => up((f) => void (f.location = v))} />
            </Field>
          </div>
          <DegreesEditor degrees={data.fields.degrees} update={(recipe) => up((f) => recipe(f.degrees))} />
        </div>
      );
    }
    case "skills": {
      const up = narrow<LibraryFields<"skills">>();
      return (
        <div className="grid grid-cols-[12rem_1fr] gap-2">
          <Field label="Category">
            <TextInput
              placeholder="Languages"
              value={data.fields.category}
              onChange={(v) => up((f) => void (f.category = v))}
            />
          </Field>
          <Field label="Skills (comma-separated)">
            <ListInput
              placeholder="Python, TypeScript, SQL"
              value={data.fields.items}
              onChange={(v) => up((f) => void (f.items = v))}
            />
          </Field>
        </div>
      );
    }
    case "summary": {
      const up = narrow<LibraryFields<"summary">>();
      return (
        <TextArea
          aria-label="Summary"
          rows={4}
          placeholder="A short professional summary…"
          value={data.fields.text}
          onChange={(v) => up((f) => void (f.text = v))}
        />
      );
    }
  }
}

function BulletPool({
  bullets,
  tagSuggestions,
  update,
}: {
  bullets: LibraryBullet[];
  tagSuggestions: string[];
  update: Update<LibraryBullet[]>;
}) {
  return (
    <div className="space-y-2">
      {bullets.length === 0 && <p className="text-sm text-zinc-500">No bullets yet.</p>}
      <SortableList
        items={bullets}
        className="space-y-2"
        onMove={(from, to) => update((b) => moveItem(b, from, to))}
        renderItem={(bullet, i, handle) => (
          <BulletCard
            bullet={bullet}
            index={i}
            tagSuggestions={tagSuggestions}
            handle={handle}
            update={(recipe) => update((b) => recipe(b[i]))}
            onDelete={() => update((b) => void b.splice(i, 1))}
          />
        )}
      />
      <AddButton onClick={() => update((b) => void b.push(newLibraryBullet()))}>Bullet</AddButton>
    </div>
  );
}

function BulletCard({
  bullet,
  index,
  tagSuggestions,
  handle,
  update,
  onDelete,
}: {
  bullet: LibraryBullet;
  index: number;
  tagSuggestions: string[];
  handle: DragHandleProps;
  update: Update<LibraryBullet>;
  onDelete: () => void;
}) {
  const hasText = bullet.variants.some((v) => v.text.trim());
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-2">
      <div className="flex items-start gap-1">
        <DragHandle handle={handle} label="Drag bullet" />
        <div className="min-w-0 flex-1 space-y-1.5">
          {bullet.variants.map((variant, j) => (
            <div key={variant.id} className="flex items-start gap-1.5">
              <TextInput
                aria-label={`Bullet ${index + 1}, variant ${j + 1} label`}
                list="variant-label-suggestions"
                placeholder="Label"
                className="!w-24 shrink-0 !text-xs"
                value={variant.label ?? ""}
                onChange={(v) => update((b) => void (b.variants[j].label = v || null))}
              />
              <TextArea
                aria-label={`Bullet ${index + 1}, variant ${j + 1}`}
                placeholder={j === 0 ? "Bullet text" : "Another wording of this bullet"}
                value={variant.text}
                onChange={(v) => update((b) => void (b.variants[j].text = v))}
              />
              {variant.source === "ai" && (
                <span
                  className="mt-1.5 shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
                  title="Written by AI"
                >
                  AI
                </span>
              )}
              {bullet.variants.length > 1 && (
                <IconButton label="Delete variant" tone="danger" onClick={() => update((b) => void b.variants.splice(j, 1))}>
                  <TrashIcon />
                </IconButton>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <AddButton onClick={() => update((b) => void b.variants.push(newVariant()))}>Variant</AddButton>
            <TagInput
              size="sm"
              aria-label={`Bullet ${index + 1} tags`}
              placeholder="Bullet tags: tech used, skill shown…"
              value={bullet.tags}
              suggestions={tagSuggestions}
              onChange={(tags) => update((b) => void (b.tags = tags))}
            />
          </div>
        </div>
        <IconButton
          label="Delete bullet"
          tone="danger"
          onClick={() => {
            if (!hasText || confirm("Delete this bullet and all its variants?")) onDelete();
          }}
        >
          <TrashIcon />
        </IconButton>
      </div>
    </div>
  );
}

/** Distinct tags (ignoring case), keeping the order of the first list. */
function mergeTags(...lists: string[][]): string[] {
  const seen = new Set<string>();
  return lists.flat().filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
}
