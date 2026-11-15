import type { MealSummary } from "@shared/schemas";
import { MEAL_KIND_LABELS } from "@shared/constants";
import { today } from "@shared/dates";
import { agoLabel } from "@/lib/formatting/format";
import { cn } from "@/lib/formatting/utils";

interface MealListProps {
  meals: MealSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function MealList({ meals, selectedId, onSelect }: MealListProps) {
  const now = today();
  return (
    <ul className="block-list">
      {meals.map((meal) => (
        <li key={meal.id}>
          <button
            type="button"
            aria-current={meal.id === selectedId}
            onClick={() => onSelect(meal.id)}
            className={cn(
              "grid min-h-11 w-full grid-cols-[1fr_auto] items-center gap-x-2.5 px-3.5 py-1.5 text-left outline-none hover:bg-active focus-visible:bg-active active:bg-active sm:grid-cols-[1fr_5.5rem_8rem] max-md:min-h-14",
              meal.id === selectedId && "bg-sun hover:bg-sun focus-visible:bg-sun",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">{meal.name}</span>
              <span className="micro-label sm:hidden">{MEAL_KIND_LABELS[meal.kind]}</span>
            </span>
            <span className="micro-label hidden sm:block">{MEAL_KIND_LABELS[meal.kind]}</span>
            <span className={cn("micro-label text-right", meal.status === "to_try" && meal.timesCooked === 0 && "text-brand-text")}>
              {meal.status === "to_try" && meal.timesCooked === 0 ? "à essayer" : agoLabel(meal.lastCooked, now)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
