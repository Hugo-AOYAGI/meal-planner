import type { MealKind, MealStatus, Moment } from "@shared/constants";
import { daysBetween } from "@shared/dates";

export interface DrawCandidate {
  id: number;
  kind: MealKind;
  status: MealStatus;
  lastCooked: string | null;
}
export interface DrawSlot {
  date: string;
  moment: Moment;
}
export type Random = () => number;

const NEVER_COOKED_DAYS = 365;
const TO_TRY_WEIGHT = 30;

/** Weight of a meal: days since last cooked (never cooked = 365), `to_try` = fixed low weight. */
export function weight(c: DrawCandidate, today: string): number {
  if (c.status === "to_try") return TO_TRY_WEIGHT;
  if (c.lastCooked === null) return NEVER_COOKED_DAYS;
  return Math.max(1, daysBetween(c.lastCooked, today));
}

function pick(pool: DrawCandidate[], today: string, random: Random, bias: (candidate: DrawCandidate) => number): DrawCandidate | undefined {
  if (!pool.length) return undefined;
  const weights = pool.map((c) => weight(c, today) * bias(c));
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * For each slot in order: pick a main among dishes (`plat`) and proteins weighted by
 * `weight`; a protein gets one starch and one vegetable the same way. A meal is never used
 * twice: `used` (meals already in the week) is respected and grown as meals are picked.
 * Returns the chosen meal ids per slot (empty when the library has nothing left).
 */
export function drawMeals(
  slots: DrawSlot[],
  candidates: DrawCandidate[],
  used: Iterable<number>,
  today: string,
  random: Random = Math.random,
  bias: (candidate: DrawCandidate) => number = () => 1,
): { slot: DrawSlot; mealIds: number[] }[] {
  const taken = new Set(used);
  const take = (kinds: MealKind[]) => {
    const c = pick(candidates.filter((m) => kinds.includes(m.kind) && !taken.has(m.id)), today, random, bias);
    if (c) taken.add(c.id);
    return c;
  };
  return slots.map((slot) => {
    const main = take(["plat", "proteine"]);
    if (!main) return { slot, mealIds: [] };
    const mealIds = [main.id];
    if (main.kind === "proteine") {
      for (const kind of ["feculent", "legume"] as const) {
        const part = take([kind]);
        if (part) mealIds.push(part.id);
      }
    }
    return { slot, mealIds };
  });
}
