import { describe, expect, it } from "vitest";
import { planPoolWrites, poolSignature, storedPool, type StoredBullet, type StoredVariant } from "./pool";
import { BulletPoolInputSchema } from "./schema";

const B1 = "00000000-0000-4000-8000-0000000000b1";
const B2 = "00000000-0000-4000-8000-0000000000b2";
const B3 = "00000000-0000-4000-8000-0000000000b3";
const V1 = "00000000-0000-4000-8000-0000000000a1";
const V2 = "00000000-0000-4000-8000-0000000000a2";
const V3 = "00000000-0000-4000-8000-0000000000a3";
const V4 = "00000000-0000-4000-8000-0000000000a4";

const stored = {
  bullets: [
    { id: B1, position: 0, tags: ["Python"] },
    { id: B2, position: 1, tags: [] },
  ] satisfies StoredBullet[],
  variants: [
    { id: V1, bulletId: B1, position: 0, text: "Built an API", label: null },
    { id: V2, bulletId: B1, position: 1, text: "Built a Flask API", label: "detailed" },
    { id: V3, bulletId: B2, position: 0, text: "Led a team", label: null },
  ] satisfies StoredVariant[],
};

const unchanged = () => storedPool(stored);

describe("planPoolWrites", () => {
  it("plans nothing when nothing changed", () => {
    expect(planPoolWrites(stored, unchanged())).toEqual({
      insertBullets: [],
      updateBullets: [],
      deleteBulletIds: [],
      insertVariants: [],
      updateVariants: [],
      deleteVariantIds: [],
    });
  });

  it("updates positions on reorder", () => {
    const [a, b] = unchanged();
    const plan = planPoolWrites(stored, [b, a]);
    expect(plan.updateBullets).toEqual([
      { id: B2, position: 0, tags: [] },
      { id: B1, position: 1, tags: ["Python"] },
    ]);
    expect(plan.updateVariants).toEqual([]);
  });

  it("inserts new bullets and variants, updates edited text, deletes removed ones", () => {
    const [a, b] = unchanged();
    a.variants[0].text = "Built a REST API";
    a.variants.splice(1, 1); // drop V2
    a.variants.push({ id: V4, text: "New wording", label: "short" });
    const plan = planPoolWrites(stored, [a, { id: B3, tags: [], variants: [{ id: V3.replace("a3", "a5"), text: "x", label: null }] }]);
    expect(plan.updateVariants).toEqual([{ id: V1, bulletId: B1, position: 0, text: "Built a REST API", label: null }]);
    expect(plan.insertVariants.map((v) => v.id)).toEqual([V4, V3.replace("a3", "a5")]);
    expect(plan.insertBullets.map((x) => x.id)).toEqual([B3]);
    expect(plan.deleteBulletIds).toEqual([B2]);
    // V2 is deleted explicitly; V3 goes with its bullet (cascade).
    expect(plan.deleteVariantIds).toEqual([V2]);
    void b;
  });

  it("treats an id that isn't one of this item's rows as an insert", () => {
    const foreign = "00000000-0000-4000-8000-00000000ffff";
    const plan = planPoolWrites(stored, [...unchanged(), { id: foreign, tags: [], variants: [{ id: V4, text: "", label: null }] }]);
    expect(plan.insertBullets.map((x) => x.id)).toEqual([foreign]);
    expect(plan.updateBullets).toEqual([]);
  });
});

describe("poolSignature", () => {
  it("ignores tags but not text, labels or order", () => {
    const base = poolSignature(unchanged());
    const retagged = unchanged();
    retagged[0].tags = ["Flask"];
    expect(poolSignature(retagged)).toBe(base);

    const relabeled = unchanged();
    relabeled[0].variants[0].label = "short";
    expect(poolSignature(relabeled)).not.toBe(base);

    const [a, b] = unchanged();
    expect(poolSignature([b, a])).not.toBe(base);
  });
});

describe("BulletPoolInputSchema", () => {
  it("rejects duplicate ids and normalizes labels and tags", () => {
    expect(BulletPoolInputSchema.safeParse([...unchanged(), unchanged()[0]]).success).toBe(false);
    const [parsed] = BulletPoolInputSchema.parse([
      { id: B1, tags: [" sql ", "SQL"], variants: [{ id: V1, text: "x", label: "  " }] },
    ]);
    expect(parsed.tags).toEqual(["SQL"]); // alias map: canonical spelling
    expect(parsed.variants[0].label).toBe(null);
  });
});
