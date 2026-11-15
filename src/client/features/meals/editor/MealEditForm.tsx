import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { MEAL_KINDS, MEAL_KIND_LABELS, type MealKind } from "@shared/constants";
import type { MealDetail, Recipe } from "@shared/schemas";
import { ConfirmDelete } from "@/components/overlays/ConfirmDelete";
import { LabeledField } from "@/components/controls/LabeledField";
import { Button } from "@/components/ui/actions/button";
import { Input } from "@/components/ui/inputs/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/actions/select";
import { Textarea } from "@/components/ui/inputs/textarea";
import { api, unwrap } from "@/lib/api/api";
import { invalidate, keys } from "@/lib/api/query";
import { draftToInput, recipeToDraft, type RecipeDraft } from "@/features/meals/editor/draft";
import { RecipeFields } from "@/features/meals/editor/RecipeFields";

interface MealEditFormProps {
  /** null = create */
  meal: MealDetail | null;
  /** the recipe being edited, "new" for a fresh one, null for none */
  recipe: Recipe | "new" | null;
  onSaved: (result: { mealId: number; recipeId: number | null }) => void;
  onCancel: () => void;
  onMealDeleted?: () => void;
  onRecipeDeleted?: () => void;
}

/** Meal fields and, when present, one recipe, edited together. */
export function MealEditForm({ meal, recipe, onSaved, onCancel, onMealDeleted, onRecipeDeleted }: MealEditFormProps) {
  const qc = useQueryClient();
  const [name, setName] = useState(meal?.name ?? "");
  const [kind, setKind] = useState<MealKind>(meal?.kind ?? "plat");
  const [notes, setNotes] = useState(meal?.notes ?? "");
  const [draft, setDraft] = useState<RecipeDraft | null>(() => (recipe === null ? null : recipeToDraft(recipe === "new" ? null : recipe)));

  const save = useMutation({
    mutationFn: async () => {
      const json = { name: name.trim(), kind, notes: notes.trim() || null };
      const saved = meal
        ? await unwrap(api.meals[":id"].$patch({ param: { id: String(meal.id) }, json }))
        : await unwrap(api.meals.$post({ json }));
      if (!draft) return { mealId: saved.id, recipeId: null };
      const body = draftToInput(draft);
      const savedRecipe = draft.id
        ? await unwrap(api.recipes[":id"].$put({ param: { id: String(draft.id) }, json: body }))
        : await unwrap(api.recipes.$post({ json: { ...body, mealId: saved.id } }));
      return { mealId: saved.id, recipeId: savedRecipe.id };
    },
    onSuccess: async (result) => {
      await invalidate.meals(qc);
      onSaved(result);
    },
  });

  const remove = useMutation({
    mutationFn: async (target: "meal" | "recipe") => {
      if (target === "meal" && meal) await unwrap(api.meals[":id"].$delete({ param: { id: String(meal.id) } }));
      if (target === "recipe" && draft?.id) await unwrap(api.recipes[":id"].$delete({ param: { id: String(draft.id) } }));
      return target;
    },
    onSuccess: async (target) => {
      if (target === "meal" && meal) qc.removeQueries({ queryKey: keys.meals.detail(meal.id) });
      (target === "meal" ? onMealDeleted : onRecipeDeleted)?.();
      await invalidate.meals(qc);
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <LabeledField label="Repas">
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!meal} />
      </LabeledField>
      <LabeledField label="Type">
        <Select value={kind} onValueChange={(v) => setKind(v as MealKind)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {MEAL_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </LabeledField>
      <LabeledField label="Notes">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </LabeledField>
      {draft ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <RecipeFields draft={draft} onChange={setDraft} />
          {draft.id && (
            <ConfirmDelete
              label="Supprimer la recette"
              className="self-start"
              title={`Supprimer « ${draft.name} » ?`}
              description="La recette disparaît des repas planifiés qui l'utilisent."
              onConfirm={() => remove.mutate("recipe")}
            />
          )}
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setDraft(recipeToDraft(null))}>
          <Plus />
          Ajouter une recette
        </Button>
      )}
      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {meal && (
          <ConfirmDelete
            label="Supprimer"
            title={`Supprimer « ${meal.name} » ?`}
            description="Le repas, ses recettes, ses passages dans le planning et son historique sont supprimés."
            onConfirm={() => remove.mutate("meal")}
          />
        )}
        <span className="flex-1" />
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={save.isPending || !name.trim() || (draft !== null && !draft.name.trim())}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
