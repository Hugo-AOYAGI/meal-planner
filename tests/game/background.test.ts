import { expect, test } from "bun:test";
import { pendingJobs } from "@server/agent/background";
import { createMeal } from "@server/services/catalog/meals";
import { createRecipe, updateRecipe } from "@server/services/catalog/recipes";

test("background jobs ask for missing durations and for ideas until the stock is full", () => {
  const meal = createMeal({ name: "Sans durée", kind: "plat", status: "regular", notes: null });
  const recipe = createRecipe({ mealId: meal.id, name: "Sans durée", servings: 2, durationMin: null, steps: ["Cuire"], sourceUrl: null, lines: [] });
  const jobs = pendingJobs();
  expect(jobs.map((j) => j.name)).toEqual(["durations", "ideas"]);
  expect(jobs[0]!.prompt).toContain(`recette ${recipe.id}`);
  expect(jobs[1]!.prompt).toContain("Prépare 3 idée(s)");

  updateRecipe(recipe.id, { durationMin: 20 });
  for (const name of ["A", "B", "C"]) createMeal({ name, kind: "plat", status: "idea", notes: null });
  expect(pendingJobs()).toEqual([]);
});
