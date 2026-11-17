import { ChevronDown } from "lucide-react";
import { MOMENT_LABELS } from "@shared/constants";
import type { ShoppingMeal } from "@shared/schemas";
import { Switch } from "@/components/ui/actions/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/feedback/collapsible";
import { fullDayLabel } from "@/lib/formatting/format";
import { mealHref } from "@/lib/formatting/hash";
import { cn } from "@/lib/formatting/utils";

interface MealsSectionProps {
  meals: ShoppingMeal[];
  onToggle: (meal: ShoppingMeal, excluded: boolean) => void;
}

/**
 * The planned meals and whether each counts in the list. A newly planned meal starts out of the list: it is put in by hand
 * with its switch. Folded by default, open while none counts yet (otherwise the list would look empty for no reason).
 */
export function MealsSection({ meals, onToggle }: MealsSectionProps) {
  if (!meals.length) return null;
  const withRecipe = meals.filter((m) => !m.empty);
  const counted = withRecipe.filter((m) => !m.excluded).length;
  return (
    <Collapsible defaultOpen={counted === 0}>
      <CollapsibleTrigger className="group micro-label ml-0.5 flex items-center gap-1 outline-none hover:text-foreground focus-visible:text-foreground">
        Repas pris en compte · {counted} / {withRecipe.length}
        <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="block-list mt-2">
          {meals.map((m) => (
            <li key={m.entryId} className="flex min-h-12 items-center gap-3 px-3.5 md:min-h-11">
              <span className={cn("min-w-0 flex-1", m.excluded && "text-dim")}>
                <a href={mealHref(m.mealId)} className={cn("block truncate text-[15px] font-medium", m.excluded && "line-through")}>
                  {m.name}
                </a>
                <small className="block truncate text-xs text-dim">
                  {fullDayLabel(m.date)} · {MOMENT_LABELS[m.moment]}
                </small>
              </span>
              {m.empty ? (
                <span className="shrink-0 text-xs text-dim">Sans recette</span>
              ) : (
                <Switch checked={!m.excluded} onCheckedChange={(on) => onToggle(m, !on)} aria-label={`${m.name} : compter dans la liste`} />
              )}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
