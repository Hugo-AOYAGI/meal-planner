import { Sheet, SheetContent, SheetTitle } from "@/components/ui/overlays/sheet";
import { MealPanel } from "@/features/meals/panels/MealPanel";

interface MealSheetProps {
  /** a meal id, "new" for the creation form, or null when closed */
  selected: number | "new" | null;
  /** the recipe to show first (defaults to the meal's first) */
  recipeId?: number | null;
  /** how many people the quantities are for at first */
  servings?: number;
  onSelect: (id: number) => void;
  onClose: () => void;
  /** false: the back action does not close it here (a link's history entry does, see MealsPage) */
  back?: boolean;
}

/** A meal in a bottom sheet, over whatever page it was opened from. */
export function MealSheet({ selected, recipeId, servings, onSelect, onClose, back = true }: MealSheetProps) {
  return (
    <Sheet open={selected !== null} onOpenChange={(open) => !open && onClose()} back={back}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[90dvh] gap-0 overflow-y-auto outline-none md:mx-auto md:max-w-xl md:rounded-t-xl md:border-x"
      >
        <SheetTitle className="sr-only">Repas</SheetTitle>
        {selected !== null && (
          <MealPanel
            selected={selected}
            recipeId={recipeId}
            servings={servings}
            onSelect={onSelect}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
