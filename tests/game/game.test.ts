import { beforeEach, expect, test } from "bun:test";
import { addDays, today } from "@shared/dates";
import { createMeal, getMeal, listMeals, updateMeal } from "@server/services/catalog/meals";
import { createRecipe } from "@server/services/catalog/recipes";
import { act, startGame } from "@server/services/game/rules";
import { slotCards } from "@server/services/game/deal";
import { currentGame, readReserve, setGame } from "@server/services/game/store";
import { viewFor } from "@server/services/game/view";
import { getDays, setSlot } from "@server/services/planning/plan";
import { updateSettings } from "@server/services/support/settings";

// DB_PATH=:memory:: one fresh database for this file. Each test plays far in the future on its own days.
const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
for (let i = 1; i <= 20; i++) {
  const meal = createMeal({ name: `Plat ${i}`, kind: "plat", status: "regular", notes: null });
  createRecipe({ mealId: meal.id, name: "R", servings: 2, durationMin: i * 5, steps: [], sourceUrl: null, lines: [] });
}
let offset = 300;
const start = (days: number, player = "a") =>
  startGame({ player, mode: "plan", options: { from: addDays(today(), (offset += 10)), days, moments: ["soir"] } }, seeded(offset));

beforeEach(() => setGame(null));

test("a duo game deals a full hand, lets each pick past the slots, hides the other's picks, and keeps only what both accepted", () => {
  const game = start(2);
  act("b", { type: "join" });
  expect(game.slots).toHaveLength(2);
  expect(game.hand).toHaveLength(6);
  const [c1, c2, c3] = game.hand.map((c) => c.id) as [string, string, string];
  act("a", { type: "pick", card: c1 });
  act("a", { type: "pick", card: c2 });
  // a third pick for two slots is allowed (the count just shows it); here it is taken back
  act("a", { type: "pick", card: c3 });
  expect(viewFor(game, "a").myPicks).toEqual([c1, c2, c3]);
  act("a", { type: "pick", card: c3 });
  act("b", { type: "pick", card: c1 });
  act("b", { type: "pick", card: c3 });
  expect(viewFor(game, "b").myPicks).toEqual([c1, c3]);
  expect(viewFor(game, "b").players.find((p) => p.id === "a")!.picked).toBe(2);
  act("a", { type: "ready", ready: true });
  act("b", { type: "ready", ready: true });
  // c1 matched; each now answers the other's unmatched pick
  expect(game.phase).toBe("catchup");
  expect(game.matches.map((c) => c.id)).toEqual([c1]);
  expect(viewFor(game, "a").toAnswer.map((c) => c.id)).toEqual([c3]);
  act("a", { type: "answer", card: c3, yes: true });
  act("b", { type: "answer", card: c2, yes: false });
  expect(game.phase).toBe("placing");
  expect(game.matches.map((c) => c.id)).toEqual([c1, c3]);
  const [s1, s2] = game.slots.map((s) => `${s.date}/${s.moment}`) as [string, string];
  act("b", { type: "swap", a: s1, b: s2 });
  act("a", { type: "validate" });
  const plan = getDays(game.options.from, 2).slots.filter((s) => s.moment === "soir");
  expect(plan.map((s) => s.entries[0]!.mealId)).toEqual([game.hand[2]!.meals[0]!.id, game.hand[0]!.meals[0]!.id]);
});

test("matches beyond the slots go to the reserve, which comes back in later hands", () => {
  const game = start(1);
  act("b", { type: "join" });
  const [c1, c2] = game.hand.map((c) => c.id) as [string, string];
  act("a", { type: "pick", card: c1 });
  act("b", { type: "pick", card: c2 });
  act("a", { type: "ready", ready: true });
  act("b", { type: "ready", ready: true });
  act("a", { type: "answer", card: c2, yes: true });
  act("b", { type: "answer", card: c1, yes: true });
  expect(game.phase).toBe("placing");
  expect(game.matches).toHaveLength(1);
  expect(readReserve()).toHaveLength(1);
  act("a", { type: "abandon" });
  const next = start(4);
  expect(next.hand.filter((c) => c.tag === "reserve")).toHaveLength(1);
});

test("a refused card is not dealt again and empty slots get a mini-hand", () => {
  const game = start(2);
  act("b", { type: "join" });
  const [c1, c2, c3, c4] = game.hand.map((c) => c.id) as [string, string, string, string];
  act("a", { type: "pick", card: c1 });
  act("a", { type: "pick", card: c2 });
  act("b", { type: "pick", card: c3 });
  act("b", { type: "pick", card: c4 });
  act("a", { type: "ready", ready: true });
  act("b", { type: "ready", ready: true });
  for (const card of [c3, c4]) act("a", { type: "answer", card, yes: false });
  for (const card of [c1, c2]) act("b", { type: "answer", card, yes: false });
  expect(game.phase).toBe("picking");
  expect(game.round).toBe(2);
  const refused = [c1, c2, c3, c4].length;
  expect(refused).toBe(4);
  expect(game.hand.length).toBeGreaterThan(0);
  expect(game.refused.some((id) => game.hand.some((c) => c.meals[0]!.id === id))).toBe(false);
  act("a", { type: "finish" });
  expect(game.phase).toBe("placing");
  expect(game.placement).toEqual({});
});

test("alone, picks go straight to placing; a player joining then sends the game back to the secret round", () => {
  const game = start(1);
  const [c1] = game.hand.map((c) => c.id) as [string];
  act("a", { type: "pick", card: c1 });
  act("a", { type: "ready", ready: true });
  expect(game.phase).toBe("placing");
  act("b", { type: "join" });
  expect(game.phase).toBe("picking");
  expect(game.matches).toEqual([]);
  expect(game.picks.a).toEqual([c1]);
  act("b", { type: "pick", card: c1 });
  act("b", { type: "ready", ready: true });
  expect(game.phase).toBe("placing");
});

test("changing the duration adapts the slots and the hand instead of starting over", () => {
  const game = start(2);
  const first = game.hand.map((c) => c.id);
  act("a", { type: "pick", card: first[0]! });
  act("a", { type: "options", options: { days: 4 } });
  expect(game.slots).toHaveLength(4);
  expect(game.hand).toHaveLength(6);
  expect(game.hand.map((c) => c.id)).toEqual(first);
  expect(game.picks.a).toEqual([first[0]!]);
  act("a", { type: "options", options: { days: 1 } });
  expect(game.hand).toHaveLength(6);
  expect(game.hand.map((c) => c.id)).toContain(first[0]!);
});

test("a long plan fits the screen: 6 cards a round, extra picks go to the reserve", () => {
  const game = start(7);
  expect(game.hand).toHaveLength(6);
  expect(viewFor(game, "a").toPick).toBe(6);
  const ids = game.hand.map((c) => c.id);
  for (const id of ids.slice(0, 4)) act("a", { type: "pick", card: id });
  act("a", { type: "ready", ready: true });
  expect(game.phase).toBe("picking");
  expect(game.round).toBe(2);
  expect(viewFor(game, "a").toPick).toBe(3);
  expect(game.hand).toHaveLength(6);
  expect(game.hand.some((c) => ids.includes(c.id))).toBe(false);
  const before = readReserve().length;
  for (const id of game.hand.slice(0, 4).map((c) => c.id)) act("a", { type: "pick", card: id });
  act("a", { type: "ready", ready: true });
  expect(game.phase).toBe("placing");
  expect(Object.keys(game.placement)).toHaveLength(7);
  expect(readReserve()).toHaveLength(before + 1);
});

test("once members are declared, only they play, and a game started by someone else is dropped", () => {
  start(1, "moi");
  updateSettings({ members: [{ id: "a", name: "A", color: "sun" }, { id: "b", name: "B", color: "sky" }] });
  expect(currentGame()).toBeNull();
  expect(() => start(1, "moi")).toThrow();
  expect(start(1, "a").players).toEqual(["a"]);
  updateSettings({ members: [] });
});

test("with every slot already planned, nothing is dealt until the duration grows", () => {
  const from = addDays(today(), (offset += 10));
  setSlot({ date: from, moment: "soir", entries: [{ mealId: 1 }] });
  const game = startGame({ player: "a", mode: "plan", options: { from, days: 1, moments: ["soir"] } }, seeded(offset));
  expect(game.slots).toEqual([]);
  expect(game.hand).toEqual([]);
  act("a", { type: "options", options: { days: 3 } });
  expect(game.hand).toHaveLength(6);
});

test("filled slots are not drawn, and a start while a game runs joins it", () => {
  const game = start(3);
  setSlot({ date: addDays(game.options.from, 1), moment: "soir", entries: [{ mealId: 1 }] });
  act("a", { type: "abandon" });
  offset -= 10;
  const again = start(3);
  expect(again.slots).toHaveLength(2);
  expect(startGame({ player: "b", mode: "plan" }).id).toBe(again.id);
  expect(again.players).toEqual(["a", "b"]);
});

test("the quick draw only deals meals ready in time, for tonight", () => {
  updateSettings({ quickMaxMinutes: 20 });
  const game = startGame({ player: "a", mode: "quick" }, seeded(3));
  expect(game.slots).toEqual([expect.objectContaining({ date: today(), moment: "soir" })]);
  expect(game.hand.length).toBeGreaterThan(0);
  expect(game.hand.every((c) => c.durationMin !== null && c.durationMin <= 20)).toBe(true);
});

test("assistant ideas stay out of the library and become meals to try once planned", () => {
  const idea = createMeal({ name: "Idée", kind: "plat", status: "idea", notes: null });
  expect(listMeals().some((m) => m.id === idea.id)).toBe(false);
  for (const m of listMeals()) updateMeal(m.id, { status: "regular" });
  // every regular meal has been cooked: the "Nouveau" card is the idea
  for (const [i, m] of listMeals().entries()) setSlot({ date: addDays(today(), -30 - i), moment: "midi", entries: [{ mealId: m.id }] });
  const game = start(1);
  const card = game.hand.find((c) => c.tag === "new")!;
  expect(card.meals[0]!.id).toBe(idea.id);
  act("a", { type: "pick", card: card.id });
  act("a", { type: "ready", ready: true });
  act("a", { type: "validate" });
  expect(getMeal(idea.id).status).toBe("to_try");
});

test("the dice offers a few proposals for one slot, without writing", () => {
  const date = addDays(today(), 900);
  const cards = slotCards(date, "midi", 3, seeded(5));
  expect(cards).toHaveLength(3);
  expect(cards.every((c) => c.suggestion.date === date && c.suggestion.moment === "midi")).toBe(true);
  expect(getDays(date, 1).slots.every((s) => !s.entries.length)).toBe(true);
  expect(currentGame()).toBeNull();
});
