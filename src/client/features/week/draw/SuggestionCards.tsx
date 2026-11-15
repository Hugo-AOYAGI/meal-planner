import { ArrowDown, ArrowUp, GripVertical, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { MOMENTS, MOMENT_LABELS, type Moment } from "@shared/constants";
import { daysFrom } from "@shared/dates";
import type { Suggestion } from "@shared/schemas";
import { fullDayLabel } from "@/lib/formatting/format";
import { cn } from "@/lib/formatting/utils";
import { SLOT_ATTRIBUTE, useSlotDrag } from "./use-slot-drag";
import { slotKey } from "./use-draw-session";

const COLORS = ["var(--sun)", "var(--tomato)", "var(--leaf)", "var(--sky)", "var(--lilac)", "var(--rose)"];
/** A proposal keeps its colour wherever it is moved: it follows its first meal. */
const colorOf = (suggestion: Suggestion) => COLORS[suggestion.meals[0]!.id % COLORS.length];

const iconButton = "grid shrink-0 place-items-center focus-visible:outline-2";

interface RowProps {
  day: string;
  moment: Moment;
  suggestion?: Suggestion;
  locked: boolean;
  /** lock and move controls: pointless when a single slot is drawn */
  controls: boolean;
  /** the slots just before and after this one that hold a proposal, to move it to */
  neighbours: { previous?: string; next?: string };
  onToggleLock: (key: string) => void;
  onSwap: (a: string, b: string) => void;
  dragHandlers: ReturnType<ReturnType<typeof useSlotDrag>>;
}

function Row({ day, moment, suggestion, locked, controls, neighbours, onToggleLock, onSwap, dragHandlers }: RowProps) {
  const key = slotKey({ date: day, moment });
  const slotLabel = `${MOMENT_LABELS[moment]} ${fullDayLabel(day)}`;
  return (
    <div
      {...{ [SLOT_ATTRIBUTE]: key }}
      className="flex min-h-12 items-center gap-2 rounded-lg px-2 py-1.5"
      style={{ backgroundColor: suggestion ? colorOf(suggestion) : "var(--background)" }}
    >
      <span className="w-10 shrink-0 text-xs font-bold">{MOMENT_LABELS[moment]}</span>
      {!suggestion ? (
        <span className="text-sm text-dim">Aucune proposition</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-sm font-bold">
            {suggestion.meals.map((meal) => meal.name).join(" + ")}
          </span>
          {controls && (
            <>
              <button
                type="button"
                onClick={() => onToggleLock(key)}
                aria-pressed={locked}
                aria-label={`${locked ? "Déverrouiller" : "Garder"} ${slotLabel}`}
                className={cn(
                  iconButton,
                  "size-9 rounded-lg",
                  locked ? "bg-foreground text-background" : "bg-white/60",
                )}
              >
                {locked ? <LockKeyhole className="size-4" /> : <UnlockKeyhole className="size-4" />}
              </button>
              {/* arrows with a mouse, a handle to drag with a finger */}
              <div className="hidden flex-col md:flex">
                <button
                  type="button"
                  disabled={!neighbours.previous}
                  onClick={() => onSwap(key, neighbours.previous!)}
                  aria-label="Déplacer vers le créneau précédent"
                  className="disabled:opacity-25"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={!neighbours.next}
                  onClick={() => onSwap(key, neighbours.next!)}
                  aria-label="Déplacer vers le créneau suivant"
                  className="disabled:opacity-25"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>
              <button
                type="button"
                aria-label="Glisser vers un autre créneau"
                className={cn(iconButton, "size-8 touch-none cursor-grab active:cursor-grabbing md:hidden")}
                {...dragHandlers}
              >
                <GripVertical className="size-4" />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface SuggestionCardsProps {
  date: string;
  days: number;
  moments: Moment[];
  suggestions: Suggestion[];
  locked: string[];
  onToggleLock: (key: string) => void;
  onSwap: (a: string, b: string) => void;
}

/** The proposals, day by day. A single slot needs no date, lock or move controls. */
export function SuggestionCards({
  date,
  days,
  moments,
  suggestions,
  locked,
  onToggleLock,
  onSwap,
}: SuggestionCardsProps) {
  const dragHandlers = useSlotDrag(onSwap);
  const shown = MOMENTS.filter((moment) => moments.includes(moment));
  const single = days === 1 && shown.length === 1;
  const order = suggestions.map(slotKey).toSorted();
  return (
    <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1" aria-label="Suggestions par jour">
      {daysFrom(date, days).map((day) => (
        <section key={day} className="rounded-xl bg-subtle p-2.5">
          {!single && <h3 className="mb-1.5 px-1 text-sm font-bold first-letter:uppercase">{fullDayLabel(day)}</h3>}
          <div className="space-y-1.5">
            {shown.map((moment) => {
              const key = slotKey({ date: day, moment });
              const at = order.indexOf(key);
              return (
                <Row
                  key={key}
                  day={day}
                  moment={moment}
                  suggestion={suggestions.find((s) => slotKey(s) === key)}
                  locked={locked.includes(key)}
                  controls={!single}
                  neighbours={{ previous: order[at - 1], next: order[at + 1] }}
                  onToggleLock={onToggleLock}
                  onSwap={onSwap}
                  dragHandlers={dragHandlers(key)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
