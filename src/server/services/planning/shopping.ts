import { asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { AISLES, type Aisle } from "@shared/constants";
import { normalize } from "@shared/text";
import { addDays, daysFrom, today } from "@shared/dates";
import type { ShoppingCheckInput, ShoppingExcludeInput, ShoppingExtra, ShoppingExtraInput, ShoppingExtraUpdate, ShoppingList } from "@shared/schemas";
import { db } from "../../db";
import { ingredient, meal, planEntry, planSlot, shoppingCheck, shoppingExtra } from "../../db/schema";
import { aggregateShopping, type ShoppingSourceLine } from "../calc/shopping";
import { notFound } from "../support/errors";
import { getRecipes } from "../catalog/recipes";

/** Last day of the list covering `days` days from today. */
const lastDay = (days: number) => addDays(today(), days - 1);

/** What to buy for the meals planned over `days` days starting today, plus the lines added by hand. */
export function getShoppingList(days: number): ShoppingList {
  const dates = daysFrom(today(), days);
  const entries = db
    .select({ entryId: planEntry.id, excluded: planEntry.excluded, recipeId: planEntry.recipeId, servings: planSlot.servings, date: planSlot.date, moment: planSlot.moment, mealId: meal.id, mealName: meal.name })
    .from(planEntry)
    .innerJoin(planSlot, eq(planSlot.id, planEntry.slotId))
    .innerJoin(meal, eq(meal.id, planEntry.mealId))
    .where(inArray(planSlot.date, dates))
    .orderBy(asc(planSlot.date), asc(planSlot.moment), asc(planEntry.position))
    .all();
  const recipes = new Map(getRecipes([...new Set(entries.flatMap((e) => (e.recipeId ? [e.recipeId] : [])))]).map((r) => [r.id, r]));

  const lines: ShoppingSourceLine[] = entries.flatMap((e) => {
    if (e.excluded) return [];
    const r = e.recipeId ? recipes.get(e.recipeId) : undefined;
    return (r?.lines ?? []).map((l) => ({
      ingredientId: l.ingredient.id,
      ingredientName: l.ingredient.name,
      aisle: l.ingredient.aisle,
      quantity: l.quantity,
      unit: l.unit,
      grams: l.grams,
      baseServings: r!.servings,
      slotServings: e.servings,
      mealName: e.mealName,
      date: e.date,
    }));
  });
  const bought = new Map(db.select().from(shoppingCheck).all().map((c) => [c.ingredientId, c.until]));
  return {
    from: dates[0]!,
    to: dates.at(-1)!,
    aisles: aggregateShopping(lines, bought),
    extras: listShoppingExtras(),
    meals: entries.map((e) => ({
      entryId: e.entryId,
      mealId: e.mealId,
      name: e.mealName,
      date: e.date,
      moment: e.moment,
      excluded: e.excluded,
      empty: !(e.recipeId && recipes.get(e.recipeId)?.lines.length),
    })),
  };
}

/** Ticking in the list of `days` days means "bought for everything planned up to its last day"; unticking forgets the ingredient. */
export function setShoppingCheck({ days, ingredientId, checked }: ShoppingCheckInput): ShoppingList {
  db.delete(shoppingCheck).where(lt(shoppingCheck.until, today())).run(); // ticks of past days are obsolete
  if (checked) {
    db.insert(shoppingCheck)
      .values({ ingredientId, until: lastDay(days) })
      .onConflictDoUpdate({ target: shoppingCheck.ingredientId, set: { until: sql`max(${shoppingCheck.until}, excluded.until)` } })
      .run();
  } else db.delete(shoppingCheck).where(eq(shoppingCheck.ingredientId, ingredientId)).run();
  return getShoppingList(days);
}

/** Leaves a planned meal out of the list (or puts it back); a slot rewrite keeps the choice, see `applySlot`. */
export function setShoppingExclusion({ days, entryId, excluded }: ShoppingExcludeInput): ShoppingList {
  if (!db.update(planEntry).set({ excluded }).where(eq(planEntry.id, entryId)).returning().get()) throw notFound("Repas planifié", entryId);
  return getShoppingList(days);
}

const listShoppingExtras = (): ShoppingExtra[] => db.select().from(shoppingExtra).orderBy(asc(shoppingExtra.id)).all();

/** "Citrons" → "citron": a label compared with ingredient names, accents, case and plural aside. */
const stem = (s: string) => normalize(s).replace(/(?<=\w{3})[sx]$/, "");

/** The aisle of the ingredient called like `label`, if the library has one. */
export function guessAisle(label: string): Aisle | null {
  const key = stem(label);
  const rows = db.select({ name: ingredient.name, aisle: ingredient.aisle }).from(ingredient).all();
  return rows.find((r) => stem(r.name) === key)?.aisle ?? null;
}

/** A hand-added line goes in its aisle: given, or that of the ingredient with its name; otherwise `classifyExtras` sorts it. */
export function addShoppingExtra({ label, aisle }: ShoppingExtraInput): ShoppingExtra[] {
  db.insert(shoppingExtra).values({ label, aisle: aisle ?? guessAisle(label) }).run();
  return listShoppingExtras();
}

/** Hand-added lines not sorted into an aisle yet. */
export const unsortedExtras = () => db.select({ id: shoppingExtra.id, label: shoppingExtra.label }).from(shoppingExtra).where(isNull(shoppingExtra.aisle)).all();

/** Files lines in their aisle (an unknown aisle becomes "autre"); lines removed meanwhile are skipped. */
export function sortExtras(aisles: Record<number, string>): void {
  for (const [id, aisle] of Object.entries(aisles)) {
    const valid = (AISLES as readonly string[]).includes(aisle) ? (aisle as Aisle) : "autre";
    db.update(shoppingExtra).set({ aisle: valid }).where(eq(shoppingExtra.id, Number(id))).run();
  }
}

export function updateShoppingExtra(id: number, patch: ShoppingExtraUpdate): ShoppingExtra[] {
  if (!db.select().from(shoppingExtra).where(eq(shoppingExtra.id, id)).get()) throw notFound("Ligne", id);
  if (Object.keys(patch).length) db.update(shoppingExtra).set(patch).where(eq(shoppingExtra.id, id)).run();
  return listShoppingExtras();
}

export function deleteShoppingExtra(id: number): ShoppingExtra[] {
  if (!db.delete(shoppingExtra).where(eq(shoppingExtra.id, id)).returning().get()) throw notFound("Ligne", id);
  return listShoppingExtras();
}
