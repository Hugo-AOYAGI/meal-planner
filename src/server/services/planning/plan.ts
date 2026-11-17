import { and, asc, eq, inArray } from "drizzle-orm";
import { MOMENTS, byCourse } from "@shared/constants";
import { daysFrom, mondayOf, today } from "@shared/dates";
import type { DayPlan, SetSlotInput, Slot, SlotEntry, WeekPlan } from "@shared/schemas";
import { db } from "../../db";
import { meal, planEntry, planSlot, recipe } from "../../db/schema";
import { AppError, notFound } from "../support/errors";
import { getRecipes } from "../catalog/recipes";
import { getSettings } from "../support/settings";

/** The 14 slots of the week containing `week` (default: current week), with entries and nutrition. */
export function getWeek(week?: string): WeekPlan {
  const { from, slots, averages } = getDays(mondayOf(week ?? today()), 7);
  return { week: from, slots, averages };
}

/** The slots of `days` consecutive days starting on `from` (2 per day), with entries and nutrition. */
export function getDays(from: string, days: number): DayPlan {
  const dates = daysFrom(from, days);

  const slotRows = db.select().from(planSlot).where(inArray(planSlot.date, dates)).all();
  const entryRows = slotRows.length
    ? db
        .select()
        .from(planEntry)
        .innerJoin(meal, eq(meal.id, planEntry.mealId))
        .where(inArray(planEntry.slotId, slotRows.map((s) => s.id)))
        .orderBy(asc(planEntry.position), asc(planEntry.id))
        .all()
    : [];
  const mealIds = [...new Set(entryRows.map((e) => e.plan_entry.mealId))];
  const options = mealIds.length
    ? db
        .select({ id: recipe.id, name: recipe.name, mealId: recipe.mealId })
        .from(recipe)
        .where(inArray(recipe.mealId, mealIds))
        .orderBy(asc(recipe.position), asc(recipe.id))
        .all()
    : [];
  const recipes = new Map(getRecipes([...new Set(entryRows.flatMap((e) => (e.plan_entry.recipeId ? [e.plan_entry.recipeId] : [])))]).map((r) => [r.id, r]));
  const defaultServings = getSettings().householdSize;

  const slots: Slot[] = dates.flatMap((date) =>
    MOMENTS.map((moment): Slot => {
      const row = slotRows.find((s) => s.date === date && s.moment === moment);
      const stored = entryRows
        .filter((e) => e.plan_entry.slotId === row?.id)
        .map(({ plan_entry: e, meal: m }): SlotEntry => {
          const r = e.recipeId ? recipes.get(e.recipeId) : undefined;
          return {
            id: e.id,
            position: e.position,
            mealId: m.id,
            mealName: m.name,
            mealKind: m.kind,
            recipeId: e.recipeId,
            recipeName: r?.name ?? null,
            recipeOptions: options.filter((o) => o.mealId === m.id).map(({ id, name }) => ({ id, name })),
            kcalPerPerson: r && r.nutrition.linesCounted > 0 ? r.nutrition.perPerson.kcal : null,
            excluded: e.excluded,
          };
        });
      // served in course order, whatever the order they were added in
      const entries = byCourse(stored);
      const withKcal = entries.filter((e) => e.kcalPerPerson !== null);
      return {
        date,
        moment,
        servings: row?.servings ?? defaultServings,
        entries,
        kcalPerPerson: withKcal.length ? withKcal.reduce((s, e) => s + e.kcalPerPerson!, 0) : null,
      };
    }),
  );

  // averages per person per day over days with at least one planned entry
  const totals = { kcal: 0, protein: 0, fibre: 0 };
  let planned = 0;
  for (const date of dates) {
    const dayEntries = entryRows.filter((e) => slotRows.find((s) => s.id === e.plan_entry.slotId)?.date === date);
    if (!dayEntries.length) continue;
    planned++;
    for (const e of dayEntries) {
      const n = e.plan_entry.recipeId ? recipes.get(e.plan_entry.recipeId)?.nutrition.perPerson : undefined;
      if (!n) continue;
      totals.kcal += n.kcal;
      totals.protein += n.protein;
      totals.fibre += n.fibre;
    }
  }
  const avg = (v: number) => (planned ? v / planned : 0);
  return {
    from,
    days,
    slots,
    averages: { days: planned, kcal: avg(totals.kcal), protein: avg(totals.protein), fibre: avg(totals.fibre) },
  };
}

/** Writes a slot without building the week view (used by the draw). */
export function applySlot({ date, moment, servings, entries }: SetSlotInput): void {
  const resolved = entries?.map((e, position) => {
    if (!db.select({ id: meal.id }).from(meal).where(eq(meal.id, e.mealId)).get()) throw notFound("Repas", e.mealId);
    const recipes = db.select({ id: recipe.id }).from(recipe).where(eq(recipe.mealId, e.mealId)).orderBy(asc(recipe.position), asc(recipe.id)).all();
    const recipeId = e.recipeId === undefined ? (recipes[0]?.id ?? null) : e.recipeId;
    if (recipeId !== null && !recipes.some((r) => r.id === recipeId)) throw new AppError(`La recette ${recipeId} n'appartient pas au repas ${e.mealId}`);
    return { mealId: e.mealId, recipeId, position };
  });
  db.transaction((tx) => {
    const existing = tx.select().from(planSlot).where(and(eq(planSlot.date, date), eq(planSlot.moment, moment))).get();
    let slotId = existing?.id;
    if (!existing) {
      slotId = tx.insert(planSlot).values({ date, moment, servings: servings ?? getSettings().householdSize }).returning({ id: planSlot.id }).get().id;
    } else if (servings !== undefined) {
      tx.update(planSlot).set({ servings }).where(eq(planSlot.id, existing.id)).run();
    }
    if (resolved) {
      // entries are rewritten: a meal that stays in the slot keeps its shopping choice; a new one starts out of the list
      // (it is put in the list by hand, see `setShoppingExclusion`)
      const kept = tx.select({ mealId: planEntry.mealId, excluded: planEntry.excluded }).from(planEntry).where(eq(planEntry.slotId, slotId!)).all();
      tx.delete(planEntry).where(eq(planEntry.slotId, slotId!)).run();
      const values = resolved.map((r) => {
        const i = kept.findIndex((k) => k.mealId === r.mealId);
        const excluded = i >= 0 ? kept.splice(i, 1)[0]!.excluded : true;
        return { ...r, slotId: slotId!, excluded };
      });
      if (values.length) tx.insert(planEntry).values(values).run();
    }
  });
}

/** Sets a slot (entries replaced when given, [] clears) and returns the slot's week. */
export function setSlot(input: SetSlotInput): WeekPlan {
  applySlot(input);
  return getWeek(input.date);
}
