import { Dices, Moon, Sun } from "lucide-react";
import { MOMENTS, MOMENT_LABELS, type Moment } from "@shared/constants";
import type { Slot } from "@shared/schemas";
import { MealPicker } from "@/components/controls/MealPicker";
import { fullDayLabel } from "@/lib/formatting/format";
import { useSetSlot } from "@/lib/api/queries";
import { cn } from "@/lib/formatting/utils";
import { SlotEditor } from "@/features/week/slots/SlotEditor";
import { DrawDialog } from "@/features/week/draw/DrawDialog";
import { Button } from "@/components/ui/actions/button";

export type Day = Record<Moment, Slot>;

const ICONS = { midi: Sun, soir: Moon };
const NEW_LABELS: Record<Moment, string> = {
  midi: "Nouveau déjeuner",
  soir: "Nouveau dîner",
};

export interface DayEditorProps {
  day: Day;
  moment: Moment;
  onMoment: (moment: Moment) => void;
  onClose: () => void;
  /** opens a recipe, for the number of people of the slot it is in */
  onView: (view: { mealId: number; recipeId: number | null; servings: number }) => void;
}

/** What a day opens: choose lunch or dinner, then edit that meal, or fill it when it is still empty. */
export function DayEditor({ day, moment, onMoment, onClose, onView }: DayEditorProps) {
  const setSlot = useSetSlot();
  const slot = day[moment];
  return (
    <div className="flex flex-col gap-3">
      <span className="micro-label">{fullDayLabel(slot.date)}</span>
      <div role="tablist" aria-label="Repas" className="grid grid-cols-2 gap-1 rounded-md bg-subtle p-1">
        {MOMENTS.map((m) => {
          const Icon = ICONS[m];
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={m === moment}
              onClick={() => onMoment(m)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-sm text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-brand md:min-h-9",
                m === moment ? "bg-foreground text-background" : "text-dim hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {MOMENT_LABELS[m]}
            </button>
          );
        })}
      </div>
      {slot.entries.length ? (
        <SlotEditor
          key={moment}
          slot={slot}
          onClose={onClose}
          onView={(mealId, recipeId) => onView({ mealId, recipeId, servings: slot.servings })}
        />
      ) : (
        <>
          <MealPicker
            key={moment}
            title={NEW_LABELS[moment]}
            onPick={(meal) => {
              setSlot.mutate({ date: slot.date, moment, entries: [{ mealId: meal.id }] });
              onClose();
            }}
          />
          <DrawDialog date={slot.date} oneDay moment={moment}>
            <Button variant="outline" size="sm">
              <Dices />
              Tirer
            </Button>
          </DrawDialog>
        </>
      )}
    </div>
  );
}
