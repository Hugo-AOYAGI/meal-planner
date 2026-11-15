import { and, count, eq, lte, max } from "drizzle-orm";
import { today } from "@shared/dates";
import { normalize } from "@shared/text";
import type { MealDetail, MealInput, MealListQuery, MealSummary, MealUpdate } from "@shared/schemas";
import { db } from "../../db";
import { ingredient, meal, planEntry, planSlot, recipe, recipeIngredient } from "../../db/schema";
import { notFound } from "../support/errors";
import { listRecipes } from "./recipes";

/** lastCooked / timesCooked come from plan entries dated today or earlier. */
function summaries(where?: ReturnType<typeof and>): MealSummary[] {
  const cooked = db
    .select({ mealId: planEntry.mealId, last: max(planSlot.date), times: count() })
    .from(planEntry)
    .innerJoin(planSlot, eq(planSlot.id, planEntry.slotId))
    .where(lte(planSlot.date, today()))
    .groupBy(planEntry.mealId)
    .all();
  const recipes = db.select({ mealId: recipe.mealId, n: count() }).from(recipe).groupBy(recipe.mealId).all();
  const cookedBy = new Map(cooked.map((c) => [c.mealId, c]));
  const recipesBy = new Map(recipes.map((r) => [r.mealId, r.n]));
  return db
    .select()
    .from(meal)
    .where(where)
    .all()
    .map(({ nameNorm: _n, createdAt: _c, ...m }) => ({
      ...m,
      lastCooked: cookedBy.get(m.id)?.last ?? null,
      timesCooked: cookedBy.get(m.id)?.times ?? 0,
      recipeCount: recipesBy.get(m.id) ?? 0,
    }));
}

const wordsOf = (text = "") =>
  normalize(text)
    .split(/[\s,]+/)
    .filter(Boolean);

/** Every ingredient name of each meal (all its recipes), normalised and joined: what a word is looked up in. */
function ingredientTexts(): Map<number, string> {
  const rows = db
    .selectDistinct({ mealId: recipe.mealId, name: ingredient.nameNorm })
    .from(recipeIngredient)
    .innerJoin(recipe, eq(recipe.id, recipeIngredient.recipeId))
    .innerJoin(ingredient, eq(ingredient.id, recipeIngredient.ingredientId))
    .all();
  const byMeal = new Map<number, string>();
  for (const r of rows) byMeal.set(r.mealId, `${byMeal.get(r.mealId) ?? ""}|${r.name}`);
  return byMeal;
}

/** Longest since last cooked first; never cooked first of all; ties by name. */
export function listMeals({ q, excludes, kind, status }: MealListQuery = {}): MealSummary[] {
  const words = wordsOf(q);
  const excluded = wordsOf(excludes);
  const texts = words.length || excluded.length ? ingredientTexts() : new Map<number, string>();
  return summaries(and(kind && eq(meal.kind, kind), status && eq(meal.status, status)))
    .filter((m) => {
      const name = normalize(m.name);
      const ingredients = texts.get(m.id) ?? "";
      return (
        words.every((w) => name.includes(w) || ingredients.includes(w)) &&
        !excluded.some((w) => ingredients.includes(w))
      );
    })
    .sort((a, b) => {
      if (a.lastCooked !== b.lastCooked) {
        if (a.lastCooked === null) return -1;
        if (b.lastCooked === null) return 1;
        return a.lastCooked < b.lastCooked ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "fr");
    });
}

export function getMeal(id: number): MealDetail {
  const summary = summaries(eq(meal.id, id))[0];
  if (!summary) throw notFound("Repas", id);
  return { ...summary, recipes: listRecipes(id) };
}

export function createMeal(input: MealInput): MealDetail {
  const row = db
    .insert(meal)
    .values({ ...input, nameNorm: normalize(input.name) })
    .returning({ id: meal.id })
    .get();
  return getMeal(row.id);
}

export function updateMeal(id: number, patch: MealUpdate): MealDetail {
  getMeal(id);
  if (Object.keys(patch).length) {
    db.update(meal)
      .set({ ...patch, ...(patch.name ? { nameNorm: normalize(patch.name) } : {}) })
      .where(eq(meal.id, id))
      .run();
  }
  return getMeal(id);
}

/** Also removes its recipes and its plan entries (so its history). */
export function deleteMeal(id: number): void {
  getMeal(id);
  db.delete(meal).where(eq(meal.id, id)).run();
}
