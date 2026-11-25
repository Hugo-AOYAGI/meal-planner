import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { daysBetween, today } from "@shared/dates";
import type { Leftover, LeftoverEat, LeftoverInput, LeftoverUpdate } from "@shared/schemas";
import { db } from "../../db";
import { leftover, meal, planEntry, planSlot, recipe } from "../../db/schema";
import { AppError, notFound } from "../support/errors";
import { getSettings } from "../support/settings";
import { applySlot } from "../planning/plan";

type Tx = Pick<typeof db, "select" | "insert" | "update" | "delete">;
type KeptRow = { mealId: number; keep: number; leftoverId: number | null };

/** Portions kept for `mealId` in a slot's entries (entries eating leftovers keep nothing). */
const keptFor = (rows: KeptRow[], mealId: number) => rows.filter((r) => r.mealId === mealId && !r.leftoverId).reduce((s, r) => s + r.keep, 0);

/**
 * After a slot's entries are rewritten (inside its transaction): each meal kept for later has its leftover, made on the
 * slot's day; a change of the portions kept moves what remains by as much; a meal no longer kept loses its leftover.
 */
export function syncKeptLeftovers(tx: Tx, slotId: number, date: string, before: KeptRow[], after: KeptRow[]): void {
  for (const mealId of new Set([...before, ...after].map((r) => r.mealId))) {
    const was = keptFor(before, mealId);
    const now = keptFor(after, mealId);
    if (was === now) continue;
    const where = and(eq(leftover.slotId, slotId), eq(leftover.mealId, mealId));
    const row = tx.select().from(leftover).where(where).get();
    if (now === 0) tx.delete(leftover).where(where).run();
    else if (row) tx.update(leftover).set({ portions: Math.max(0, row.portions + now - was) }).where(eq(leftover.id, row.id)).run();
    else tx.insert(leftover).values({ slotId, mealId, createdOn: date, portions: now }).run();
  }
}

/** Portions eaten from each leftover through the plan: the servings of the slots of the entries eating from it. */
function eatenBy(ids: number[]): Map<number, number> {
  if (!ids.length) return new Map();
  const rows = db
    .select({ id: planEntry.leftoverId, eaten: sql<number>`sum(${planSlot.servings})` })
    .from(planEntry)
    .innerJoin(planSlot, eq(planSlot.id, planEntry.slotId))
    .where(inArray(planEntry.leftoverId, ids))
    .groupBy(planEntry.leftoverId)
    .all();
  return new Map(rows.map((r) => [r.id!, Number(r.eaten)]));
}

function rows(where?: ReturnType<typeof and>) {
  const found = db
    .select({ row: leftover, mealName: meal.name })
    .from(leftover)
    .leftJoin(meal, eq(meal.id, leftover.mealId))
    .where(where)
    .orderBy(asc(leftover.createdOn), asc(leftover.id))
    .all();
  const eaten = eatenBy(found.map((f) => f.row.id));
  const now = today();
  return found.map(({ row, mealName }): Leftover & { portions: number; eaten: number } => ({
    id: row.id,
    mealId: row.mealId,
    name: mealName ?? row.name ?? "Restes",
    createdOn: row.createdOn,
    age: Math.max(0, daysBetween(row.createdOn, now)),
    remaining: Math.max(0, row.portions - (eaten.get(row.id) ?? 0)),
    manual: row.slotId === null,
    portions: row.portions,
    eaten: eaten.get(row.id) ?? 0,
  }));
}

function getOne(id: number) {
  const found = rows(eq(leftover.id, id))[0];
  if (!found) throw notFound("Reste", id);
  return found;
}

const strip = ({ portions: _p, eaten: _e, ...l }: ReturnType<typeof getOne>): Leftover => l;

/** What is in the fridge today: leftovers cooked by today, not declared done, with portions left; oldest first. */
export function listFridge(): Leftover[] {
  return rows(and(isNull(leftover.doneOn), lte(leftover.createdOn, today())))
    .filter((l) => l.remaining > 0)
    .map(strip);
}

/** A leftover added by hand: a meal of the library or a free name, made today unless said otherwise. */
export function addLeftover({ mealId, name, portions, createdOn }: LeftoverInput): Leftover[] {
  if (mealId !== undefined && !db.select({ id: meal.id }).from(meal).where(eq(meal.id, mealId)).get()) throw notFound("Repas", mealId);
  db.insert(leftover)
    .values({ mealId: mealId ?? null, name: mealId === undefined ? name! : null, portions, createdOn: createdOn ?? today() })
    .run();
  return listFridge();
}

/** Corrects the portions left (what was eaten without being noted), or declares the leftover finished or thrown away. */
export function updateLeftover(id: number, { remaining, done }: LeftoverUpdate): Leftover[] {
  const l = getOne(id);
  if (remaining !== undefined) db.update(leftover).set({ portions: remaining + l.eaten }).where(eq(leftover.id, id)).run();
  if (done) db.update(leftover).set({ doneOn: today(), doneReason: done }).where(eq(leftover.id, id)).run();
  return listFridge();
}

/**
 * Eats a leftover at a meal. One of a library meal is added to the slot as a "Restes" entry (its servings come out of
 * the leftover, nothing is bought); one under a free name has no meal to plan, so the household's portions come off.
 */
export function eatLeftover(id: number, { date, moment }: LeftoverEat): Leftover[] {
  const l = getOne(id);
  if (l.remaining <= 0) throw new AppError(`Il ne reste plus de ${l.name}`);
  if (l.mealId === null) return updateLeftover(id, { remaining: Math.max(0, l.remaining - getSettings().householdSize) });

  const source = db
    .select({ recipeId: planEntry.recipeId })
    .from(leftover)
    .innerJoin(planEntry, and(eq(planEntry.slotId, leftover.slotId), eq(planEntry.mealId, leftover.mealId)))
    .where(eq(leftover.id, id))
    .get();
  const recipeId =
    source?.recipeId ??
    db.select({ id: recipe.id }).from(recipe).where(eq(recipe.mealId, l.mealId)).orderBy(asc(recipe.position), asc(recipe.id)).get()?.id ??
    null;
  const slot = db.select({ id: planSlot.id }).from(planSlot).where(and(eq(planSlot.date, date), eq(planSlot.moment, moment))).get();
  const current = slot
    ? db.select({ mealId: planEntry.mealId, recipeId: planEntry.recipeId }).from(planEntry).where(eq(planEntry.slotId, slot.id)).orderBy(asc(planEntry.position), asc(planEntry.id)).all()
    : [];
  applySlot({ date, moment, entries: [...current, { mealId: l.mealId, recipeId, leftoverId: id }] });
  return listFridge();
}
