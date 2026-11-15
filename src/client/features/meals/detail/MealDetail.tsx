import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { MEAL_KIND_LABELS } from "@shared/constants";
import { Overlay } from "@/components/overlays/Overlay";
import { TextTabs } from "@/components/layout/TextTabs";
import { Button } from "@/components/ui/actions/button";
import { Skeleton } from "@/components/ui/feedback/skeleton";
import { api, unwrap } from "@/lib/api/api";
import { invalidate } from "@/lib/api/query";
import { useMeal, useSettings } from "@/lib/api/queries";
import { MealEditForm } from "@/features/meals/editor/MealEditForm";
import { PlanPicker } from "@/features/meals/panels/PlanPicker";
import { RecipeView } from "@/features/meals/detail/RecipeView";

interface MealDetailProps {
  id: number;
  /** the recipe to show first (defaults to the meal's first) */
  recipeId?: number | null;
  /** how many people the quantities are for at first (defaults to the household size) */
  servings?: number;
  onClose: () => void;
}

type Mode = "view" | "edit" | "new-recipe";

export function MealDetail({ id, recipeId: initialRecipeId = null, servings, onClose }: MealDetailProps) {
  const qc = useQueryClient();
  const meal = useMeal(id).data;
  const householdSize = useSettings().data?.householdSize;
  const [mode, setMode] = useState<Mode>("view");
  const [recipeId, setRecipeId] = useState<number | null>(initialRecipeId);
  const [planning, setPlanning] = useState(false);
  const markRegular = useMutation({
    mutationFn: () => unwrap(api.meals[":id"].$patch({ param: { id: String(id) }, json: { status: "regular" } })),
    onSuccess: () => invalidate.meals(qc),
  });

  const setDefault = useMutation({
    mutationFn: (recipeId: number) => unwrap(api.recipes[":id"].default.$post({ param: { id: String(recipeId) } })),
    onSuccess: () => invalidate.meals(qc),
  });

  if (!meal) return <Skeleton className="m-4 h-40" />;
  const recipe = meal.recipes.find((r) => r.id === recipeId) ?? meal.recipes[0] ?? null;
  const people = servings ?? householdSize ?? recipe?.servings ?? 4;
  const cooked = meal.timesCooked === 0 ? "jamais cuisiné" : `cuisiné ${meal.timesCooked} fois`;

  const header = (
    <div className="flex flex-col gap-2 px-4 pt-4 pb-1">
      <span className="micro-label">
        {MEAL_KIND_LABELS[meal.kind]} · {cooked}
      </span>
      <div className="flex items-start gap-2">
        <h2 className="display min-w-0 flex-1 text-[26px]">{meal.name}</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Fermer" className="-mt-1 -mr-2" onClick={onClose}>
          <X />
        </Button>
      </div>
      {mode === "view" && (
        <div className="flex flex-wrap items-center gap-2">
          <Overlay
            open={planning}
            onOpenChange={setPlanning}
            title="Planifier"
            className="w-80"
            trigger={
              <Button variant="outline" size="sm">
                <CalendarPlus />
                Planifier
              </Button>
            }
          >
            <PlanPicker mealId={meal.id} recipeId={recipe?.id ?? null} onDone={() => setPlanning(false)} />
          </Overlay>
          <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
            <Pencil />
            Modifier
          </Button>
          {meal.status === "to_try" && (
            <Button variant="ghost" size="sm" disabled={markRegular.isPending} onClick={() => markRegular.mutate()}>
              À essayer → habituel
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (mode !== "view") {
    return (
      <>
        {header}
        <div className="px-4 pt-3">
          <MealEditForm
            key={mode}
            meal={meal}
            recipe={mode === "new-recipe" ? "new" : recipe}
            onSaved={(result) => {
              if (result.recipeId !== null) setRecipeId(result.recipeId);
              setMode("view");
            }}
            onCancel={() => setMode("view")}
            onMealDeleted={onClose}
            onRecipeDeleted={() => {
              setRecipeId(null);
              setMode("view");
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {meal.notes && <p className="text-xs text-muted-foreground">{meal.notes}</p>}
        {recipe ? (
          <>
            <div className="flex items-end gap-3">
              <TextTabs
                className="min-w-0 flex-1 border-b-0"
                items={meal.recipes.map((r) => ({ value: String(r.id), label: r.name }))}
                value={String(recipe.id)}
                onChange={(value) => setRecipeId(Number(value))}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Ajouter une recette"
                onClick={() => setMode("new-recipe")}
              >
                <Plus />
              </Button>
            </div>
            {meal.recipes.length > 1 &&
              (recipe.id === meal.recipes[0]!.id ? (
                <span className="micro-label -mb-1">Recette par défaut</span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mb-1 -ml-2 self-start"
                  disabled={setDefault.isPending}
                  onClick={() => setDefault.mutate(recipe.id)}
                >
                  Utiliser par défaut
                </Button>
              ))}
            <RecipeView key={`${recipe.id}-${people}`} recipe={recipe} people={people} />
          </>
        ) : (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setMode("new-recipe")}>
            <Plus />
            Ajouter une recette
          </Button>
        )}
      </div>
    </>
  );
}
