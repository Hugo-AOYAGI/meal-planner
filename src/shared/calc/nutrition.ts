import { NUTRIENTS } from "../constants";
import { EXTRA_NUTRIENT_KEYS, type Extras100 } from "../nutrients";
import type { Nutrients, Nutrition, Per100 } from "../schemas";

export interface NutritionLine {
  grams: number | null;
  gramsEstimated: boolean;
  ingredient: Per100 & { source: string };
  /** the ingredient's detail values per 100 g (Ciqual only) */
  extras?: Extras100 | null;
}

const zero = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });

/**
 * Nutrition per person = sum(grams x per100 / 100) / base servings.
 * A line counts when it has grams and its ingredient has values (kcal known; other
 * unknown nutrients count as 0). Skipped lines make the result `partial`; counted lines
 * using an `estimated` ingredient or estimated grams make it `estimated`.
 * Each detail value (`extras`) sums the lines that have grams and that value; it is listed
 * in `extras.partial` when a line lacks either, and null when no line has it.
 */
export function recipeNutrition(lines: NutritionLine[], baseServings: number): Nutrition {
  const total = zero();
  const servings = Math.max(baseServings, 1);
  let counted = 0;
  let estimated = false;

  for (const line of lines) {
    if (line.grams === null || line.ingredient.kcal === null) continue;

    counted++;
    if (line.gramsEstimated || line.ingredient.source === "estimated") estimated = true;
    for (const nutrient of NUTRIENTS) {
      total[nutrient] += (line.grams * (line.ingredient[nutrient] ?? 0)) / 100;
    }
  }

  const perPerson = zero();
  for (const nutrient of NUTRIENTS) perPerson[nutrient] = total[nutrient] / servings;

  const extras: Nutrition["extras"] = { perPerson: {} as Nutrition["extras"]["perPerson"], partial: [] };
  for (const key of EXTRA_NUTRIENT_KEYS) {
    const knownValues = lines.flatMap((line) => {
      const value = line.extras?.[key];
      return line.grams !== null && value != null ? [(line.grams * value) / 100] : [];
    });
    const totalKnown = knownValues.reduce((sum, value) => sum + value, 0);
    extras.perPerson[key] = knownValues.length ? totalKnown / servings : null;
    if (knownValues.length < lines.length) extras.partial.push(key);
  }
  return {
    perPerson,
    extras,
    partial: counted < lines.length,
    estimated,
    linesCounted: counted,
    linesTotal: lines.length,
  };
}
