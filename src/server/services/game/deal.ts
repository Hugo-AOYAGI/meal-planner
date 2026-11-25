import { MOMENTS, type Moment } from "@shared/constants";
import { daysFrom, today } from "@shared/dates";
import type { DrawStatus, GameCard, GameMode, GameOptions, SlotCard, Suggestion } from "@shared/schemas";
import { drawMeals, type Random } from "../calc/draw";
import { listMeals } from "../catalog/meals";
import { drawContext, factsOf, proposalFor } from "../planning/draw";
import { getDays } from "../planning/plan";
import { AppError } from "../support/errors";
import { getSettings } from "../support/settings";
import { readReserve } from "./store";
import { listFridge } from "../fridge/leftovers";

export const slotKey = (slot: { date: string; moment: Moment }) => `${slot.date}/${slot.moment}`;

/** A slot the game fills, with what applying a proposal to it keeps and expects (see `Suggestion`). */
export type GameSlot = Omit<Suggestion, "meals">;

/** A hand fits a phone screen without scrolling; what is not agreed on goes to another round. */
const HAND = 6;
const RESERVE_PER_HAND = 1;

/** Cards dealt for a round while `needed` slots are empty: always a full hand, so there is a real choice even for one meal. */
export const handSize = (needed: number) => (needed <= 0 ? 0 : HAND);

/**
 * The slots a game fills. A plan game takes the empty slots of the chosen moments from today on;
 * a quick game takes tonight's dinner and, when it is filled, replaces its main (starter and dessert stay).
 */
export function slotsFor(mode: GameMode, options: GameOptions): GameSlot[] {
  if (mode === "quick") {
    const slot = { date: today(), moment: "soir" as const };
    return [proposalFor(slot, getDays(slot.date, 1).slots.find((s) => s.moment === "soir")!.entries)];
  }
  const range = getDays(options.from, options.days);
  return daysFrom(options.from, options.days)
    .filter((day) => day >= today())
    .flatMap((day) => MOMENTS.filter((m) => options.moments.includes(m)).map((moment) => ({ date: day, moment })))
    .filter((slot) => !range.slots.find((s) => slotKey(s) === slotKey(slot))?.entries.length)
    .map((slot) => proposalFor(slot, []));
}

interface DealInput {
  mode: GameMode;
  options: GameOptions;
  count: number;
  /** meals that must not be dealt: in the hand, matched, refused, just skipped */
  exclude: number[];
  /** makes card ids unique within the game */
  nextId: () => string;
  random: Random;
  /** how many reserve cards at most (default: a quarter of the hand, 2 at most) */
  reserve?: number;
  /** include a "Nouveau" card (default true) */
  withNew?: boolean;
}

/** Whether a quick game may deal a meal set: every part has a known duration within the household's limit. */
function quickFilter(mode: GameMode, facts: ReturnType<typeof factsOf>) {
  const max = getSettings().quickMaxMinutes;
  return (mealIds: number[]) =>
    mode !== "quick" || mealIds.every((id) => (facts.get(id)?.durationMin ?? Infinity) <= max);
}

const statusFits = (status: DrawStatus, mealStatus: string) =>
  status === "all" || mealStatus === status || mealStatus === "idea";

/**
 * Deals `count` cards: in a quick game the fridge's leftovers first, then a couple of reserve cards ("envies communes") when eligible, one "Nouveau" card
 * (a meal to try, never cooked, or an assistant idea), the rest drawn like the regular draw.
 */
export function dealCards({ mode, options, count, exclude, nextId, random, reserve, withNew = true }: DealInput): GameCard[] {
  if (count <= 0) return [];
  const ctx = drawContext(options.from, options.days, options.status, exclude);
  const ideas = listMeals({ status: "idea" });
  const known = new Map([...ctx.meals, ...ideas].map((m) => [m.id, m]));
  const facts = new Map([...ctx.facts, ...factsOf(ideas.map((m) => m.id))]);
  const fits = quickFilter(mode, facts);
  const taken = new Set(ctx.taken);
  const cards: GameCard[] = [];
  const add = (mealIds: number[], tag: GameCard["tag"]) => {
    for (const id of mealIds) {
      taken.add(id);
      ctx.balance.add(facts.get(id)?.nutrients);
    }
    const durations = mealIds.map((id) => facts.get(id)?.durationMin ?? null);
    cards.push({
      id: nextId(),
      meals: mealIds.map((id) => ({ id, name: known.get(id)!.name })),
      durationMin: durations.includes(null) ? null : Math.max(...(durations as number[])),
      tag,
    });
  };
  const free = (mealIds: number[]) =>
    mealIds.every((id) => known.has(id) && !taken.has(id) && statusFits(options.status, known.get(id)!.status)) && fits(mealIds);

  // a quick game starts with what is in the fridge, oldest first: nothing to cook
  if (mode === "quick") {
    for (const l of listFridge().filter((l) => l.mealId !== null && !taken.has(l.mealId)).slice(0, count)) {
      taken.add(l.mealId!);
      cards.push({ id: nextId(), meals: [{ id: l.mealId!, name: l.name }], durationMin: null, tag: "leftover", leftoverId: l.id, age: l.age });
    }
  }

  // envies communes: the oldest first, one per hand at most
  const reserveSlots = reserve ?? Math.min(RESERVE_PER_HAND, Math.floor(count / 3));
  for (const entry of readReserve().filter((r) => free(r.mealIds)).slice(0, reserveSlots)) add(entry.mealIds, "reserve");

  // nouveau: meals to try first, then never cooked, then the assistant's ideas
  if (withNew && cards.length < count && count >= 2) {
    const mains = (m: { kind: string }) => m.kind === "plat";
    const groups = [
      ctx.meals.filter((m) => mains(m) && m.status === "to_try" && !m.timesCooked),
      ctx.meals.filter((m) => mains(m) && m.status === "regular" && !m.timesCooked),
      ideas.filter(mains),
    ];
    const pool = groups.map((g) => g.filter((m) => free([m.id]))).find((g) => g.length);
    if (pool) add([pool[Math.floor(random() * pool.length)]!.id], "new");
  }

  const candidates = ctx.meals.filter((m) => fits([m.id]));
  while (cards.length < count) {
    const [drawn] = drawMeals([{ date: options.from, moment: "soir" }], candidates, taken, today(), random, ctx.bias);
    if (!drawn?.mealIds.length) break;
    add(drawn.mealIds, null);
  }
  return cards;
}

/**
 * The dice on one slot: `count` proposals for its main, one of them an "envie commune" when the reserve has one
 * that fits. Each is a ready-to-apply suggestion that replaces the main and keeps the starter and dessert.
 */
export function slotCards(date: string, moment: Moment, count = 3, random: Random = Math.random): SlotCard[] {
  if (date < today()) throw new AppError("Ce jour est passé.");
  const held = getDays(date, 1).slots.find((s) => s.moment === moment)!.entries;
  let seq = 0;
  const cards = dealCards({
    mode: "plan",
    options: { from: date, days: 1, moments: [moment], status: "all" },
    count,
    exclude: [],
    nextId: () => String(++seq),
    random,
    reserve: 1,
    withNew: false,
  });
  return cards.map((card) => ({
    suggestion: { ...proposalFor({ date, moment }, held), meals: card.meals },
    tag: card.tag === "reserve" ? "reserve" : null,
  }));
}
