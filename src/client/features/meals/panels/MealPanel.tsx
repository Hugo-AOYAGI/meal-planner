import { X } from "lucide-react";
import { Button } from "@/components/ui/actions/button";
import { MealDetail } from "@/features/meals/detail/MealDetail";
import { MealEditForm } from "@/features/meals/editor/MealEditForm";

interface MealPanelProps {
  /** a meal id, or "new" for the creation form */
  selected: number | "new";
  /** the recipe to show first (defaults to the meal's first) */
  recipeId?: number | null;
  /** how many people the quantities are for at first */
  servings?: number;
  onSelect: (id: number) => void;
  onClose: () => void;
}

/** Content of the meal drawer: detail of a meal, or the creation form. */
export function MealPanel({ selected, recipeId, servings, onSelect, onClose }: MealPanelProps) {
  if (selected === "new") {
    return (
      <div className="flex flex-col gap-3 px-4 pt-3.5">
        <div className="flex items-center">
          <span className="micro-label flex-1">Nouveau repas</span>
          <Button variant="ghost" size="icon-sm" aria-label="Fermer" className="-mr-2" onClick={onClose}>
            <X />
          </Button>
        </div>
        <MealEditForm meal={null} recipe={null} onSaved={({ mealId }) => onSelect(mealId)} onCancel={onClose} />
      </div>
    );
  }
  return <MealDetail key={selected} id={selected} recipeId={recipeId} servings={servings} onClose={onClose} />;
}
