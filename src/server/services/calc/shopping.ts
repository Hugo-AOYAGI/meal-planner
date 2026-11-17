import type { Aisle, Moment } from "@shared/constants";
import { AISLES } from "@shared/constants";
import { scale } from "@shared/calc/scale";
import type { ShoppingItem } from "@shared/schemas";

/** One recipe line of a planned entry, with the slot's date and servings. */
export interface ShoppingSourceLine {
  ingredientId: number;
  ingredientName: string;
  aisle: Aisle;
  quantity: number | null;
  unit: string;
  grams: number | null;
  baseServings: number;
  slotServings: number;
  mealId: number;
  mealName: string;
  /** slot the meal is planned in */
  date: string;
  moment: Moment;
}

/** What a tick covers: this ingredient for this planned meal. */
export const boughtKey = (l: { ingredientId: number; date: string; moment: string; mealId: number }) =>
  `${l.ingredientId}/${l.date}/${l.moment}/${l.mealId}`;

const round = (n: number) => Math.round(n * 100) / 100;

/** Sums an ingredient's lines: quantities per unit; total grams only when every line has grams; a line with no quantity adds nothing. */
function toItem(lines: ShoppingSourceLine[], checked: boolean): ShoppingItem {
  const quantities: ShoppingItem["quantities"] = [];
  const meals: string[] = [];
  let grams: number | null = 0;
  for (const l of lines) {
    const q = scale(l.quantity, l.baseServings, l.slotServings);
    if (q !== null) {
      const entry = quantities.find((x) => x.unit === l.unit);
      if (entry) entry.quantity += q;
      else quantities.push({ unit: l.unit, quantity: q });
    }
    const g = scale(l.grams, l.baseServings, l.slotServings);
    grams = g === null || grams === null ? null : grams + g;
    if (!meals.includes(l.mealName)) meals.push(l.mealName);
  }
  const { ingredientId, ingredientName: name, aisle } = lines[0]!;
  return {
    ingredientId,
    name,
    aisle,
    quantities: quantities.map((x) => ({ unit: x.unit, quantity: round(x.quantity) })),
    totalGrams: grams === null ? null : round(grams),
    meals,
    checked,
  };
}

/**
 * Groups lines by ingredient, then by aisle (AISLES order, items sorted by name).
 * `bought` holds the `boughtKey`s ticked: those lines need no shopping, a meal planned or counted since does.
 * When nothing is left to buy the item is ticked and shows all its lines; otherwise it is unticked and shows only what is left.
 */
export function aggregateShopping(
  lines: ShoppingSourceLine[],
  bought: ReadonlySet<string> = new Set(),
): { aisle: Aisle; items: ShoppingItem[] }[] {
  const byIngredient = new Map<number, ShoppingSourceLine[]>();
  for (const l of lines) byIngredient.set(l.ingredientId, [...(byIngredient.get(l.ingredientId) ?? []), l]);

  const items = [...byIngredient].map(([, all]) => {
    const left = all.filter((l) => !bought.has(boughtKey(l)));
    return left.length ? toItem(left, false) : toItem(all, true);
  });
  return AISLES.flatMap((aisle) => {
    const inAisle = items.filter((i) => i.aisle === aisle).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return inAisle.length ? [{ aisle, items: inAisle }] : [];
  });
}
