import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveReference } from "@server/agent/reference/save";
import { listMeals, updateMeal } from "@server/services/catalog/meals";

test("saving a reference keeps its source and never duplicates it on retry", () => {
  const directory = mkdtempSync(join(tmpdir(), "meal-reference-"));
  const previous = process.env.MEAL_PLANNER_KNOWLEDGE_DIR;
  process.env.MEAL_PLANNER_KNOWLEDGE_DIR = directory;
  try {
    mkdirSync(join(directory, "sections"));
    writeFileSync(join(directory, "sections", "bread.toast.md"), "# Toast\n\nToast the bread.\n");
    const target = { source: "reference", id: "bread.toast" } as const;
    expect(saveReference({ ...target, id: "absent" })).toBeNull();
    const saved = saveReference(target)!;
    expect(saved).toMatchObject({ name: "Toast", notes: "#reference/bread.toast", status: "to_try" });
    updateMeal(saved.id, { status: "regular", kind: "entree" });
    expect(saveReference(target)).toMatchObject({ id: saved.id, kind: "entree", status: "to_try" });
    expect(listMeals({ status: "to_try" }).filter((entry) => entry.notes === saved.notes)).toHaveLength(1);
  } finally {
    if (previous === undefined) delete process.env.MEAL_PLANNER_KNOWLEDGE_DIR;
    else process.env.MEAL_PLANNER_KNOWLEDGE_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
