import { RotateCw } from "lucide-react";
import type { Moment } from "@shared/constants";
import type { SlotCard } from "@shared/schemas";
import { Button } from "@/components/ui/actions/button";
import { cn } from "@/lib/formatting/utils";
import { useApplyCard, useSlotCards } from "./use-slot-cards";

const COLORS = ["var(--sun)", "var(--tomato)", "var(--leaf)", "var(--sky)", "var(--lilac)", "var(--rose)"];
/** Same colour as the draw gives the meal: it follows its first meal. */
const colorOf = (card: SlotCard) => COLORS[card.suggestion.meals[0]!.id % COLORS.length];
/** a hand of cards: the outer ones lean out */
const TILT = ["-rotate-3 translate-y-1", "", "rotate-3 translate-y-1"];
const cardShape = "min-h-32 flex-1 basis-0 rounded-xl p-2.5";

interface DiceFanProps {
  date: string;
  moment: Moment;
  /** after a card has been written to the slot */
  onApplied: () => void;
}

/** Three cards for one slot: tap one to put it in the slot, "↻" to deal three new ones. */
export function DiceFan({ date, moment, onApplied }: DiceFanProps) {
  const cards = useSlotCards(date, moment);
  const apply = useApplyCard();
  const dealing = cards.isFetching;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-stretch gap-2 px-1 pt-1" aria-busy={dealing}>
        {cards.data?.length
          ? cards.data.map((card, i) => {
              const name = card.suggestion.meals.map((meal) => meal.name).join(" + ");
              return (
                <button
                  // a new deal remounts the cards, so they slide in again
                  key={`${cards.dataUpdatedAt}-${i}`}
                  type="button"
                  disabled={apply.isPending || dealing}
                  onClick={() => apply.mutate(card.suggestion, { onSuccess: onApplied })}
                  aria-label={`Choisir ${name}${card.tag === "reserve" ? " (envie commune)" : ""}`}
                  style={{ backgroundColor: colorOf(card), animationDelay: `${i * 60}ms` }}
                  className={cn(
                    cardShape,
                    TILT[i],
                    "relative flex flex-col justify-end text-left text-sm leading-tight font-bold break-words outline-none",
                    "animate-in fill-mode-backwards fade-in-0 slide-in-from-bottom-3 duration-200",
                    "transition-transform hover:-translate-y-1 hover:rotate-0 focus-visible:ring-2 focus-visible:ring-brand active:scale-95",
                    "disabled:opacity-60",
                  )}
                >
                  {card.tag === "reserve" && (
                    <span className="absolute top-2 left-2 text-base" title="Envie commune" aria-hidden>
                      💛
                    </span>
                  )}
                  <span className="line-clamp-5">{name}</span>
                </button>
              );
            })
          : [0, 1, 2].map((i) => (
              <div key={i} className={cn(cardShape, TILT[i], "bg-subtle", dealing && "animate-pulse")} />
            ))}
      </div>
      {cards.isError && <p className="text-xs text-dim">Impossible de tirer. Réessaie.</p>}
      {cards.data?.length === 0 && <p className="text-xs text-dim">Rien à proposer pour ce créneau.</p>}
      {apply.isError && <p className="text-xs text-dim">{apply.error.message}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="micro-label">Touche une carte</span>
        <Button variant="outline" size="sm" onClick={() => cards.refetch()} disabled={dealing || apply.isPending}>
          <RotateCw className={cn(dealing && "animate-spin motion-reduce:animate-none")} />
          Autres cartes
        </Button>
      </div>
    </div>
  );
}
