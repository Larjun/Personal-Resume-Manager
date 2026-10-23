"use client";

import { createContext, useContext, useState } from "react";
import {
  dateRangeIssues,
  MIN_YEAR,
  MONTHS_SHORT,
  singleDateIssues,
  type DateFormat,
  type DateRangeValue,
  type YearMonth,
} from "@/lib/resume/dates";

/** The resume's date format, provided by the Editor. */
export const DateFormatContext = createContext<DateFormat>("long");
export const useDateFormat = () => useContext(DateFormatContext);

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-1.5 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100 disabled:text-zinc-400";

const yearOptions = (extra: (number | undefined)[]) => {
  const max = new Date().getFullYear() + 8;
  const years = new Set<number>();
  for (let y = max; y >= MIN_YEAR; y--) years.add(y);
  for (const y of extra) if (y) years.add(y);
  return [...years].sort((a, b) => b - a);
};

/**
 * Month + year dropdowns. Month is optional ("—" = year only). `min` disables
 * earlier options so an end date can't be set before its start.
 */
export function MonthYearSelect({
  value,
  onChange,
  label,
  min = null,
  disabled = false,
}: {
  value: YearMonth | null;
  onChange: (value: YearMonth | null) => void;
  label: string;
  min?: YearMonth | null;
  disabled?: boolean;
}) {
  // A month picked before any year is held here until a year is chosen.
  const [pendingMonth, setPendingMonth] = useState<number | null>(null);
  const month = value ? value.month : pendingMonth;

  return (
    <div className="flex gap-1">
      <select
        aria-label={`${label} month`}
        disabled={disabled}
        className={`${selectClass} w-[4.5rem]`}
        value={month ?? ""}
        onChange={(e) => {
          const m = e.target.value ? Number(e.target.value) : null;
          if (value) onChange({ ...value, month: m });
          else setPendingMonth(m);
        }}
      >
        <option value="">—</option>
        {MONTHS_SHORT.map((name, i) => {
          const tooEarly = !!(min && value && value.year === min.year && min.month && i + 1 < min.month);
          return (
            <option key={name} value={i + 1} disabled={tooEarly}>
              {name}
            </option>
          );
        })}
      </select>
      <select
        aria-label={`${label} year`}
        disabled={disabled}
        className={`${selectClass} w-[5.25rem]`}
        value={value?.year ?? ""}
        onChange={(e) => {
          if (!e.target.value) return onChange(null);
          const year = Number(e.target.value);
          let m = value ? value.month : pendingMonth;
          // Keep the end on/after the start when switching into the start year.
          if (min && year === min.year && m !== null && min.month !== null && m < min.month) m = min.month;
          setPendingMonth(null);
          onChange({ year, month: m });
        }}
      >
        <option value="">Year</option>
        {yearOptions([value?.year, min?.year]).map((y) => (
          <option key={y} value={y} disabled={!!min && y < min.year}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DateRangeFields({
  value,
  onChange,
  allowPresent = true,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  allowPresent?: boolean;
}) {
  const format = useDateFormat();
  const present = value.end === "present";
  const issues = dateRangeIssues(value, format);
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div>
          <span className="mb-1 block text-xs font-medium text-zinc-500">Start</span>
          <MonthYearSelect label="Start" value={value.start} onChange={(start) => onChange({ ...value, start })} />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-zinc-500">End</span>
          <MonthYearSelect
            label="End"
            value={value.end === "present" ? null : value.end}
            min={value.start}
            disabled={present}
            onChange={(end) => onChange({ ...value, end })}
          />
        </div>
        {allowPresent && (
          <label className="flex items-center gap-1.5 pb-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={present}
              onChange={(e) => onChange({ ...value, end: e.target.checked ? "present" : null })}
              className="h-4 w-4 accent-zinc-900"
            />
            Present
          </label>
        )}
      </div>
      <DateIssues issues={issues} />
    </div>
  );
}

export function SingleDateField({
  value,
  onChange,
  label = "Date",
}: {
  value: YearMonth | null;
  onChange: (value: YearMonth | null) => void;
  label?: string;
}) {
  const format = useDateFormat();
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      <MonthYearSelect label={label} value={value} onChange={onChange} />
      <DateIssues issues={singleDateIssues(value, format)} />
    </div>
  );
}

function DateIssues({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-amber-700" role="status">
      {issues.map((issue) => (
        <li key={issue}>⚠ {issue}</li>
      ))}
    </ul>
  );
}
