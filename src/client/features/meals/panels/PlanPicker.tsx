import { useState } from "react";
import { toast } from "sonner";
import { MOMENTS, MOMENT_LABELS } from "@shared/constants";
import { addDays, mondayOf, today, weekDays } from "@shared/dates";
import { WeekNav } from "@/components/layout/WeekNav";
import { dayParts } from "@/lib/formatting/format";
import { useSetSlot, useWeekPlan } from "@/lib/api/queries";

interface PlanPickerProps {
  mealId: number;
  recipeId: number | null;
  onDone: () => void;
}

/** Pick a day and moment (of the current week, or any other) to add the meal to. */
export function PlanPicker({ mealId, recipeId, onDone }: PlanPickerProps) {
  const [week, setWeek] = useState(() => mondayOf(today()));
  const plan = useWeekPlan(week);
  const setSlot = useSetSlot();

  return (
    <div className="flex flex-col gap-2">
      <WeekNav week={week} onShift={(n) => setWeek((w) => addDays(w, 7 * n))} />
      <ul className="flex flex-col gap-1">
        {weekDays(week).map((date) => {
          const { name, day } = dayParts(date);
          return (
            <li key={date} className="flex items-center gap-2">
              <span className="micro-label w-12 shrink-0 whitespace-nowrap">
                {name} {day}
              </span>
              {MOMENTS.map((moment) => {
                const slot = plan.data?.slots.find((s) => s.date === date && s.moment === moment);
                return (
                  <button
                    key={moment}
                    type="button"
                    disabled={!slot}
                    onClick={() => {
                      if (!slot) return;
                      const entries = slot.entries.map((e) => ({ mealId: e.mealId, recipeId: e.recipeId }));
                      setSlot.mutate({ date, moment, entries: [...entries, { mealId, recipeId }] });
                      toast.success(`Planifié · ${name} ${day}, ${MOMENT_LABELS[moment].toLowerCase()}`);
                      onDone();
                    }}
                    className="flex h-9 min-w-0 flex-1 flex-col justify-center rounded-sm border border-border px-2 text-left outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-brand max-md:h-11"
                  >
                    <span className="micro-label">{MOMENT_LABELS[moment]}</span>
                    {slot && slot.entries.length > 0 && (
                      <span className="truncate text-[11px] leading-tight text-muted-foreground">
                        {slot.entries.map((e) => e.mealName).join(" + ")}
                      </span>
                    )}
                  </button>
                );
              })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
