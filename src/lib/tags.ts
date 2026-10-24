/**
 * Tag normalization. Every tag is normalized before it's saved, so the same
 * tag is never stored twice under different spellings.
 */

export const MAX_TAG_LENGTH = 40;
export const MAX_TAGS = 50;

/** Trims and collapses whitespace. Returns "" for a blank tag. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH).trim();
}

/** Normalizes each tag, drops blanks and case-insensitive duplicates (the first spelling wins). */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const tag = normalizeTag(r);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}
