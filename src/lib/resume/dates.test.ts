import { describe, expect, it } from "vitest";
import {
  dateRangeIssues,
  formatRange,
  formatYearMonth,
  isEndBeforeStart,
  parseDateEnd,
  parseYearMonth,
} from "./dates";

const ym = (year: number, month: number | null = null) => ({ year, month });

describe("parseYearMonth", () => {
  it.each([
    ["August 2023", ym(2023, 8)],
    ["Aug 2023", ym(2023, 8)],
    ["Sept. 2021", ym(2021, 9)],
    ["dec, 2024", ym(2024, 12)],
    ["08/2023", ym(2023, 8)],
    ["2023-08", ym(2023, 8)],
    ["2024", ym(2024)],
    ["Spring 2022", ym(2022)],
    ["", null],
    ["soon", null],
  ])("%j → %j", (text, expected) => {
    expect(parseYearMonth(text)).toEqual(expected);
  });

  it("recognises present-like end dates", () => {
    expect(parseDateEnd("Present")).toBe("present");
    expect(parseDateEnd("current")).toBe("present");
    expect(parseDateEnd("May 2024")).toEqual(ym(2024, 5));
  });
});

describe("formatting", () => {
  it("renders every format", () => {
    expect(formatYearMonth(ym(2023, 8), "long")).toBe("August 2023");
    expect(formatYearMonth(ym(2023, 8), "short")).toBe("Aug 2023");
    expect(formatYearMonth(ym(2023, 8), "numeric")).toBe("08/2023");
    expect(formatYearMonth(ym(2023, 8), "year")).toBe("2023");
    expect(formatYearMonth(ym(2023), "long")).toBe("2023");
  });

  it("renders ranges with Present and collapses identical years", () => {
    expect(formatRange({ start: ym(2026, 7), end: "present" }, "long")).toBe("July 2026 - Present");
    expect(formatRange({ start: ym(2023, 1), end: ym(2023, 5) }, "year")).toBe("2023");
    expect(formatRange({ start: null, end: null }, "long")).toBe("");
    expect(formatRange({ start: ym(2020, 1), end: null }, "short")).toBe("Jan 2020");
  });
});

describe("validation", () => {
  it("detects end before start, treating year-only dates generously", () => {
    expect(isEndBeforeStart({ start: ym(2024, 5), end: ym(2024, 4) })).toBe(true);
    expect(isEndBeforeStart({ start: ym(2024, 5), end: ym(2024) })).toBe(false);
    expect(isEndBeforeStart({ start: ym(2024, 5), end: "present" })).toBe(false);
  });

  it("flags missing months only when the format shows months", () => {
    const range = { start: ym(2022), end: ym(2023, 4) };
    expect(dateRangeIssues(range, "long")).toEqual(["Add a month to the start date (your date format shows months)."]);
    expect(dateRangeIssues(range, "year")).toEqual([]);
  });

  it("flags an end date without a start", () => {
    expect(dateRangeIssues({ start: null, end: ym(2023, 1) }, "long")).toEqual(["Add a start date."]);
    expect(dateRangeIssues({ start: null, end: "present" }, "long")).toEqual([]);
  });
});
