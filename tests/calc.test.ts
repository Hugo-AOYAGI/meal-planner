import { describe, expect, test } from "bun:test";
import { recipeNutrition, type NutritionLine } from "@shared/calc/nutrition";
import { scale } from "@shared/calc/scale";
import { aggregateShopping, type ShoppingSourceLine } from "@server/services/calc/shopping";
import { createBalance } from "@server/services/calc/balance";
import { drawMeals, weight, type DrawCandidate } from "@server/services/calc/draw";

describe("scale", () => {
  test("value x servings / base, null stays null", () => {
    expect(scale(200, 4, 6)).toBe(300);
    expect(scale(null, 4, 6)).toBeNull();
  });
});

const ing = (kcal: number | null, source = "ciqual") => ({ kcal, protein: 10, carbs: 20, fat: 5, fibre: 2, source });
const line = (grams: number | null, ingredient = ing(100), gramsEstimated = false): NutritionLine => ({
  grams,
  gramsEstimated,
  ingredient,
});

describe("recipeNutrition", () => {
  test("sums grams x per100 / 100, divided by base servings", () => {
    const n = recipeNutrition([line(200), line(100)], 3);
    expect(n.perPerson.kcal).toBeCloseTo(100);
    expect(n.perPerson.protein).toBeCloseTo(10);
    expect(n.partial).toBe(false);
    expect(n.estimated).toBe(false);
  });
  test("lines without grams or values are skipped and mark partial", () => {
    const n = recipeNutrition([line(200), line(null), line(100, ing(null))], 2);
    expect(n.perPerson.kcal).toBeCloseTo(100);
    expect(n).toMatchObject({ partial: true, linesCounted: 1, linesTotal: 3 });
  });
  test("estimated grams or estimated ingredient mark estimated", () => {
    expect(recipeNutrition([line(100, ing(100), true)], 1).estimated).toBe(true);
    expect(recipeNutrition([line(100, ing(100, "estimated"))], 1).estimated).toBe(true);
    expect(recipeNutrition([line(null, ing(100, "estimated"))], 1).estimated).toBe(false);
  });
  test("detail values: sum of the lines that have them, partial when one lacks it, null when none has it", () => {
    const { extras } = recipeNutrition(
      [{ ...line(200), extras: { iron: 2, calcium: 50 } }, { ...line(100), extras: { iron: 4 } }, line(null)],
      2,
    );
    expect(extras.perPerson.iron).toBeCloseTo(4);
    expect(extras.perPerson.calcium).toBeCloseTo(50);
    expect(extras.perPerson.zinc).toBeNull();
    expect(extras.partial).toContain("iron");
    expect(recipeNutrition([{ ...line(100), extras: { iron: 2 } }], 1).extras.partial).not.toContain("iron");
  });
});

const src = (o: Partial<ShoppingSourceLine>): ShoppingSourceLine => ({
  ingredientId: 1,
  ingredientName: "Oignons",
  aisle: "fruits_legumes",
  quantity: 2,
  unit: "",
  grams: 200,
  baseServings: 2,
  slotServings: 2,
  mealName: "Soupe",
  date: "2026-11-14",
  ...o,
});

describe("aggregateShopping", () => {
  test("scales per slot, sums per unit, lists meals, groups by aisle", () => {
    const aisles = aggregateShopping(
      [
        src({}),
        src({ slotServings: 4, mealName: "Tarte" }),
        src({ unit: "g", quantity: 50, grams: 50 }),
        src({ ingredientId: 2, ingredientName: "Lait", aisle: "cremerie", quantity: 1, unit: "l", grams: 1000 }),
      ],
      new Map([[2, "2026-11-14"]]),
    );
    expect(aisles.map((a) => a.aisle)).toEqual(["fruits_legumes", "cremerie"]);
    const oignons = aisles[0]!.items[0]!;
    expect(oignons.quantities).toEqual([
      { unit: "", quantity: 6 },
      { unit: "g", quantity: 50 },
    ]);
    expect(oignons.totalGrams).toBe(650);
    expect(oignons.meals).toEqual(["Soupe", "Tarte"]);
    expect(aisles[1]!.items[0]!.checked).toBe(true);
  });
  test("total grams is null when a line has none", () => {
    const [a] = aggregateShopping([src({}), src({ grams: null })]);
    expect(a!.items[0]!.totalGrams).toBeNull();
  });
  test("an ingredient bought until a day only lists what is planned after it", () => {
    const lines = [src({}), src({ date: "2026-11-18", slotServings: 4, mealName: "Tarte" })];
    const item = (until: string) => aggregateShopping(lines, new Map([[1, until]]))[0]!.items[0]!;
    expect(item("2026-11-16")).toMatchObject({
      checked: false,
      quantities: [{ unit: "", quantity: 4 }],
      meals: ["Tarte"],
    });
    expect(item("2026-11-18")).toMatchObject({
      checked: true,
      quantities: [{ unit: "", quantity: 6 }],
      meals: ["Soupe", "Tarte"],
    });
  });
});

function seeded(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
}
const meal = (
  id: number,
  kind: DrawCandidate["kind"],
  lastCooked: string | null = "2026-01-01",
  status: DrawCandidate["status"] = "regular",
): DrawCandidate => ({ id, kind, status, lastCooked });

describe("draw", () => {
  const today = "2026-11-14";
  test("weights: older is heavier, never cooked is heaviest, to_try is a fixed low weight", () => {
    expect(weight(meal(1, "plat", "2026-11-04"), today)).toBe(10);
    expect(weight(meal(1, "plat", null), today)).toBe(365);
    expect(weight(meal(1, "plat", null, "to_try"), today)).toBe(30);
  });
  test("a protein gets a starch and a vegetable; a dish stands alone; no repeats", () => {
    const pool = [meal(1, "proteine"), meal(2, "feculent"), meal(3, "legume"), meal(4, "plat")];
    const slots = [
      { date: "2026-11-15", moment: "midi" as const },
      { date: "2026-11-15", moment: "soir" as const },
      { date: "2026-11-16", moment: "midi" as const },
    ];
    const out = drawMeals(slots, pool, [], today, seeded(7));
    const all = out.flatMap((o) => o.mealIds);
    expect(new Set(all).size).toBe(all.length);
    for (const { mealIds } of out) {
      if (mealIds.includes(1)) expect(mealIds.sort()).toEqual([1, 2, 3]);
      if (mealIds.includes(4)) expect(mealIds).toEqual([4]);
    }
    expect(out[2]!.mealIds).toEqual([]); // library exhausted
  });
  test("starters and desserts are never drawn", () => {
    const pool = [meal(1, "entree", null), meal(2, "dessert", null), meal(3, "plat")];
    const out = drawMeals(
      [
        { date: "d", moment: "midi" },
        { date: "d", moment: "soir" },
      ],
      pool,
      [],
      today,
      seeded(3),
    );
    expect(out.map((o) => o.mealIds)).toEqual([[3], []]);
  });
  test("meals already in the week are excluded; heavy meals win more often", () => {
    const pool = [meal(1, "plat", "2026-11-13"), meal(2, "plat", "2025-01-01"), meal(3, "plat", null)];
    expect(drawMeals([{ date: "d", moment: "midi" }], pool, [2, 3], today, seeded(1))[0]!.mealIds).toEqual([1]);
    const rnd = seeded(42);
    const wins = { 1: 0, 2: 0 };
    for (let i = 0; i < 500; i++)
      wins[drawMeals([{ date: "d", moment: "midi" }], pool.slice(0, 2), [], today, rnd)[0]!.mealIds[0] as 1 | 2]++;
    expect(wins[2]).toBeGreaterThan(wins[1] * 10);
  });
});

describe("balance", () => {
  test("favours the meals that make up for what the plan lacks, and unknown meals are neutral", () => {
    const rich = { protein: 30, fibre: 10 };
    const lacking = createBalance({ days: 1, protein: 0, fibre: 0 });
    const fed = createBalance({ days: 1, protein: 60, fibre: 25 });
    expect(lacking.bias(rich)).toBe(3);
    expect(fed.bias(rich)).toBe(1);
    expect(lacking.bias()).toBe(1);
    lacking.add({ protein: 60, fibre: 25 });
    expect(lacking.bias(rich)).toBe(1);
  });
});
