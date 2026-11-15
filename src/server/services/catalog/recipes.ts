import { asc, eq, inArray } from "drizzle-orm";
import { scale } from "@shared/calc/scale";
import { recipeNutrition } from "@shared/calc/nutrition";
import type { Recipe, RecipeInput, RecipeLine, RecipeLineInput, RecipeUpdate } from "@shared/schemas";
import { db } from "../../db";
import { ingredient, meal, recipe, recipeIngredient } from "../../db/schema";
import { AppError, notFound } from "../support/errors";
import { toIngredient } from "./ingredients";

/**
 * Loads recipes with their lines and nutrition. With `servings`, quantities and grams are
 * scaled to that number of people and `servings` in the result is that number (nutrition
 * per person does not change).
 */
function loadRecipes(rows: (typeof recipe.$inferSelect)[], servings?: number): Recipe[] {
  if (!rows.length) return [];
  const lineRows = db
    .select()
    .from(recipeIngredient)
    .innerJoin(ingredient, eq(ingredient.id, recipeIngredient.ingredientId))
    .where(
      inArray(
        recipeIngredient.recipeId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(recipeIngredient.position), asc(recipeIngredient.id))
    .all();
  return rows.map((r) => {
    const base = lineRows
      .filter((l) => l.recipe_ingredient.recipeId === r.id)
      .map((l) => ({ ...l.recipe_ingredient, ingredient: toIngredient(l.ingredient), extras: l.ingredient.extras }));
    const target = servings ?? r.servings;
    const lines: RecipeLine[] = base.map((l) => ({
      id: l.id,
      position: l.position,
      ingredient: l.ingredient,
      quantity: scale(l.quantity, r.servings, target),
      unit: l.unit,
      grams: scale(l.grams, r.servings, target),
      gramsEstimated: l.gramsEstimated,
      note: l.note,
    }));
    return {
      id: r.id,
      mealId: r.mealId,
      name: r.name,
      servings: target,
      durationMin: r.durationMin,
      steps: r.steps,
      sourceUrl: r.sourceUrl,
      position: r.position,
      lines,
      nutrition: recipeNutrition(base, r.servings),
    };
  });
}

export function getRecipe(id: number, servings?: number): Recipe {
  const row = db.select().from(recipe).where(eq(recipe.id, id)).get();
  if (!row) throw notFound("Recette", id);
  return loadRecipes([row], servings)[0]!;
}

/** All recipes of a meal, in order, at base servings. */
export function listRecipes(mealId: number): Recipe[] {
  return loadRecipes(
    db.select().from(recipe).where(eq(recipe.mealId, mealId)).orderBy(asc(recipe.position), asc(recipe.id)).all(),
  );
}

/** Recipes by id at base servings (used by plan and shopping). */
export function getRecipes(ids: number[]): Recipe[] {
  return ids.length ? loadRecipes(db.select().from(recipe).where(inArray(recipe.id, ids)).all()) : [];
}

function insertLines(tx: Pick<typeof db, "insert">, recipeId: number, lines: RecipeLineInput[]) {
  if (!lines.length) return;
  tx.insert(recipeIngredient)
    .values(lines.map((l, position) => ({ ...l, recipeId, position })))
    .run();
}

function assertIngredientsExist(lines: RecipeLineInput[]) {
  const ids = [...new Set(lines.map((l) => l.ingredientId))];
  if (!ids.length) return;
  const found = new Set(
    db
      .select({ id: ingredient.id })
      .from(ingredient)
      .where(inArray(ingredient.id, ids))
      .all()
      .map((r) => r.id),
  );
  const missing = ids.filter((i) => !found.has(i));
  if (missing.length) throw new AppError(`Ingrédient(s) introuvable(s): ${missing.join(", ")}`, 400);
}

export function createRecipe(input: RecipeInput): Recipe {
  const { lines, ...fields } = input;
  if (!db.select({ id: meal.id }).from(meal).where(eq(meal.id, input.mealId)).get())
    throw notFound("Repas", input.mealId);
  assertIngredientsExist(lines);
  const id = db.transaction((tx) => {
    const position = tx.select({ id: recipe.id }).from(recipe).where(eq(recipe.mealId, input.mealId)).all().length;
    const row = tx
      .insert(recipe)
      .values({ ...fields, position })
      .returning({ id: recipe.id })
      .get();
    insertLines(tx, row.id, lines);
    return row.id;
  });
  return getRecipe(id);
}

/** Updates fields; when `lines` is given it replaces all lines. */
export function updateRecipe(id: number, patch: RecipeUpdate): Recipe {
  getRecipe(id);
  const { lines, ...fields } = patch;
  if (lines) assertIngredientsExist(lines);
  db.transaction((tx) => {
    if (Object.keys(fields).length) tx.update(recipe).set(fields).where(eq(recipe.id, id)).run();
    if (lines) {
      tx.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id)).run();
      insertLines(tx, id, lines);
    }
  });
  return getRecipe(id);
}

/** Makes a recipe the one its meal uses by default (when planned or drawn): the first of the meal's recipes. */
export function setDefaultRecipe(id: number): Recipe {
  const { mealId } = getRecipe(id);
  const others = db
    .select({ id: recipe.id })
    .from(recipe)
    .where(eq(recipe.mealId, mealId))
    .orderBy(asc(recipe.position), asc(recipe.id))
    .all()
    .map((r) => r.id)
    .filter((other) => other !== id);
  db.transaction((tx) => {
    [id, ...others].forEach((recipeId, position) =>
      tx.update(recipe).set({ position }).where(eq(recipe.id, recipeId)).run(),
    );
  });
  return getRecipe(id);
}

export function deleteRecipe(id: number): void {
  getRecipe(id);
  db.delete(recipe).where(eq(recipe.id, id)).run();
}
