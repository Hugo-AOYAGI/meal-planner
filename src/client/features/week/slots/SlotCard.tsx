import { Dices } from "lucide-react";
import { useState } from "react";
import type { Slot } from "@shared/schemas";
import { COURSE_LABELS, MOMENT_LABELS, courseOf } from "@shared/constants";
import { Overlay } from "@/components/overlays/Overlay";
import { formatNumber, fullDayLabel } from "@/lib/formatting/format";
import { cn } from "@/lib/formatting/utils";
import { MealSheet } from "@/features/meals/panels/MealSheet";
import { type Day, DayEditor, type DayEditorProps } from "@/features/week/days/DayEditor";
import { DrawDialog } from "@/features/week/draw/DrawDialog";

interface SlotCardProps {
  /** the meal this card shows */
  slot: Slot;
  /** both meals of its day: the card opens on its own, and the other one is a tap away */
  day: Day;
  /** `row` (phones): a full-width row. `cell`: a cell of the week grid. */
  variant: "row" | "cell";
  /** a row names its moment ("Midi", "Soir"): set when the day shows both */
  named?: boolean;
}

const focus =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset data-[state=open]:ring-2 data-[state=open]:ring-brand data-[state=open]:ring-inset";
// rows and filled cells sit on a block of colour (`--day`, set by the week grid): they darken it instead of repainting it
const rowBase = "flex min-h-14 w-full px-3 text-left hover:bg-foreground/5 active:bg-foreground/10";
const cellBase = "flex h-full w-full flex-col rounded-lg p-3 text-left";

export function SlotCard({ slot, day, variant, named }: SlotCardProps) {
  const row = variant === "row";
  const [open, setOpenState] = useState(false);
  const [moment, setMoment] = useState(slot.moment);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (!next) setMoment(slot.moment);
  };
  // the recipe opened from the editor: shown in its own sheet once the editor has closed
  const [viewing, setViewing] = useState<Parameters<DayEditorProps["onView"]>[0] | null>(null);
  const filled = slot.entries.length > 0;
  const label = `${MOMENT_LABELS[slot.moment]} ${slot.date}`;
  const momentLabel = row && named && <span className="micro-label">{MOMENT_LABELS[slot.moment]}</span>;

  // the main is the card's bold line; a starter or a dessert is a smaller labelled line above or below it
  const mains = slot.entries.filter((e) => courseOf(e.mealKind) === "plat");
  const side = (course: "entree" | "dessert") =>
    slot.entries
      .filter((e) => e.mealKind === course)
      .map((entry) => (
        <span
          key={entry.id}
          className={cn(
            "my-px min-w-0 shrink-0 text-[13px] leading-tight font-medium break-words",
            row || mains.length > 1 ? "line-clamp-1" : "line-clamp-2",
          )}
        >
          <span className="micro-label mr-1.5">{COURSE_LABELS[course]}</span>
          {entry.mealName}
        </span>
      ));

  const trigger = filled ? (
    <button
      type="button"
      aria-label={label}
      className={cn(
        focus,
        row
          ? cn(rowBase, "flex-col justify-center py-2 pr-12")
          : cn(cellBase, "bg-[var(--day)] pb-9 hover:brightness-[0.97] active:brightness-95"),
      )}
    >
      {momentLabel}
      {/* clipped rather than spilling over the kcal line when a cell is short */}
      <span className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        {side("entree")}
        {mains.length > 0 && (
          <span
            className={cn(
              "min-w-0 shrink-0 leading-tight",
              row
                ? "line-clamp-2 text-base"
                : cn("text-[15px] break-words", mains.length < slot.entries.length ? "line-clamp-3" : "line-clamp-4"),
            )}
          >
            {mains.map((entry, i) => (
              <span key={entry.id} className={cn(!row && "block", i === 0 ? "font-bold" : "font-medium")}>
                {i > 0 && <span className="text-dim">{row ? " + " : "+ "}</span>}
                {entry.mealName}
              </span>
            ))}
          </span>
        )}
        {side("dessert")}
      </span>
      {slot.kcalPerPerson !== null && (
        <span className={cn("text-xs text-dim tabular-nums", row ? "mt-0.5" : "absolute bottom-3 left-3 font-bold")}>
          {formatNumber(slot.kcalPerPerson)} kcal
        </span>
      )}
    </button>
  ) : (
    <button
      type="button"
      aria-label={`${label}: ajouter`}
      className={cn(
        focus,
        "text-dim hover:text-foreground",
        row
          ? cn(rowBase, "items-center justify-between text-[15px] font-bold")
          : cn(cellBase, "items-center justify-center bg-subtle hover:bg-active active:bg-active"),
      )}
    >
      {row && "Ajouter un repas"}
    </button>
  );

  return (
    <div className={cn("relative", variant === "cell" && "h-full")}>
      <Overlay open={open} onOpenChange={setOpen} trigger={trigger} title={fullDayLabel(slot.date)} className="w-80">
        <DayEditor
          day={day}
          moment={moment}
          onMoment={setMoment}
          onClose={() => setOpen(false)}
          onView={(view) => {
            setOpen(false);
            setViewing(view);
          }}
        />
      </Overlay>
      <MealSheet
        selected={viewing?.mealId ?? null}
        recipeId={viewing?.recipeId}
        servings={viewing?.servings}
        onSelect={(mealId) => setViewing((view) => view && { ...view, mealId, recipeId: null })}
        onClose={() => setViewing(null)}
      />
      <DrawDialog date={slot.date} oneDay>
        <button
          type="button"
          aria-label={filled ? "Tirer à nouveau" : "Tirer un repas"}
          className={cn(
            "absolute inline-flex items-center justify-center rounded-sm text-dim outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand",
            row ? "top-1/2 right-0 size-11 -translate-y-1/2" : "right-1.5 bottom-1.5 size-7 hover:bg-foreground/10",
          )}
        >
          <Dices className="size-4" />
        </button>
      </DrawDialog>
    </div>
  );
}
