import { ChevronRight } from "lucide-react";
import { MEAL_KIND_LABELS } from "@shared/constants";
import { formatDuration, formatNumber } from "@/lib/formatting/format";
import { mealHref } from "@/lib/formatting/hash";
import { useMeal } from "@/lib/api/queries";

/** A meal the assistant created or changed: name, kind and its first recipe's figures. Opens the meal in Repas. */
export function MealCard({ mealId }: { mealId: number }) {
  const meal = useMeal(mealId, { silent: true }).data;
  if (!meal) return null;
  const recipe = meal.recipes[0];
  const kcal = recipe?.nutrition.perPerson.kcal;
  const facts = [
    MEAL_KIND_LABELS[meal.kind],
    recipe ? (meal.recipes.length > 1 ? `${meal.recipes.length} recettes` : null) : "sans recette",
    kcal ? `${formatNumber(Math.round(kcal))} kcal` : null,
    recipe?.durationMin ? formatDuration(recipe.durationMin) : null,
  ].filter(Boolean);
  return (
    <a
      href={mealHref(meal.id)}
      className="flex min-h-11 items-center gap-2 rounded-md bg-sun px-3 py-2 transition-colors hover:brightness-95"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{meal.name}</span>
        <span className="micro-label block truncate">{facts.join(" · ")}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-dim" />
    </a>
  );
}
