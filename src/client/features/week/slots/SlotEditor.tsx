import { ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { COURSE_LABELS, courseOf } from "@shared/constants";
import type { Slot, SlotEntryInput } from "@shared/schemas";
import { MealPicker } from "@/components/controls/MealPicker";
import { ServingsStepper } from "@/components/controls/ServingsStepper";
import { Button } from "@/components/ui/actions/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/actions/select";
import { useSetSlot } from "@/lib/api/queries";

/** Brings the picker into view when it opens at the bottom of a popover or sheet that scrolls. */
const reveal = (el: HTMLElement | null) => el?.scrollIntoView({ block: "nearest" });

interface SlotEditorProps {
  slot: Slot;
  onClose: () => void;
  /** opens the recipe of one of the slot's meals */
  onView: (mealId: number, recipeId: number | null) => void;
}

/**
 * Entries of a filled slot, in course order: each opens its recipe; recipe choice, removal, adding a meal, servings.
 * Courses get a heading as soon as the slot has a starter or a dessert.
 */
export function SlotEditor({ slot, onClose, onView }: SlotEditorProps) {
  const setSlot = useSetSlot();
  const [adding, setAdding] = useState(false);
  const [servings, setServings] = useState(slot.servings);
  const entries: SlotEntryInput[] = slot.entries.map((e) => ({
    mealId: e.mealId,
    recipeId: e.recipeId,
  }));
  const courses = slot.entries.map((e) => courseOf(e.mealKind));
  const headed = courses.some((c) => c !== "plat");
  const save = (next: typeof entries) =>
    setSlot.mutate({ date: slot.date, moment: slot.moment, entries: next });

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {slot.entries.map((entry, i) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center gap-x-2 max-md:min-h-11"
          >
            {headed && courses[i] !== courses[i - 1] && (
              <span className="micro-label w-full pt-1.5">
                {COURSE_LABELS[courses[i]!]}
              </span>
            )}
            <button
              type="button"
              aria-label={`${entry.mealName} : voir la recette`}
              onClick={() => onView(entry.mealId, entry.recipeId)}
              className="-ml-2 flex min-h-9 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-left text-[15px] font-bold outline-none hover:bg-subtle focus-visible:bg-subtle active:bg-active max-md:min-h-11"
            >
              <span className="truncate">{entry.mealName}</span>
              {!entry.excluded && <span className="micro-label shrink-0 pl-1">aux courses</span>}
              <ChevronRight className="size-4 shrink-0 text-dim" />
            </button>
            {entry.recipeOptions.length > 1 && (
              <Select
                value={String(entry.recipeId ?? "")}
                onValueChange={(id) =>
                  save(
                    entries.map((e, j) =>
                      j === i ? { ...e, recipeId: Number(id) } : e,
                    ),
                  )
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Recette"
                  className="max-w-36 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entry.recipeOptions.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Retirer"
              onClick={() => {
                save(entries.filter((_, j) => j !== i));
                if (entries.length === 1) onClose();
              }}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      {adding ? (
        <div ref={reveal}>
          <MealPicker
            onPick={(meal) => {
              save([...entries, { mealId: meal.id }]);
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          <Plus />
          Compléter le repas
        </Button>
      )}
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <ServingsStepper
          value={servings}
          onChange={(n) => {
            setServings(n);
            setSlot.mutate({
              date: slot.date,
              moment: slot.moment,
              servings: n,
            });
          }}
        />
        <span className="micro-label">personnes</span>
      </div>
    </div>
  );
}
