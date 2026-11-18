import { inArray } from "drizzle-orm";
import { referenceHref, type ReferenceTarget } from "@shared/references/links";
import { db } from "../../db";
import { meal } from "../../db/schema";
import { createMeal, updateMeal } from "../../services/catalog/meals";
import { knowledgeDirectory, legacyReferenceDirectory, readReference, referenceTitle } from "./knowledge";

/** A bookmarked reference keeps its full recipe in the Markdown reader. */
export function saveReference(target: ReferenceTarget) {
  const directory = target.source === "reference" ? knowledgeDirectory() : legacyReferenceDirectory();
  const markdown = readReference(target.id, directory);
  if (markdown === undefined) return null;

  const aliases = knowledgeDirectory() === legacyReferenceDirectory()
    ? [referenceHref({ ...target, source: "reference" }), referenceHref({ ...target, source: "food-lab" })]
    : [referenceHref(target)];
  return db.transaction(() => {
    const existing = db.select({ id: meal.id }).from(meal).where(inArray(meal.notes, aliases)).get();
    if (existing) return updateMeal(existing.id, { status: "to_try" });
    return createMeal({
      name: referenceTitle(markdown, target.id).slice(0, 120),
      kind: "plat",
      status: "to_try",
      notes: referenceHref(target),
    });
  }, { behavior: "immediate" });
}
