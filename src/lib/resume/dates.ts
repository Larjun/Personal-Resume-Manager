/**
 * Structured dates. Every date on a resume is rendered through `formatYearMonth`
 * with the resume's single `dateFormat`, so dates are always consistent.
 */

export type YearMonth = { year: number; month: number | null };
export type DateEnd = YearMonth | "present" | null;
export type DateRangeValue = { start: YearMonth | null; end: DateEnd };

export const DATE_FORMATS = ["long", "short", "numeric", "year"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));

export const DATE_FORMAT_LABEL: Record<DateFormat, string> = {
  long: "August 2023",
  short: "Aug 2023",
  numeric: "08/2023",
  year: "2023",
};

export const MIN_YEAR = 1950;

export function formatYearMonth(d: YearMonth | null, format: DateFormat): string {
  if (!d) return "";
  if (d.month === null || format === "year") return String(d.year);
  switch (format) {
    case "long":
      return `${MONTHS_LONG[d.month - 1]} ${d.year}`;
    case "short":
      return `${MONTHS_SHORT[d.month - 1]} ${d.year}`;
    case "numeric":
      return `${String(d.month).padStart(2, "0")}/${d.year}`;
  }
}

export function formatEnd(end: DateEnd, format: DateFormat): string {
  return end === "present" ? "Present" : formatYearMonth(end, format);
}

export function formatRange({ start, end }: DateRangeValue, format: DateFormat): string {
  const a = formatYearMonth(start, format);
  const b = formatEnd(end, format);
  // In year-only format, "2023 - 2023" collapses to "2023".
  if (a && b && a === b) return a;
  return a && b ? `${a} - ${b}` : a || b;
}

/** Comparable month index; a year-only date counts as January (start) or December (end). */
const ordinal = (d: YearMonth, side: "start" | "end") => d.year * 12 + ((d.month ?? (side === "start" ? 1 : 12)) - 1);

export function isEndBeforeStart({ start, end }: DateRangeValue): boolean {
  if (!start || !end || end === "present") return false;
  return ordinal(end, "end") < ordinal(start, "start");
}

/** Human-readable problems with a date range under the resume's format. */
export function dateRangeIssues(range: DateRangeValue, format: DateFormat): string[] {
  const issues: string[] = [];
  const { start, end } = range;
  if (isEndBeforeStart(range)) issues.push("End date is before the start date.");
  if (format !== "year") {
    const missing = [start && start.month === null && "start", end && end !== "present" && end.month === null && "end"]
      .filter(Boolean)
      .join(" and ");
    if (missing) issues.push(`Add a month to the ${missing} date (your date format shows months).`);
  }
  if (!start && end && end !== "present") issues.push("Add a start date.");
  return issues;
}

export function singleDateIssues(d: YearMonth | null, format: DateFormat): string[] {
  return d && d.month === null && format !== "year" ? ["Add a month (your date format shows months)."] : [];
}

const MONTH_LOOKUP = new Map<string, number>(
  MONTHS_LONG.flatMap((m, i) => [
    [m.toLowerCase(), i + 1],
    [m.slice(0, 3).toLowerCase(), i + 1],
    [m.slice(0, 4).toLowerCase(), i + 1], // "Sept"
  ]),
);

/**
 * Best-effort parse of free-text dates ("August 2023", "Aug. 2023", "08/2023",
 * "2023-08", "2023"). Returns null for blanks; unrecognised text falls back to
 * any four-digit year it contains.
 */
export function parseYearMonth(text: string): YearMonth | null {
  const t = text.trim().toLowerCase().replace(/\./g, "");
  if (!t) return null;
  let m = t.match(/^([a-z]+),?\s+(\d{4})$/);
  if (m && MONTH_LOOKUP.has(m[1])) return { year: +m[2], month: MONTH_LOOKUP.get(m[1])! };
  m = t.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { year: +m[2], month: +m[1] };
  m = t.match(/^(\d{4})[/-](\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return { year: +m[1], month: +m[2] };
  m = t.match(/\b(\d{4})\b/);
  return m ? { year: +m[1], month: null } : null;
}

export function parseDateEnd(text: string): DateEnd {
  return /^(present|current|now|ongoing|today)$/i.test(text.trim()) ? "present" : parseYearMonth(text);
}

export function parseDateRange(start: string, end: string): DateRangeValue {
  return { start: parseYearMonth(start), end: parseDateEnd(end) };
}
