import { describe, expect, it } from "vitest";
import { emptyResume, newEntry, newPaper, newSection } from "@/lib/resume/factories";
import { sourceItemIds } from "./links";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

describe("sourceItemIds", () => {
  it("collects distinct, well-formed source ids from every section type", () => {
    const content = emptyResume();
    for (const section of content.sections) {
      if (section.type === "summary") section.sourceItemId = A;
      if (section.type === "entries")
        section.entries = [
          { ...newEntry(), sourceItemId: B },
          { ...newEntry(), sourceItemId: A }, // duplicate
          { ...newEntry(), sourceItemId: "not-a-uuid" },
          newEntry(), // not from the library
        ];
    }
    const pubs = newSection("publications");
    if (pubs.type === "publications") pubs.papers = [{ ...newPaper(), sourceItemId: B }];
    content.sections.push(pubs);

    expect(sourceItemIds(content).sort()).toEqual([A, B]);
  });

  it("returns nothing for a resume that never used the library", () => {
    expect(sourceItemIds(emptyResume())).toEqual([]);
  });
});
