import { asc, eq, inArray, lt, sql } from "drizzle-orm";
import { addDays, daysFrom, today } from "@shared/dates";
import type { ShoppingCheckInput, ShoppingExtra, ShoppingExtraInput, ShoppingExtraUpdate, ShoppingList } from "@shared/schemas";
import { db } from "../../db";
import { meal, planEntry, planSlot, shoppingCheck, shoppingExtra } from "../../db/schema";
import { aggregateShopping, type ShoppingSourceLine } from "../calc/shopping";
import { notFound } from "../support/errors";
import { getRecipes } from "../catalog/recipes";

/** Last day of the list covering `days` days from today. */
const lastDay = (days: number) => addDays(today(), days - 1);

/** What to buy for the meals planned over `days` days starting today, plus the lines added by hand. */
export function getShoppingList(days: number): ShoppingList {
  const dates = daysFrom(today(), days);
  const entries = db
    .select({ recipeId: planEntry.recipeId, servings: planSlot.servings, date: planSlot.date, mealId: meal.id, mealName: meal.name })
    .from(planEntry)
    .innerJoin(planSlot, eq(planSlot.id, planEntry.slotId))
    .innerJoin(meal, eq(meal.id, planEntry.mealId))
    .where(inArray(planSlot.date, dates))
    .orderBy(asc(planSlot.date), asc(planSlot.moment), asc(planEntry.position))
    .all();
  const recipes = new Map(getRecipes([...new Set(entries.flatMap((e) => (e.recipeId ? [e.recipeId] : [])))]).map((r) => [r.id, r]));

  const uncounted = new Map<number, string>();
  const lines: ShoppingSourceLine[] = entries.flatMap((e) => {
    const r = e.recipeId ? recipes.get(e.recipeId) : undefined;
    if (!r?.lines.length) uncounted.set(e.mealId, e.mealName);
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
    uncounted: [...uncounted].map(([mealId, name]) => ({ mealId, name })),
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

const listShoppingExtras = (): ShoppingExtra[] => db.select().from(shoppingExtra).orderBy(asc(shoppingExtra.id)).all();

export function addShoppingExtra({ label }: ShoppingExtraInput): ShoppingExtra[] {
  db.insert(shoppingExtra).values({ label }).run();
  return listShoppingExtras();
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
