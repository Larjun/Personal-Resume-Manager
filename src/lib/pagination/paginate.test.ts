import { describe, expect, it } from "vitest";
import { paginate, type MeasuredBlock } from "./paginate";

const b = (key: string, height: number, keepWithNext = false): MeasuredBlock => ({ key, height, keepWithNext });
const keys = (blocks: MeasuredBlock[], pageHeight: number) => paginate(blocks, pageHeight).map((p) => p.keys);

describe("paginate", () => {
  it("puts everything on one page when it fits", () => {
    expect(keys([b("a", 30), b("b", 30), b("c", 40)], 100)).toEqual([["a", "b", "c"]]);
  });

  it("returns one empty page for no blocks", () => {
    expect(keys([], 100)).toEqual([[]]);
  });

  it("splits a bullet list between bullets", () => {
    const blocks = [b("hdr", 20, true), b("b1", 30), b("b2", 30), b("b3", 30)];
    expect(keys(blocks, 100)).toEqual([["hdr", "b1", "b2"], ["b3"]]);
  });

  it("keeps a section heading with its entry header and first bullet", () => {
    // heading+entry would fit at the bottom of page 1, but the first bullet wouldn't.
    const blocks = [b("intro", 60), b("heading", 10, true), b("entry", 10, true), b("b1", 30), b("b2", 30)];
    expect(keys(blocks, 100)).toEqual([["intro"], ["heading", "entry", "b1", "b2"]]);
  });

  it("keeps an entry header with its first bullet but lets later bullets split", () => {
    const blocks = [b("intro", 70), b("entry", 10, true), b("b1", 25), b("b2", 25)];
    expect(keys(blocks, 100)).toEqual([["intro"], ["entry", "b1", "b2"]]);
  });

  it("treats a page boundary that exactly fits as fitting", () => {
    expect(keys([b("a", 50), b("b", 50), b("c", 1)], 100)).toEqual([["a", "b"], ["c"]]);
  });

  it("breaks up a chain taller than a page instead of looping", () => {
    const blocks = [b("h", 40, true), b("e", 40, true), b("x", 40)];
    expect(keys(blocks, 100)).toEqual([["h", "e"], ["x"]]);
  });

  it("gives an oversized block its own page and flags the overflow", () => {
    const pages = paginate([b("a", 20), b("huge", 150), b("c", 20)], 100);
    expect(pages.map((p) => p.keys)).toEqual([["a"], ["huge"], ["c"]]);
    expect(pages.map((p) => p.overflows)).toEqual([false, true, false]);
  });

  it("reports the used height per page", () => {
    expect(paginate([b("a", 30.5), b("b", 40.25)], 100)[0].height).toBeCloseTo(70.75);
  });
});
