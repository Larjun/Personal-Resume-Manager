import type { PageSize } from "@/lib/resume/schema";

// All page geometry lives here. CSS px at 96dpi; 1pt = 96/72 px.
export const PX_PER_IN = 96;
export const PX_PER_PT = PX_PER_IN / 72;
const mm = (v: number) => (v / 25.4) * PX_PER_IN;
const inch = (v: number) => v * PX_PER_IN;

export type PageGeometry = {
  /** Value for CSS `@page { size }`. */
  cssSize: string;
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  contentWidth: number;
  contentHeight: number;
};

// Matches seed/resume.pdf: 0.4in sides, ~0.3in top.
const MARGIN = { top: inch(0.3), right: inch(0.4), bottom: inch(0.4), left: inch(0.4) };

function geometry(cssSize: string, width: number, height: number): PageGeometry {
  return {
    cssSize,
    width,
    height,
    margin: MARGIN,
    contentWidth: width - MARGIN.left - MARGIN.right,
    contentHeight: height - MARGIN.top - MARGIN.bottom,
  };
}

export const PAGE_GEOMETRY: Record<PageSize, PageGeometry> = {
  Letter: geometry("letter", inch(8.5), inch(11)),
  A4: geometry("A4", mm(210), mm(297)),
};
