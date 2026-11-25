import { expect, test } from "bun:test";
import { addDays, today } from "@shared/dates";
import { createIngredient } from "@server/services/catalog/ingredients";
import { createMeal, getMeal } from "@server/services/catalog/meals";
import { createRecipe } from "@server/services/catalog/recipes";
import { addLeftover, eatLeftover, listFridge, updateLeftover } from "@server/services/fridge/leftovers";
import { reminderText } from "@server/services/fridge/reminders";
import { getDays, setSlot } from "@server/services/planning/plan";
import { getShoppingList, setShoppingExclusion } from "@server/services/planning/shopping";

// other test files share the database: only this file's meals are looked at
let n = 0;
function cooked(name: string) {
  const lentils = createIngredient({ name: `Lentilles frigo ${++n}`, aisle: "epicerie", kcal: 300, protein: 20, carbs: 50, fat: 1, fibre: 10, ciqualCode: null, source: "manual" });
  const m = createMeal({ name, kind: "plat", status: "regular", notes: null });
  createRecipe({ mealId: m.id, name, servings: 2, durationMin: 30, steps: [], sourceUrl: null, lines: [{ ingredientId: lentils.id, quantity: 100, unit: "g", grams: 100, gramsEstimated: false, note: null }] });
  return { meal: m, lentils };
}
const inFridge = (name: string) => listFridge().find((l) => l.name === name);

test("portions kept go to the fridge on the day they are cooked, and are bought with the meal", () => {
  const { meal, lentils } = cooked("Dahl frigo");
  const later = addDays(today(), 2);
  setSlot({ date: later, moment: "soir", servings: 2, entries: [{ mealId: meal.id, keep: 4 }] });
  expect(inFridge("Dahl frigo")).toBeUndefined(); // not cooked yet

  const entry = getShoppingList(7).meals.find((m) => m.name === "Dahl frigo")!;
  setShoppingExclusion({ days: 7, entryId: entry.entryId, excluded: false });
  const item = getShoppingList(7).aisles.flatMap((a) => a.items).find((i) => i.ingredientId === lentils.id)!;
  expect(item.totalGrams).toBe(300); // 2 at the table + 4 kept, for a recipe of 2

  setSlot({ date: today(), moment: "midi", servings: 2, entries: [{ mealId: meal.id, keep: 4 }] });
  expect(inFridge("Dahl frigo")).toMatchObject({ remaining: 4, age: 0, manual: false });
  // rewriting the slot without saying keeps the portions; changing them moves what remains
  setSlot({ date: today(), moment: "midi", entries: [{ mealId: meal.id }] });
  expect(inFridge("Dahl frigo")?.remaining).toBe(4);
  setSlot({ date: today(), moment: "midi", entries: [{ mealId: meal.id, keep: 2 }] });
  expect(inFridge("Dahl frigo")?.remaining).toBe(2);
  setSlot({ date: today(), moment: "midi", entries: [{ mealId: meal.id, keep: 0 }] });
  expect(inFridge("Dahl frigo")).toBeUndefined();
  setSlot({ date: later, moment: "soir", entries: [] });
});

test("a meal planned again keeps as many portions as last time", () => {
  const { meal } = cooked("Chili frigo");
  setSlot({ date: addDays(today(), 1), moment: "soir", entries: [{ mealId: meal.id, keep: 4 }] });
  setSlot({ date: addDays(today(), 5), moment: "soir", entries: [{ mealId: meal.id }] });
  expect(getDays(addDays(today(), 5), 1).slots.find((s) => s.moment === "soir")!.entries[0]!.keep).toBe(4);
  setSlot({ date: addDays(today(), 1), moment: "soir", entries: [] });
  setSlot({ date: addDays(today(), 5), moment: "soir", entries: [] });
});

test("eating a leftover plans it as not cooked and not bought; removing it gives the portions back", () => {
  const { meal } = cooked("Curry frigo");
  const yesterday = addDays(today(), -1);
  setSlot({ date: yesterday, moment: "soir", servings: 2, entries: [{ mealId: meal.id, keep: 4 }] });
  const before = getMeal(meal.id).timesCooked;
  const l = inFridge("Curry frigo")!;
  expect(l.age).toBe(1);

  eatLeftover(l.id, { date: today(), moment: "soir" });
  expect(inFridge("Curry frigo")?.remaining).toBe(2);
  const tonight = getDays(today(), 1).slots.find((s) => s.moment === "soir")!;
  expect(tonight.entries.find((e) => e.mealId === meal.id)).toMatchObject({ leftoverId: l.id, keep: 0, excluded: true });
  expect(getMeal(meal.id).timesCooked).toBe(before);
  expect(getShoppingList(7).meals.some((m) => m.name === "Curry frigo")).toBe(false);

  setSlot({ date: today(), moment: "soir", entries: tonight.entries.filter((e) => e.mealId !== meal.id) });
  expect(inFridge("Curry frigo")?.remaining).toBe(4);
  setSlot({ date: yesterday, moment: "soir", entries: [] });
});

test("leftovers added by hand, corrected, finished; the reminder names those 2 days old or more", () => {
  addLeftover({ name: "Pizza frigo", portions: 3, createdOn: addDays(today(), -3) });
  const pizza = inFridge("Pizza frigo")!;
  expect(pizza).toMatchObject({ manual: true, remaining: 3, age: 3, mealId: null });
  eatLeftover(pizza.id, { date: today(), moment: "soir" }); // no meal to plan: the household's portions come off
  expect(inFridge("Pizza frigo")?.remaining).toBe(1);
  updateLeftover(pizza.id, { remaining: 2 });
  expect(inFridge("Pizza frigo")?.remaining).toBe(2);
  expect(reminderText([inFridge("Pizza frigo")!])).toBe("Au frigo : pizza frigo (2 parts, 3 j)");
  expect(reminderText([{ ...inFridge("Pizza frigo")!, age: 1 }])).toBeNull();
  updateLeftover(pizza.id, { done: "thrown" });
  expect(inFridge("Pizza frigo")).toBeUndefined();
});
