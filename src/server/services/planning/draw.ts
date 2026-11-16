import { MOMENTS, courseOf } from "@shared/constants";
import { addDays, daysFrom, mondayOf, today } from "@shared/dates";
import type { DayPlan, Suggestion, SuggestionInput, WeekPlan } from "@shared/schemas";
import type { MealKind, Moment } from "@shared/constants";
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

/** What the draw knows of each meal's first recipe: protein and fibre per person (when countable) and duration. */
export interface MealFacts {
  nutrients?: Nutrients;
  durationMin: number | null;
}

export function factsOf(mealIds: number[]): Map<number, MealFacts> {
  const facts = new Map<number, MealFacts>();
  for (const id of mealIds) {
    const first = listRecipes(id)[0];
    const nutrition = first?.nutrition;
    facts.set(id, { nutrients: nutrition?.linesCounted ? nutrition.perPerson : undefined, durationMin: first?.durationMin ?? null });
  }
  return facts;
}

/**
 * The state a draw starts from for `days` days from `date`: the meals it may pick (by status), their facts,
 * the meals already taken (eaten the week before or planned in the range, plus `exclude`) and the running balance.
 */
export function drawContext(date: string, days: number, status: SuggestionInput["status"], exclude: number[] = []) {
  const before = getDays(addDays(date, -7), 7);
  const range = getDays(date, days);
  const meals = listMeals().filter((meal) => status === "all" || meal.status === status);
  const facts = factsOf(meals.map((meal) => meal.id));
  const taken = [...before.slots, ...range.slots].flatMap((slot) => slot.entries.map((entry) => entry.mealId));
  taken.push(...exclude);
  const { days: eatenDays, protein, fibre } = before.averages;
  const balance = createBalance({ days: eatenDays, protein: protein * eatenDays, fibre: fibre * eatenDays });
  for (const id of exclude) balance.add(facts.get(id)?.nutrients);
  const bias = (meal: { id: number }) => balance.bias(facts.get(meal.id)?.nutrients);
  return { range, meals, facts, taken, balance, bias };
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
  const { range, meals, taken, balance, facts, bias } = drawContext(date, days, input.status, locked.flatMap((l) => l.mealIds));
  const names = new Map(meals.map((meal) => [meal.id, meal.name]));
  const heldAt = (slot: { date: string; moment: Moment }) =>
    range.slots.find((s) => slotKey(s) === slotKey(slot))?.entries ?? [];

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
    const [drawn] = drawMeals([slot], meals, taken, today(), random, bias);
    if (!drawn?.mealIds.length) continue;
    for (const id of drawn.mealIds) {
      taken.push(id);
      balance.add(facts.get(id)?.nutrients);
    }
    suggestions.push({ ...proposalFor(slot, heldAt(slot)), meals: drawn.mealIds.map((id) => ({ id, name: names.get(id)! })) });
  }
  return suggestions;
}

/** The parts of a proposal that come from the slot: what it keeps (starter, dessert) and what it must still hold. */
export function proposalFor(slot: { date: string; moment: Moment }, held: { mealId: number; recipeId: number | null; mealKind: MealKind }[]) {
  return {
    ...slot,
    kept: held.filter((entry) => courseOf(entry.mealKind) !== "plat").map(entryRef),
    expected: held.map(entryRef),
  };
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
