import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { addDays, today } from "@shared/dates";
import { db } from "@server/db";
import { shoppingExtra } from "@server/db/schema";
import { createIngredient } from "@server/services/catalog/ingredients";
import { createMeal } from "@server/services/catalog/meals";
import { createRecipe } from "@server/services/catalog/recipes";
import { setSlot } from "@server/services/planning/plan";
import { addShoppingExtra, getShoppingList, setShoppingCheck, setShoppingExclusion, updateShoppingExtra } from "@server/services/planning/shopping";

// other test files share the database: only this file's ingredient and lines are looked at
test("a tick covers the meals counted then: a meal put in the list afterwards comes back to buy", () => {
  const ble = createIngredient({ name: "Boulgour coche", aisle: "epicerie", kcal: 350, protein: 12, carbs: 70, fat: 1, fibre: 8, ciqualCode: null, source: "manual" });
  const withBle = (name: string, grams: number) => {
    const m = createMeal({ name, kind: "plat", status: "regular", notes: null });
    createRecipe({ mealId: m.id, name, servings: 2, durationMin: 20, steps: [], sourceUrl: null, lines: [{ ingredientId: ble.id, quantity: grams, unit: "g", grams, gramsEstimated: false, note: null }] });
    return m;
  };
  const taboule = withBle("Taboulé coche", 100);
  const salade = withBle("Salade coche", 60);
  const [d1, d2] = [addDays(today(), 3), addDays(today(), 4)];
  setSlot({ date: d1, moment: "midi", servings: 2, entries: [{ mealId: taboule.id }] });
  setSlot({ date: d2, moment: "midi", servings: 2, entries: [{ mealId: salade.id }] });
  const entry = (name: string) => getShoppingList(7).meals.find((m) => m.name === name)!;
  setShoppingExclusion({ days: 7, entryId: entry("Taboulé coche").entryId, excluded: false });
  const item = () => getShoppingList(7).aisles.flatMap((a) => a.items).find((i) => i.ingredientId === ble.id)!;

  setShoppingCheck({ days: 7, ingredientId: ble.id, checked: true });
  expect(item()).toMatchObject({ checked: true, totalGrams: 100 });
  // the salad is put in the list after the tick: only its share is left to buy
  setShoppingExclusion({ days: 7, entryId: entry("Salade coche").entryId, excluded: false });
  expect(item()).toMatchObject({ checked: false, totalGrams: 60, meals: ["Salade coche"] });
  // rewriting the slot with the same meal keeps the tick
  setSlot({ date: d1, moment: "midi", entries: [{ mealId: taboule.id }] });
  expect(item().meals).toEqual(["Salade coche"]);
  setShoppingCheck({ days: 7, ingredientId: ble.id, checked: false });
  expect(item()).toMatchObject({ checked: false, totalGrams: 160 });
});

test("a hand-added line ticked before today is gone", () => {
  const added = addShoppingExtra({ label: "Éponges coche", aisle: "autre" }).at(-1)!;
  updateShoppingExtra(added.id, { checked: true });
  expect(getShoppingList(7).extras.find((e) => e.id === added.id)?.checked).toBe(true); // still there today
  db.update(shoppingExtra).set({ checkedOn: addDays(today(), -1) }).where(eq(shoppingExtra.id, added.id)).run();
  expect(getShoppingList(7).extras.some((e) => e.id === added.id)).toBe(false);
});
