import { expect, test } from "bun:test";
import { pendingJobs } from "@server/agent/background";
import { createMeal, listMeals } from "@server/services/catalog/meals";
import { createRecipe, updateRecipe } from "@server/services/catalog/recipes";

test("background jobs ask for missing durations and for ideas until the stock is full", () => {
  const meal = createMeal({ name: "Sans durée", kind: "plat", status: "regular", notes: null });
  const recipe = createRecipe({ mealId: meal.id, name: "Sans durée", servings: 2, durationMin: null, steps: ["Cuire"], sourceUrl: null, lines: [] });
  // other test files share the database: only this recipe and the idea count are checked
  const job = (name: string) => pendingJobs().find((j) => j.name === name);
  expect(job("durations")!.prompt).toContain(`recette ${recipe.id} `);
  const ideas = listMeals({ status: "idea" }).length;
  expect(job("ideas")!.prompt).toContain(`Prépare ${3 - ideas} idée(s)`);

  updateRecipe(recipe.id, { durationMin: 20 });
  for (const name of ["A", "B", "C"]) createMeal({ name, kind: "plat", status: "idea", notes: null });
  expect(job("durations")?.prompt ?? "").not.toContain(`recette ${recipe.id} `);
  expect(job("ideas")).toBeUndefined();
});
