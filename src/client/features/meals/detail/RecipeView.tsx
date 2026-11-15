import { ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Ingredient, Recipe } from "@shared/schemas";
import { scale } from "@shared/calc/scale";
import { ServingsStepper } from "@/components/controls/ServingsStepper";
import { formatDuration, formatGrams, formatQuantity, isWeightUnit } from "@/lib/formatting/format";
import { IngredientDialog } from "@/features/meals/ingredients/IngredientDialog";
import { NutritionStrip } from "@/features/meals/detail/NutritionStrip";

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** A recipe with its quantities scaled to a number of people: `people` at first, then whatever the stepper says. */
export function RecipeView({ recipe, people }: { recipe: Recipe; people: number }) {
  const [servings, setServings] = useState(people);
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <ServingsStepper value={servings} onChange={setServings} />
        <span className="text-sm font-bold">personnes</span>
        <span className="flex-1" />
        {recipe.durationMin !== null && (
          <span className="text-sm font-bold text-dim">{formatDuration(recipe.durationMin)}</span>
        )}
      </div>
      <NutritionStrip nutrition={recipe.nutrition} />
      {recipe.lines.length > 0 && (
        <section>
          <h3 className="display mt-3 mb-2 text-xl">Ingrédients</h3>
          <ul className="text-sm max-md:text-[15px]">
            {recipe.lines.map((line) => {
              const quantity = scale(line.quantity, recipe.servings, servings);
              const grams = scale(line.grams, recipe.servings, servings);
              return (
                <li
                  key={line.id}
                  className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-3 border-t-2 border-foreground py-2"
                >
                  <span className="font-bold tabular-nums">{formatQuantity(quantity, line.unit)}</span>
                  <span className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setIngredient(line.ingredient)}
                      className="text-left hover:underline"
                    >
                      {line.ingredient.name}
                    </button>
                    {line.note && <span className="text-dim"> · {line.note}</span>}
                  </span>
                  {grams !== null && !isWeightUnit(line.unit) && (
                    <span
                      className="text-xs whitespace-nowrap text-dim tabular-nums"
                      title={line.gramsEstimated ? "Poids estimé" : undefined}
                    >
                      ≈ {formatGrams(grams)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {recipe.steps.length > 0 && (
        <section>
          <h3 className="display mt-3 mb-2.5 text-xl">Préparation</h3>
          <ol className="flex flex-col gap-3 text-sm leading-normal max-md:text-[15px]">
            {recipe.steps.map((step, i) => (
              <li key={i} className="grid grid-cols-[1.75rem_1fr] items-baseline">
                <span className="display text-xl tabular-nums">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 self-start text-[11px] text-dim hover:text-foreground"
        >
          <ExternalLink className="size-3" />
          {host(recipe.sourceUrl)}
        </a>
      )}
      <IngredientDialog
        open={ingredient !== null}
        onOpenChange={(open) => !open && setIngredient(null)}
        ingredient={ingredient}
      />
    </div>
  );
}
