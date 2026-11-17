import { expect, test } from "bun:test";
import { addDays, mondayOf, today } from "@shared/dates";
import { applySuggestions, drawDays, drawWeek, redrawSlot, suggestMeals } from "@server/services/planning/draw";
import { createIngredient } from "@server/services/catalog/ingredients";
import { createMeal, getMeal, listMeals } from "@server/services/catalog/meals";
import { addPreference, listPreferences, removePreference } from "@server/services/catalog/preferences";
import { getDays, getWeek, setSlot } from "@server/services/planning/plan";
import { createRecipe, getRecipe, listRecipes, setDefaultRecipe } from "@server/services/catalog/recipes";
import { addShoppingExtra, getShoppingList, setShoppingCheck, setShoppingExclusion } from "@server/services/planning/shopping";
import { getNutritionSummary } from "@server/services/planning/insights";

// DB_PATH=:memory: (see the test script): one fresh in-memory database for this file.
test("meals, recipes, plan, draw and shopping work together", () => {
  const riz = createIngredient({
    name: "Riz",
    aisle: "epicerie",
    kcal: 350,
    protein: 7,
    carbs: 77,
    fat: 1,
    fibre: 1,
    ciqualCode: null,
    source: "ciqual",
  });
  const dahl = createMeal({ name: "Dahl", kind: "plat", status: "regular", notes: null });
  createMeal({ name: "Poulet", kind: "proteine", status: "regular", notes: null });
  createMeal({ name: "Riz blanc", kind: "feculent", status: "regular", notes: null });
  createMeal({ name: "Haricots verts", kind: "legume", status: "regular", notes: null });
  const recipe = createRecipe({
    mealId: dahl.id,
    name: "Dahl",
    servings: 4,
    durationMin: 30,
    steps: ["Cuire"],
    sourceUrl: null,
    lines: [{ ingredientId: riz.id, quantity: 200, unit: "g", grams: 200, gramsEstimated: false, note: null }],
  });
  expect(recipe.nutrition.perPerson.kcal).toBeCloseTo(175);
  expect(getRecipe(recipe.id, 8).lines[0]!.grams).toBe(400);

  const monday = mondayOf(addDays(today(), 7)); // next week: every slot is in the future
  const date = monday;
  const week = setSlot({ date, moment: "midi", servings: 4, entries: [{ mealId: dahl.id }] });
  const slot = week.slots.find((s) => s.date === date && s.moment === "midi")!;
  expect(slot.entries[0]!.recipeId).toBe(recipe.id); // defaults to the first recipe
  expect(slot.kcalPerPerson).toBeCloseTo(175);
  const summary = getNutritionSummary(date).days.find((day) => day.date === date)!;
  expect(summary.detailsPerPerson.iron).toBeNull();
  expect(summary.partialDetails).toContain("iron");

  const drawn = drawWeek(monday);
  const filled = drawn.slots.filter((s) => s.entries.length);
  expect(filled.find((s) => s.date === date && s.moment === "midi")!.entries.map((e) => e.mealId)).toEqual([dahl.id]); // untouched
  const used = filled.flatMap((s) => s.entries.map((e) => e.mealId));
  expect(new Set(used).size).toBe(used.length);
  redrawSlot(addDays(monday, 1), "soir");

  const list = getShoppingList(14); // from today: reaches next Monday
  expect(list).toMatchObject({ from: today(), to: addDays(today(), 13) });
  expect(list.aisles[0]!.items[0]).toMatchObject({ name: "Riz", totalGrams: 200, meals: ["Dahl"] });
  expect(list.meals.some((m) => m.empty)).toBe(true); // the drawn meals have no recipe
  const dahlEntry = list.meals.find((m) => m.name === "Dahl")!;
  const out = setShoppingExclusion({ days: 14, entryId: dahlEntry.entryId, excluded: true });
  expect(out.aisles.flatMap((a) => a.items).some((i) => i.name === "Riz")).toBe(false);
  expect(out.meals.find((m) => m.entryId === dahlEntry.entryId)!.excluded).toBe(true);
  setSlot({ date: dahlEntry.date, moment: dahlEntry.moment, entries: [{ mealId: dahl.id }] }); // rewriting the slot keeps the choice
  expect(getShoppingList(14).meals.find((m) => m.name === "Dahl")!.excluded).toBe(true);
  const back = getShoppingList(14).meals.find((m) => m.name === "Dahl")!;
  expect(setShoppingExclusion({ days: 14, entryId: back.entryId, excluded: false }).aisles[0]!.items[0]).toMatchObject({ name: "Riz" });
  expect(setShoppingCheck({ days: 14, ingredientId: riz.id, checked: true }).aisles[0]!.items[0]!.checked).toBe(true);
  expect(setShoppingCheck({ days: 14, ingredientId: riz.id, checked: false }).aisles[0]!.items[0]!.checked).toBe(false);
  expect(addShoppingExtra({ label: "Piles" })).toHaveLength(1);

  expect(getMeal(dahl.id).timesCooked).toBe(0); // future entries do not count
  expect(listMeals({ q: "dahl" })).toHaveLength(1);
  expect(getWeek(monday).averages.days).toBeGreaterThan(0);
});

test("a run of days is read and drawn from any start date, never before today", () => {
  const filled = (from: string, days: number) =>
    getDays(from, days)
      .slots.filter((s) => s.entries.length)
      .map((s) => `${s.date}/${s.moment}`);
  drawDays(addDays(today(), -3), 3);
  expect(filled(addDays(today(), -3), 3)).toEqual([]);

  const from = addDays(today(), 60);
  const dahl = listMeals({ q: "dahl" })[0]!;
  setSlot({ date: from, moment: "soir", entries: [{ mealId: dahl.id }] });
  const drawn = drawDays(from, 2);
  expect(drawn.slots.map((s) => `${s.date}/${s.moment}`)).toEqual([
    `${from}/midi`,
    `${from}/soir`,
    `${addDays(from, 1)}/midi`,
    `${addDays(from, 1)}/soir`,
  ]);
  expect(drawn.slots[1]!.entries.map((e) => e.mealId)).toEqual([dahl.id]); // untouched
  expect(filled(from, 2)).toEqual([`${from}/soir`, `${addDays(from, 1)}/soir`]); // only the empty slot of an enabled moment
});

test("suggestions respect filters and do not change the plan", () => {
  const date = addDays(today(), 100);
  const meal = createMeal({ name: "Suggestion à essayer", kind: "plat", status: "to_try", notes: null });
  const options = suggestMeals({ date, days: 1, moments: ["midi"], status: "to_try", replace: false });
  expect(options[0]?.meals.map((item) => item.id)).toContain(meal.id);
  expect(getDays(date, 1).slots.every((slot) => slot.entries.length === 0)).toBe(true);
  setSlot({ date, moment: "midi", entries: [{ mealId: meal.id }] });
  expect(suggestMeals({ date, days: 1, moments: ["midi"], status: "to_try", replace: false })).toEqual([]);
});

test("locked suggestions stay reserved and applying a stale proposal changes nothing", () => {
  const date = addDays(today(), 140);
  const first = createMeal({ name: "Verrouillé", kind: "plat", status: "to_try", notes: null });
  const second = createMeal({ name: "Autre option", kind: "plat", status: "to_try", notes: null });
  const locked = [{ date, moment: "soir" as const, mealIds: [first.id] }];
  const options = suggestMeals({ date, days: 2, moments: ["soir"], status: "to_try", replace: false, locked });
  expect(options.some((s) => s.date === date)).toBe(false);
  expect(options.flatMap((s) => s.meals.map((m) => m.id))).not.toContain(first.id);
  const other = addDays(date, 1);
  setSlot({ date: other, moment: "soir", entries: [{ mealId: first.id }] });
  const proposal = (day: string, mealIds: number[], expected: { mealId: number; recipeId: number | null }[] = []) => ({
    date: day,
    moment: "soir" as const,
    meals: mealIds.map((id) => ({ id, name: "" })),
    kept: [],
    expected,
  });
  expect(() => applySuggestions([proposal(date, [second.id]), proposal(other, [second.id])])).toThrow(); // `other` changed: nothing is written
  expect(getDays(date, 1).slots.find((s) => s.moment === "soir")!.entries).toEqual([]);
  expect(getDays(other, 1).slots.find((s) => s.moment === "soir")!.entries[0]!.mealId).toBe(first.id);
  applySuggestions([proposal(date, [second.id])]);
  expect(getDays(date, 1).slots.find((s) => s.moment === "soir")!.entries[0]!.mealId).toBe(second.id);
});

test("the default recipe of a meal is the one planning picks", () => {
  const meal = createMeal({ name: "Deux recettes", kind: "plat", status: "regular", notes: null });
  const recipe = (name: string) =>
    createRecipe({ mealId: meal.id, name, servings: 4, durationMin: null, steps: [], sourceUrl: null, lines: [] });
  const [first, second, third] = [recipe("A"), recipe("B"), recipe("C")];
  expect(listRecipes(meal.id).map((r) => r.id)).toEqual([first!.id, second!.id, third!.id]);
  setDefaultRecipe(third!.id);
  expect(listRecipes(meal.id).map((r) => r.id)).toEqual([third!.id, first!.id, second!.id]);
  const date = addDays(today(), 200);
  const slot = setSlot({ date, moment: "soir", entries: [{ mealId: meal.id }] }).slots.find(
    (s) => s.date === date && s.moment === "soir",
  );
  expect(slot!.entries[0]!.recipeId).toBe(third!.id);
});

test("meals are found by name or ingredient, and can exclude an ingredient", () => {
  const ingredient = (name: string) =>
    createIngredient({ name, aisle: "autre", kcal: 100, protein: 1, carbs: 1, fat: 1, fibre: 1, ciqualCode: null, source: "manual" });
  const poulet = ingredient("Cuisses de poulet");
  const cacahuete = ingredient("Cacahuètes");
  const recipeOf = (name: string, ids: number[]) =>
    createRecipe({
      mealId: createMeal({ name, kind: "plat", status: "regular", notes: null }).id,
      name,
      servings: 2,
      durationMin: null,
      steps: [],
      sourceUrl: null,
      lines: ids.map((ingredientId) => ({ ingredientId, quantity: 100, unit: "g", grams: 100, gramsEstimated: false, note: null })),
    });
  recipeOf("Rôti du dimanche", [poulet.id]);
  recipeOf("Poulet satay", [poulet.id, cacahuete.id]);
  recipeOf("Salade verte", []);

  const names = (q: Parameters<typeof listMeals>[0]) => listMeals(q).map((m) => m.name).sort();
  expect(names({ q: "poulet" })).toEqual(["Poulet", "Poulet satay", "Rôti du dimanche"]); // by name or by ingredient
  expect(names({ q: "poulet", excludes: "cacahuete" })).toEqual(["Poulet", "Rôti du dimanche"]); // accent-insensitive; "Poulet" has no recipe
  expect(names({ excludes: "poulet" })).not.toContain("Poulet satay");
  expect(names({ q: "salade" })).toEqual(["Salade verte"]);
});

test("preferences are listed, added and removed", () => {
  const a = addPreference({ text: "Pas de porc" });
  addPreference({ text: "Léo n'aime pas les champignons" });
  expect(listPreferences().map((p) => p.text)).toEqual(["Pas de porc", "Léo n'aime pas les champignons"]);
  removePreference(a.id);
  expect(listPreferences()).toHaveLength(1);
  expect(() => removePreference(a.id)).toThrow();
});
