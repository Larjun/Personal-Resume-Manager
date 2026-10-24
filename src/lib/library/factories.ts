import { newDegree, newId } from "@/lib/resume/factories";
import type { LibraryItemData, LibraryKind, VariantSource } from "./schema";

/** Blank fields for a new library item of `kind`. */
export function emptyLibraryItem(kind: LibraryKind): LibraryItemData {
  switch (kind) {
    case "experience":
    case "project":
      return { kind, fields: { title: "", org: "", location: "", dates: { start: null, end: null } } };
    case "publication":
      return { kind, fields: { title: "", authors: "", venue: "", date: null } };
    case "education":
      return { kind, fields: { school: "", location: "", degrees: [newDegree()] } };
    case "skills":
      return { kind, fields: { category: "", items: [] } };
    case "summary":
      return { kind, fields: { text: "" } };
  }
}

/** A variant typed in the editor. The server ignores `source` and stores "user" for new variants. */
export const newVariant = (text = "", label: string | null = null) => ({
  id: newId(),
  text,
  label,
  source: "user" as VariantSource,
});

export const newLibraryBullet = (text = "") => ({ id: newId(), tags: [] as string[], variants: [newVariant(text)] });
