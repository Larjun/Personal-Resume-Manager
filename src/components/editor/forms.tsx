"use client";

import { useState, type ReactNode } from "react";
import { newBullet, newLink, newDegree, newEntry, newPaper, newSchool, newSkillRow } from "@/lib/resume/factories";
import type { Bullet, Entry, Header, Paper, School, Section } from "@/lib/resume/schema";
import { dateRangeIssues, formatRange, formatYearMonth, singleDateIssues } from "@/lib/resume/dates";
import { DateRangeFields, SingleDateField, useDateFormat } from "./dateFields";
import {
  AddButton,
  ChevronIcon,
  Field,
  IconButton,
  ListInput,
  TextArea,
  TextInput,
  TrashIcon,
} from "./fields";
import { DragHandle, moveItem, SortableList, type DragHandleProps } from "./SortableList";

/** Applies an immer recipe to one piece of the resume. */
export type Update<T> = (recipe: (draft: T) => void) => void;

type SectionOf<K extends Section["type"]> = Extract<Section, { type: K }>;

const SECTION_LABEL: Record<Section["type"], string> = {
  summary: "Summary",
  entries: "Entries",
  publications: "Publications",
  education: "Education",
  skills: "Skills",
};

const card = "rounded-lg border border-zinc-200 bg-white";

// ── Header ─────────────────────────────────────────────────────────────

export function HeaderForm({ header, update }: { header: Header; update: Update<Header> }) {
  return (
    <div className={`${card} space-y-3 p-4`}>
      <h2 className="text-sm font-semibold">Header</h2>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name" className="col-span-2">
          <TextInput value={header.name} onChange={(v) => update((h) => void (h.name = v))} />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            placeholder="you@example.com"
            value={header.email}
            onChange={(v) => update((h) => void (h.email = v))}
          />
        </Field>
        <Field label="Phone">
          <TextInput
            type="tel"
            placeholder="+1 555 123 4567"
            value={header.phone}
            onChange={(v) => update((h) => void (h.phone = v))}
          />
        </Field>
        <Field label="Location" className="col-span-2">
          <TextInput
            placeholder="City, Country"
            value={header.location}
            onChange={(v) => update((h) => void (h.location = v))}
          />
        </Field>
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-zinc-500">Links (LinkedIn, website, GitHub…)</span>
        <SortableList
          items={header.links}
          className="space-y-1.5"
          onMove={(from, to) => update((h) => moveItem(h.links, from, to))}
          renderItem={(link, i, handle) => (
            <div className="flex items-center gap-1.5">
              <DragHandle handle={handle} label="Drag link" />
              <TextInput
                aria-label="Link URL"
                placeholder="https://linkedin.com/in/you"
                value={link.url}
                onChange={(v) => update((h) => void (h.links[i].url = v))}
              />
              <TextInput
                aria-label="Link label"
                placeholder="Label (optional)"
                className="!w-44 shrink-0"
                value={link.text}
                onChange={(v) => update((h) => void (h.links[i].text = v))}
              />
              <IconButton label="Remove link" tone="danger" onClick={() => update((h) => void h.links.splice(i, 1))}>
                <TrashIcon />
              </IconButton>
            </div>
          )}
        />
        <div className="mt-1.5">
          <AddButton onClick={() => update((h) => void h.links.push(newLink()))}>Link</AddButton>
        </div>
      </div>
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────

export function SectionCard({
  section,
  update,
  onDelete,
  handle,
}: {
  section: Section;
  update: Update<Section>;
  onDelete: () => void;
  handle: DragHandleProps;
}) {
  return (
    <div className={card}>
      <div className="flex items-center gap-1 border-b border-zinc-100 px-2 py-2">
        <DragHandle handle={handle} label="Drag section" />
        <input
          aria-label="Section heading"
          value={section.heading}
          onChange={(e) => {
            const v = e.target.value;
            update((s) => void (s.heading = v));
          }}
          className="min-w-0 flex-1 rounded px-1.5 py-1 text-sm font-semibold outline-none hover:bg-zinc-50 focus:bg-zinc-50 focus:ring-1 focus:ring-zinc-300"
        />
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {SECTION_LABEL[section.type]}
        </span>
        <IconButton
          label="Delete section"
          tone="danger"
          onClick={() => {
            if (confirm(`Delete the "${section.heading}" section?`)) onDelete();
          }}
        >
          <TrashIcon />
        </IconButton>
      </div>
      <div className="p-3">
        <SectionBody section={section} update={update} />
      </div>
    </div>
  );
}

function SectionBody({ section, update }: { section: Section; update: Update<Section> }) {
  // Narrow the updater to the section's concrete type.
  const narrow = <K extends Section["type"]>() => update as unknown as Update<SectionOf<K>>;
  switch (section.type) {
    case "summary":
      return (
        <TextArea
          aria-label="Summary"
          rows={3}
          value={section.text}
          onChange={(v) => narrow<"summary">()((s) => void (s.text = v))}
        />
      );
    case "entries":
      return <EntriesForm section={section} update={narrow<"entries">()} />;
    case "publications":
      return <PublicationsForm section={section} update={narrow<"publications">()} />;
    case "education":
      return <EducationForm section={section} update={narrow<"education">()} />;
    case "skills":
      return <SkillsForm section={section} update={narrow<"skills">()} />;
  }
}

// ── Entries (experience / projects) ────────────────────────────────────

function EntriesForm({ section, update }: { section: SectionOf<"entries">; update: Update<SectionOf<"entries">> }) {
  return (
    <div className="space-y-2">
      <SortableList
        items={section.entries}
        className="space-y-2"
        onMove={(from, to) => update((s) => moveItem(s.entries, from, to))}
        renderItem={(entry, i, handle) => (
          <EntryCard
            entry={entry}
            handle={handle}
            update={(recipe) => update((s) => recipe(s.entries[i]))}
            onDelete={() => update((s) => void s.entries.splice(i, 1))}
          />
        )}
      />
      <AddButton onClick={() => update((s) => void s.entries.push(newEntry()))}>Entry</AddButton>
    </div>
  );
}

function EntryCard({
  entry,
  update,
  onDelete,
  handle,
}: {
  entry: Entry;
  update: Update<Entry>;
  onDelete: () => void;
  handle: DragHandleProps;
}) {
  const format = useDateFormat();
  return (
    <CollapsibleItem
      summary={[entry.title, entry.org].filter(Boolean).join(" | ") || "Untitled entry"}
      meta={formatRange(entry.dates, format)}
      hasIssues={dateRangeIssues(entry.dates, format).length > 0}
      startOpen={!entry.title && !entry.org}
      visible={entry.visible}
      onVisibleChange={(v) => update((e) => void (e.visible = v))}
      onDelete={onDelete}
      handle={handle}
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Title">
          <TextInput value={entry.title} onChange={(v) => update((e) => void (e.title = v))} />
        </Field>
        <Field label="Organization">
          <TextInput value={entry.org} onChange={(v) => update((e) => void (e.org = v))} />
        </Field>
        <Field label="Location" className="col-span-2">
          <TextInput value={entry.location} onChange={(v) => update((e) => void (e.location = v))} />
        </Field>
      </div>
      <DateRangeFields value={entry.dates} onChange={(dates) => update((e) => void (e.dates = dates))} />
      <BulletsEditor bullets={entry.bullets} update={(recipe) => update((e) => recipe(e.bullets))} />
    </CollapsibleItem>
  );
}

// ── Publications ───────────────────────────────────────────────────────

function PublicationsForm({
  section,
  update,
}: {
  section: SectionOf<"publications">;
  update: Update<SectionOf<"publications">>;
}) {
  return (
    <div className="space-y-2">
      <SortableList
        items={section.papers}
        className="space-y-2"
        onMove={(from, to) => update((s) => moveItem(s.papers, from, to))}
        renderItem={(paper, i, handle) => (
          <PaperCard
            paper={paper}
            handle={handle}
            update={(recipe) => update((s) => recipe(s.papers[i]))}
            onDelete={() => update((s) => void s.papers.splice(i, 1))}
          />
        )}
      />
      <AddButton onClick={() => update((s) => void s.papers.push(newPaper()))}>Paper</AddButton>
    </div>
  );
}

function PaperCard({
  paper,
  update,
  onDelete,
  handle,
}: {
  paper: Paper;
  update: Update<Paper>;
  onDelete: () => void;
  handle: DragHandleProps;
}) {
  const format = useDateFormat();
  return (
    <CollapsibleItem
      summary={paper.title || "Untitled paper"}
      meta={formatYearMonth(paper.date, format)}
      hasIssues={singleDateIssues(paper.date, format).length > 0}
      startOpen={!paper.title}
      visible={paper.visible}
      onVisibleChange={(v) => update((p) => void (p.visible = v))}
      onDelete={onDelete}
      handle={handle}
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Title" className="col-span-2">
          <TextInput value={paper.title} onChange={(v) => update((p) => void (p.title = v))} />
        </Field>
        <Field label="Authors" className="col-span-2">
          <TextInput
            placeholder="A. Lovelace, C. Babbage"
            value={paper.authors}
            onChange={(v) => update((p) => void (p.authors = v))}
          />
        </Field>
        <Field label="Venue">
          <TextInput
            placeholder="NeurIPS 2025 / Nature / arXiv"
            value={paper.venue}
            onChange={(v) => update((p) => void (p.venue = v))}
          />
        </Field>
        <SingleDateField value={paper.date} onChange={(date) => update((p) => void (p.date = date))} />
        <Field label="Link (DOI / URL)" className="col-span-2">
          <TextInput
            placeholder="https://doi.org/…"
            value={paper.url ?? ""}
            onChange={(v) =>
              update((p) => {
                if (v) p.url = v;
                else delete p.url;
              })
            }
          />
        </Field>
      </div>
      <BulletsEditor
        label="Bullets (optional)"
        bullets={paper.bullets}
        update={(recipe) => update((p) => recipe(p.bullets))}
      />
    </CollapsibleItem>
  );
}

// ── Shared item pieces ─────────────────────────────────────────────────

/**
 * A collapsible row for an experience/project entry or a paper: drag handle,
 * include checkbox, summary toggle and delete. Fields render when open.
 */
function CollapsibleItem({
  summary,
  meta,
  hasIssues = false,
  startOpen,
  visible,
  onVisibleChange,
  onDelete,
  handle,
  children,
}: {
  summary: string;
  meta: string;
  /** Shows a warning marker on the collapsed row (e.g. inconsistent dates). */
  hasIssues?: boolean;
  /** Existing items start collapsed; a freshly added (blank) one opens for editing. */
  startOpen: boolean;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onDelete: () => void;
  handle: DragHandleProps;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className={`rounded-md border border-zinc-200 ${visible ? "bg-zinc-50/60" : "bg-zinc-100/70"}`}>
      <div className="flex items-center gap-1 p-1.5">
        <DragHandle handle={handle} label="Drag item" />
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => onVisibleChange(e.target.checked)}
          aria-label={`Include "${summary}" in resume`}
          title={visible ? "Included in resume (uncheck to hide)" : "Hidden from resume (check to include)"}
          className="mx-1 h-4 w-4 shrink-0 cursor-pointer accent-zinc-900"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-zinc-100"
        >
          <span className="text-zinc-400">
            <ChevronIcon open={open} />
          </span>
          <span className={`truncate text-sm font-medium ${visible ? "" : "text-zinc-400 line-through"}`}>{summary}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 text-xs text-zinc-500">
            {meta}
            {hasIssues && (
              <span className="text-amber-600" title="Date needs attention" aria-label="Date needs attention">
                ⚠
              </span>
            )}
          </span>
        </button>
        <IconButton
          label="Delete item"
          tone="danger"
          onClick={() => {
            if (confirm(`Delete "${summary}"? To keep it but leave it off the resume, uncheck it instead.`)) onDelete();
          }}
        >
          <TrashIcon />
        </IconButton>
      </div>
      {open && <div className="space-y-2 border-t border-zinc-200 p-2 pl-8">{children}</div>}
    </div>
  );
}

function BulletsEditor({
  bullets,
  update,
  label = "Bullets",
}: {
  bullets: Bullet[];
  update: Update<Bullet[]>;
  label?: string;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      <SortableList
        items={bullets}
        className="space-y-1.5"
        onMove={(from, to) => update((b) => moveItem(b, from, to))}
        renderItem={(bullet, i, handle) => (
          <div className="flex items-start gap-1">
            <DragHandle handle={handle} label="Drag bullet" />
            <TextArea aria-label={`Bullet ${i + 1}`} value={bullet.text} onChange={(v) => update((b) => void (b[i].text = v))} />
            <IconButton label="Delete bullet" tone="danger" onClick={() => update((b) => void b.splice(i, 1))}>
              <TrashIcon />
            </IconButton>
          </div>
        )}
      />
      <div className="mt-1.5">
        <AddButton onClick={() => update((b) => void b.push(newBullet()))}>Bullet</AddButton>
      </div>
    </div>
  );
}

// ── Education ──────────────────────────────────────────────────────────

function EducationForm({
  section,
  update,
}: {
  section: SectionOf<"education">;
  update: Update<SectionOf<"education">>;
}) {
  return (
    <div className="space-y-2">
      <SortableList
        items={section.schools}
        className="space-y-2"
        onMove={(from, to) => update((s) => moveItem(s.schools, from, to))}
        renderItem={(school, i, handle) => (
          <SchoolCard
            school={school}
            handle={handle}
            update={(recipe) => update((s) => recipe(s.schools[i]))}
            onDelete={() => update((s) => void s.schools.splice(i, 1))}
          />
        )}
      />
      <AddButton onClick={() => update((s) => void s.schools.push(newSchool()))}>School</AddButton>
    </div>
  );
}

function SchoolCard({
  school,
  update,
  onDelete,
  handle,
}: {
  school: School;
  update: Update<School>;
  onDelete: () => void;
  handle: DragHandleProps;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-2">
      <div className="flex items-start gap-1">
        <DragHandle handle={handle} label="Drag school" />
        <div className="grid flex-1 grid-cols-2 gap-2">
          <Field label="School">
            <TextInput value={school.school} onChange={(v) => update((s) => void (s.school = v))} />
          </Field>
          <Field label="Location">
            <TextInput value={school.location} onChange={(v) => update((s) => void (s.location = v))} />
          </Field>
        </div>
        <IconButton label="Delete school" tone="danger" onClick={onDelete}>
          <TrashIcon />
        </IconButton>
      </div>
      <div className="mt-2 pl-6">
        <span className="mb-1 block text-xs font-medium text-zinc-500">Degrees</span>
        <SortableList
          items={school.degrees}
          className="space-y-1.5"
          onMove={(from, to) => update((s) => moveItem(s.degrees, from, to))}
          renderItem={(degree, i, handle) => (
            <div className="flex items-start gap-1 rounded-md border border-zinc-200 bg-white p-1.5">
              <DragHandle handle={handle} label="Drag degree" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <TextInput
                  aria-label="Degree"
                  placeholder="BS in Computer Science"
                  value={degree.name}
                  onChange={(v) => update((s) => void (s.degrees[i].name = v))}
                />
                <DateRangeFields
                  value={degree.dates}
                  onChange={(dates) => update((s) => void (s.degrees[i].dates = dates))}
                />
              </div>
              <IconButton label="Delete degree" tone="danger" onClick={() => update((s) => void s.degrees.splice(i, 1))}>
                <TrashIcon />
              </IconButton>
            </div>
          )}
        />
        <div className="mt-1.5">
          <AddButton onClick={() => update((s) => void s.degrees.push(newDegree()))}>Degree</AddButton>
        </div>
      </div>
    </div>
  );
}

// ── Skills ─────────────────────────────────────────────────────────────

function SkillsForm({ section, update }: { section: SectionOf<"skills">; update: Update<SectionOf<"skills">> }) {
  return (
    <div className="space-y-1.5">
      <SortableList
        items={section.rows}
        className="space-y-1.5"
        onMove={(from, to) => update((s) => moveItem(s.rows, from, to))}
        renderItem={(row, i, handle) => (
          <div className="flex items-center gap-1">
            <DragHandle handle={handle} label="Drag row" />
            <TextInput
              aria-label="Category"
              placeholder="Category"
              className="!w-40 shrink-0"
              value={row.category}
              onChange={(v) => update((s) => void (s.rows[i].category = v))}
            />
            <ListInput
              aria-label="Skills (comma-separated)"
              placeholder="React, TypeScript, …"
              value={row.items}
              onChange={(v) => update((s) => void (s.rows[i].items = v))}
            />
            <IconButton label="Delete row" tone="danger" onClick={() => update((s) => void s.rows.splice(i, 1))}>
              <TrashIcon />
            </IconButton>
          </div>
        )}
      />
      <AddButton onClick={() => update((s) => void s.rows.push(newSkillRow()))}>Skill row</AddButton>
    </div>
  );
}
