import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { MOMENT_LABELS, type Moment } from "@shared/constants";
import type { GameCard, GameView } from "@shared/schemas";
import { Button } from "@/components/ui/actions/button";
import { fullDayLabel } from "@/lib/formatting/format";
import { cn } from "@/lib/formatting/utils";
import { CardMeta, cardName, colorOf } from "../cards/GameCardTile";
import type { GameSession } from "../use-game-session";
import { SLOT_ATTRIBUTE, useSlotDrag } from "../use-slot-drag";

/** Identifies a slot in the `swap` action. */
const slotKey = (slot: { date: string; moment: Moment }) => `${slot.date}/${slot.moment}`;
const iconButton = "grid shrink-0 place-items-center focus-visible:outline-2 disabled:opacity-25";

interface RowProps {
  slot: { date: string; moment: Moment; card: GameCard };
  previous?: string;
  next?: string;
  onSwap: (a: string, b: string) => void;
  drag: ReturnType<ReturnType<typeof useSlotDrag>>;
}

function Row({ slot, previous, next, onSwap, drag }: RowProps) {
  const key = slotKey(slot);
  return (
    <div
      {...{ [SLOT_ATTRIBUTE]: key }}
      className="flex min-h-14 items-center gap-2 rounded-lg px-3 py-2"
      style={{ backgroundColor: colorOf(slot.card) }}
    >
      <span className="w-10 shrink-0 text-xs font-bold">{MOMENT_LABELS[slot.moment]}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-extrabold">{cardName(slot.card)}</span>
        <CardMeta card={slot.card} />
      </span>
      {/* arrows with a mouse, a handle to drag with a finger */}
      <div className="hidden flex-col md:flex">
        <button type="button" disabled={!previous} onClick={() => onSwap(key, previous!)} aria-label="Monter" className={iconButton}>
          <ArrowUp className="size-4" />
        </button>
        <button type="button" disabled={!next} onClick={() => onSwap(key, next!)} aria-label="Descendre" className={iconButton}>
          <ArrowDown className="size-4" />
        </button>
      </div>
      {(previous || next) && (
        <button
          type="button"
          aria-label="Glisser vers un autre créneau"
          className={cn(iconButton, "size-11 touch-none cursor-grab active:cursor-grabbing md:hidden")}
          {...drag}
        >
          <GripVertical className="size-5" />
        </button>
      )}
    </div>
  );
}

/** The result: the matches in their slots, day by day, to reorder before adding them to the planning. */
export function PlacingScreen({ session, view }: { session: GameSession; view: GameView }) {
  const swap = (a: string, b: string) => {
    if (a !== b) session.act({ type: "swap", a, b });
  };
  const drag = useSlotDrag(swap);
  const order = view.placement.map(slotKey);
  const days = [...new Set(view.placement.map((p) => p.date))];
  const empty = view.slots.length - view.placement.length;

  return (
    <div className="flex flex-col gap-3">
      {view.exhausted && (
        <p className="rounded-xl bg-subtle px-4 py-3 text-sm font-bold">
          La bibliothèque n’a plus rien à proposer : on garde ce qu’on a.
        </p>
      )}
      {view.placement.length ? (
        <div className="max-h-[50dvh] space-y-2 overflow-y-auto pr-1" aria-label="Repas retenus">
          {days.map((day) => (
            <section key={day} className="rounded-xl bg-subtle p-2.5">
              <h3 className="mb-1.5 px-1 text-sm font-bold first-letter:uppercase">{fullDayLabel(day)}</h3>
              <div className="space-y-1.5">
                {view.placement
                  .filter((p) => p.date === day)
                  .map((slot) => {
                    const at = order.indexOf(slotKey(slot));
                    return (
                      <Row
                        key={slotKey(slot)}
                        slot={slot}
                        previous={order[at - 1]}
                        next={order[at + 1]}
                        onSwap={swap}
                        drag={drag(slotKey(slot))}
                      />
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="font-bold">Aucun plat retenu cette fois.</p>
      )}
      {empty > 0 && view.placement.length > 0 && (
        <p className="text-sm text-dim">
          {empty} {empty === 1 ? "créneau reste libre" : "créneaux restent libres"}.
        </p>
      )}
      <Button
        className="h-12 text-base"
        disabled={!view.placement.length || session.busy}
        onClick={() => session.act({ type: "validate" })}
      >
        {session.busy ? "Ajout…" : "Ajouter au planning"}
      </Button>
    </div>
  );
}
