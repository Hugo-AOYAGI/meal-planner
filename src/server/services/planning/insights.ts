import { and, count, desc, eq, gte, isNull, lte, max } from "drizzle-orm";
import { NUTRIENTS } from "@shared/constants";
import { today } from "@shared/dates";
import { EXTRA_NUTRIENT_KEYS } from "@shared/nutrients";
import type { Nutrients } from "@shared/schemas";
import { db } from "../../db";
import { meal, planEntry, planSlot } from "../../db/schema";
import { getWeek } from "./plan";
import { getRecipes } from "../catalog/recipes";

/** Meals eaten between two dates (plan entries dated today or earlier), most frequent first. */
export function getHistory(from: string, to: string) {
  const end = to < today() ? to : today();
  const times = count();
  return db
    .select({ id: meal.id, name: meal.name, kind: meal.kind, times, last: max(planSlot.date) })
    .from(planEntry)
    .innerJoin(planSlot, eq(planSlot.id, planEntry.slotId))
    .innerJoin(meal, eq(meal.id, planEntry.mealId))
    .where(and(gte(planSlot.date, from), lte(planSlot.date, end), isNull(planEntry.leftoverId)))
    .groupBy(meal.id)
    .orderBy(desc(times), meal.name)
    .all();
}

const zero = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });
const round = (n: Nutrients) => Object.fromEntries(NUTRIENTS.map((k) => [k, Math.round(n[k] * 10) / 10])) as Nutrients;

/**
 * Nutrition per person of each planned day of a week, and the average over those days.
 * `uncounted` names the meals left out of a day's total (no recipe, or no usable ingredient line).
 */
export function getNutritionSummary(week: string) {
  const plan = getWeek(week);
  const entries = plan.slots.flatMap((s) => s.entries.map((e) => ({ ...e, date: s.date })));
  const recipes = new Map(getRecipes([...new Set(entries.flatMap((e) => (e.recipeId ? [e.recipeId] : [])))]).map((r) => [r.id, r]));

  const days = [...new Set(entries.map((e) => e.date))].map((date) => {
    const total = zero();
    const uncounted: string[] = [];
    let partial = false;
    let estimated = false;
    const details = Object.fromEntries(EXTRA_NUTRIENT_KEYS.map((key) => [key, null])) as Record<(typeof EXTRA_NUTRIENT_KEYS)[number], number | null>;
    const partialDetails = new Set<(typeof EXTRA_NUTRIENT_KEYS)[number]>();
    for (const e of entries.filter((x) => x.date === date)) {
      const n = e.recipeId ? recipes.get(e.recipeId)?.nutrition : undefined;
      for (const key of EXTRA_NUTRIENT_KEYS) {
        const value = n?.extras.perPerson[key];
        if (value == null || n?.extras.partial.includes(key)) partialDetails.add(key);
        if (value != null) details[key] = (details[key] ?? 0) + value;
      }
      if (!n || n.linesCounted === 0) {
        uncounted.push(e.mealName);
        continue;
      }
      partial ||= n.partial;
      estimated ||= n.estimated;
      for (const k of NUTRIENTS) total[k] += n.perPerson[k];
    }
    return { date, meals: entries.filter((x) => x.date === date).map((e) => e.mealName), perPerson: total, detailsPerPerson: details, partialDetails: [...partialDetails], estimated, partial, uncounted };
  });

  const average = zero();
  for (const d of days) for (const k of NUTRIENTS) average[k] += d.perPerson[k] / days.length;
  return { week: plan.week, days: days.map((d) => ({ ...d, perPerson: round(d.perPerson) })), averagePerPersonPerDay: round(average) };
}
