import { newId as defaultNewId } from "@/lib/resume/factories";
import type { Bullet, ResumeContent } from "@/lib/resume/schema";
import { LIBRARY_FIELDS_SCHEMAS, type LibraryItemData, type LibraryKind } from "./schema";

/**
 * "Import into library": turn a resume's items into library items and link the
 * resume to them (source ids). Pure: the caller loads the library, applies the
 * plan in a transaction, and saves the returned content.
 *
 * Re-running is safe. An item already linked to a library item is skipped, and
 * an unlinked item that matches an existing library item (same kind and
 * title + organization / school / skill category / summary text) is linked to
 * it instead of duplicated; its bullets that aren't in the pool yet are appended.
 */

export type ExistingItem = LibraryItemData & {
  id: string;
  updatedAt: Date;
  bullets: { id: string; variants: { id: string; text: string }[] }[];
};

export type PlannedBullet = { id: string; tags: string[]; variants: { id: string; text: string; label: null }[] };

export type ImportPlan = {
  /** New library items, bullets included. */
  create: (LibraryItemData & { id: string; bullets: PlannedBullet[] })[];
  /** Bullets to add to the end of existing items' pools. */
  append: { itemId: string; bullets: PlannedBullet[] }[];
  /** Resume content with source ids set. */
  content: ResumeContent;
  counts: { created: number; linked: number; alreadyLinked: number; skipped: number };
};

type SourceFields = { sourceItemId: string | null; sourceItemUpdatedAt: string | null };
type Unit = { kind: LibraryKind; item: SourceFields & Record<string, unknown>; bullets: Bullet[] };

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** What makes two items "the same" for matching; "" means don't match. */
function matchKey(data: LibraryItemData): string {
  switch (data.kind) {
    case "experience":
    case "project":
      return data.fields.title || data.fields.org ? `${norm(data.fields.title)}|${norm(data.fields.org)}` : "";
    case "publication":
      return norm(data.fields.title);
    case "education":
      return norm(data.fields.school);
    case "skills":
      return norm(data.fields.category || data.fields.items.join(","));
    case "summary":
      return norm(data.fields.text);
  }
}

/** Every item in the resume that can become a library item, in resume order. */
function units(content: ResumeContent): Unit[] {
  const out: Unit[] = [];
  for (const s of content.sections) {
    switch (s.type) {
      case "summary":
        out.push({ kind: "summary", item: s, bullets: [] });
        break;
      case "entries":
        for (const e of s.entries) out.push({ kind: s.entryKind, item: e, bullets: e.bullets });
        break;
      case "publications":
        for (const p of s.papers) out.push({ kind: "publication", item: p, bullets: p.bullets });
        break;
      case "education":
        for (const school of s.schools) out.push({ kind: "education", item: school, bullets: [] });
        break;
      case "skills":
        for (const r of s.rows) out.push({ kind: "skills", item: r, bullets: [] });
        break;
    }
  }
  return out;
}

export function planResumeImport(
  input: ResumeContent,
  library: ExistingItem[],
  now: Date,
  newId: () => string = defaultNewId,
): ImportPlan {
  const content = structuredClone(input);
  const plan: ImportPlan = {
    create: [],
    append: [],
    content,
    counts: { created: 0, linked: 0, alreadyLinked: 0, skipped: 0 },
  };
  const existingIds = new Set(library.map((i) => i.id));
  // Items this run creates or appends to get updatedAt = now.
  const touched = new Set<string>();
  const linkedThisRun: { item: SourceFields; itemId: string }[] = [];

  // Candidates for matching: the existing library plus items created so far.
  const pool: { id: string; data: LibraryItemData; bullets: { id: string; variants: { id: string; text: string }[] }[] }[] =
    library.map((i) => ({ id: i.id, data: i as LibraryItemData, bullets: i.bullets }));

  const newBullet = (text: string): PlannedBullet => ({ id: newId(), tags: [], variants: [{ id: newId(), text, label: null }] });

  for (const { kind, item, bullets } of units(content)) {
    if (item.sourceItemId && existingIds.has(item.sourceItemId)) {
      plan.counts.alreadyLinked++;
      continue;
    }
    const data = { kind, fields: LIBRARY_FIELDS_SCHEMAS[kind].parse(item) } as LibraryItemData;
    const texts = bullets.filter((b) => b.text.trim());
    const key = matchKey(data);
    if (!key && texts.length === 0) {
      plan.counts.skipped++;
      continue;
    }

    let target = key ? pool.find((p) => p.data.kind === kind && matchKey(p.data) === key) : undefined;
    if (target) {
      plan.counts.linked++;
    } else {
      if (data.kind === "education") {
        // Fresh degree ids, so library rows never share ids with resume rows.
        data.fields.degrees = data.fields.degrees.map((d) => ({ ...d, id: newId() }));
      }
      const created = { ...data, id: newId(), bullets: [] as PlannedBullet[] };
      plan.create.push(created);
      target = { id: created.id, data, bullets: created.bullets };
      pool.push(target);
      plan.counts.created++;
    }
    // Link each bullet to a pool bullet with the same text, or add it to the pool.
    for (const b of texts) {
      const text = b.text.trim();
      let match: { bulletId: string; variantId: string } | undefined;
      for (const pb of target.bullets) {
        const v = pb.variants.find((x) => norm(x.text) === norm(text));
        if (v) {
          match = { bulletId: pb.id, variantId: v.id };
          break;
        }
      }
      if (!match) {
        const nb = newBullet(text);
        target.bullets.push(nb);
        if (existingIds.has(target.id)) {
          let entry = plan.append.find((a) => a.itemId === target.id);
          if (!entry) plan.append.push((entry = { itemId: target.id, bullets: [] }));
          entry.bullets.push(nb);
        }
        touched.add(target.id);
        match = { bulletId: nb.id, variantId: nb.variants[0].id };
      }
      b.sourceBulletId = match.bulletId;
      b.sourceVariantId = match.variantId;
    }
    if (!existingIds.has(target.id)) touched.add(target.id);
    item.sourceItemId = target.id;
    linkedThisRun.push({ item, itemId: target.id });
  }

  // Set copy times last: a later unit may have appended bullets to an item an
  // earlier unit linked to, which moves that item's updatedAt to `now`.
  const updatedAt = new Map(library.map((i) => [i.id, i.updatedAt.toISOString()]));
  for (const { item, itemId } of linkedThisRun) {
    item.sourceItemUpdatedAt = touched.has(itemId) ? now.toISOString() : updatedAt.get(itemId)!;
  }
  return plan;
}
