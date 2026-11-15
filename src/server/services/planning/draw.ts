import { MOMENTS, courseOf } from "@shared/constants";
import { addDays, daysFrom, mondayOf, today } from "@shared/dates";
import type { DayPlan, Suggestion, SuggestionInput, WeekPlan } from "@shared/schemas";
import type { Moment } from "@shared/constants";
import { db } from "../../db";
import { createBalance, type Nutrients } from "../calc/balance";
import { drawMeals, type Random } from "../calc/draw";
import { listMeals } from "../catalog/meals";
import { listRecipes } from "../catalog/recipes";
import { AppError } from "../support/errors";
import { getSettings } from "../support/settings";
import { applySlot, getDays, getWeek } from "./plan";

const slotKey = (slot: { date: string; moment: Moment }) => `${slot.date}/${slot.moment}`;
const entryRef = ({ mealId, recipeId }: { mealId: number; recipeId: number | null }) => ({ mealId, recipeId });

/** Protein and fibre per person of each meal's first recipe; meals whose recipe cannot be counted are left out. */
function nutrientsOf(mealIds: number[]): Map<number, Nutrients> {
  const known = new Map<number, Nutrients>();
  for (const id of mealIds) {
    const nutrition = listRecipes(id)[0]?.nutrition;
    if (nutrition?.linesCounted) known.set(id, nutrition.perPerson);
  }
  return known;
}

/**
 * Proposes a main for each requested slot, without changing the plan. Past days are never drawn.
 * A slot that already holds meals is only drawn again with `replace`, and then keeps its starter and dessert.
 * Meals eaten the week before, planned in the range or locked are not proposed again, and meals that
 * make up for the protein and fibre the plan lacks are favoured.
 */
export function suggestMeals(input: SuggestionInput, random: Random = Math.random): Suggestion[] {
  const { date, days, replace } = input;
  const locked = input.locked ?? [];
  const before = getDays(addDays(date, -7), 7);
  const range = getDays(date, days);
  const meals = listMeals().filter((meal) => input.status === "all" || meal.status === input.status);
  const names = new Map(meals.map((meal) => [meal.id, meal.name]));
  const nutrients = nutrientsOf(meals.map((meal) => meal.id));
  const heldAt = (slot: { date: string; moment: Moment }) =>
    range.slots.find((s) => slotKey(s) === slotKey(slot))?.entries ?? [];

  const taken = [...before.slots, ...range.slots].flatMap((slot) => slot.entries.map((entry) => entry.mealId));
  const { days: eatenDays, protein, fibre } = before.averages;
  const balance = createBalance({ days: eatenDays, protein: protein * eatenDays, fibre: fibre * eatenDays });
  for (const { mealIds } of locked) {
    taken.push(...mealIds);
    for (const id of mealIds) balance.add(nutrients.get(id));
  }

  const lockedKeys = new Set(locked.map(slotKey));
  const slots = daysFrom(date, days)
    .filter((day) => day >= today())
    .flatMap((day) =>
      MOMENTS.filter((moment) => input.moments.includes(moment)).map((moment) => ({ date: day, moment })),
    )
    .filter((slot) => !lockedKeys.has(slotKey(slot)) && (replace || !heldAt(slot).length));

  const suggestions: Suggestion[] = [];
  let currentDay = "";
  for (const slot of slots) {
    if (slot.date !== currentDay) {
      currentDay = slot.date;
      balance.startDay();
    }
    const [drawn] = drawMeals([slot], meals, taken, today(), random, (meal) => balance.bias(nutrients.get(meal.id)));
    if (!drawn?.mealIds.length) continue;
    for (const id of drawn.mealIds) {
      taken.push(id);
      balance.add(nutrients.get(id));
    }
    const held = heldAt(slot);
    suggestions.push({
      ...slot,
      meals: drawn.mealIds.map((id) => ({ id, name: names.get(id)! })),
      kept: held.filter((entry) => courseOf(entry.mealKind) !== "plat").map(entryRef),
      expected: held.map(entryRef),
    });
  }
  return suggestions;
}

/**
 * Writes proposals into the plan, all or none. A proposal only goes through while its slot still holds what it
 * held when it was drawn, so a plan changed in the meantime (by someone else, or the assistant) is never overwritten.
 */
export function applySuggestions(suggestions: Suggestion[]): void {
  if (new Set(suggestions.map(slotKey)).size !== suggestions.length)
    throw new AppError("Créneau répété dans le tirage.");
  db.transaction(() => {
    for (const suggestion of suggestions) {
      const current = getDays(suggestion.date, 1).slots.find((slot) => slot.moment === suggestion.moment)!;
      if (JSON.stringify(current.entries.map(entryRef)) !== JSON.stringify(suggestion.expected)) {
        throw new AppError("Le planning a changé. Fermez et relancez le tirage.");
      }
      const entries = [...suggestion.meals.map((meal) => ({ mealId: meal.id })), ...suggestion.kept];
      applySlot({ date: suggestion.date, moment: suggestion.moment, entries });
    }
  });
}

const drawInto = (input: SuggestionInput, random?: Random) => applySuggestions(suggestMeals(input, random));

/** Fills the empty slots of the enabled moments over `days` days from `from`; filled slots and past days are left alone. */
export function drawDays(from: string, days: number, random?: Random): DayPlan {
  drawInto({ date: from, days, moments: getSettings().drawMoments, status: "all", replace: false }, random);
  return getDays(from, days);
}

/** Fills the empty slots of the week containing `week`. */
export function drawWeek(week: string, random?: Random): WeekPlan {
  drawDays(mondayOf(week), 7, random);
  return getWeek(week);
}

/** Redraws the main of one slot, empty or not; its starter and dessert stay. */
export function redrawSlot(date: string, moment: Moment, random?: Random): WeekPlan {
  drawInto({ date, days: 1, moments: [moment], status: "all", replace: true }, random);
  return getWeek(date);
}
