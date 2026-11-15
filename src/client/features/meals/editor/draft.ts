import type { Ingredient, Recipe, RecipeInput } from "@shared/schemas";
import { numberText, parseNumber } from "@/lib/formatting/format";

/** Form state of a recipe: numbers stay text until saved. */
export interface LineDraft {
  key: string;
  ingredient: Ingredient | null;
  quantity: string;
  unit: string;
  grams: string;
  gramsEstimated: boolean;
  note: string | null;
}

export interface RecipeDraft {
  id?: number;
  name: string;
  servings: string;
  duration: string;
  sourceUrl: string;
  /** one step per line */
  steps: string;
  lines: LineDraft[];
}

let lineCount = 0;

export const blankLine = (): LineDraft => ({
  key: `line-${lineCount++}`,
  ingredient: null,
  quantity: "",
  unit: "",
  grams: "",
  gramsEstimated: false,
  note: null,
});

export function recipeToDraft(recipe: Recipe | null): RecipeDraft {
  if (!recipe) return { name: "", servings: "4", duration: "", sourceUrl: "", steps: "", lines: [blankLine()] };
  return {
    id: recipe.id,
    name: recipe.name,
    servings: String(recipe.servings),
    duration: numberText(recipe.durationMin),
    sourceUrl: recipe.sourceUrl ?? "",
    steps: recipe.steps.join("\n"),
    lines: recipe.lines.map((l) => ({
      key: `line-${lineCount++}`,
      ingredient: l.ingredient,
      quantity: numberText(l.quantity),
      unit: l.unit,
      grams: numberText(l.grams),
      gramsEstimated: l.gramsEstimated,
      note: l.note,
    })),
  };
}

export function draftToInput(draft: RecipeDraft): Omit<RecipeInput, "mealId"> {
  const duration = parseNumber(draft.duration);
  return {
    name: draft.name.trim(),
    servings: Math.round(parseNumber(draft.servings) ?? 4),
    durationMin: duration === null ? null : Math.round(duration),
    sourceUrl: draft.sourceUrl.trim() || null,
    steps: draft.steps.split("\n").map((s) => s.trim()).filter(Boolean),
    lines: draft.lines.flatMap((l) =>
      l.ingredient
        ? [
            {
              ingredientId: l.ingredient.id,
              quantity: parseNumber(l.quantity),
              unit: l.unit.trim(),
              grams: parseNumber(l.grams),
              gramsEstimated: l.gramsEstimated,
              note: l.note,
            },
          ]
        : [],
    ),
  };
}
