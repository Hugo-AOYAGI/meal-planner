import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { GameCard } from "@shared/schemas";
import { cn } from "@/lib/formatting/utils";

const COLORS = ["var(--sun)", "var(--tomato)", "var(--leaf)", "var(--sky)", "var(--lilac)", "var(--rose)"];
/** A card keeps its colour wherever it is shown: it follows its first meal. */
export const colorOf = (card: GameCard) => COLORS[card.meals[0]!.id % COLORS.length];

/** "Curry coco + Riz + Brocoli" */
export const cardName = (card: GameCard) => card.meals.map((meal) => meal.name).join(" + ");

/** Duration and tag of a card, as small text. */
export function CardMeta({ card }: { card: GameCard }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-dim">
      {card.durationMin !== null && <span>{card.durationMin} min</span>}
      {card.tag === "new" && <span className="rounded-full bg-white/70 px-2 py-0.5 text-foreground">✨ Nouveau</span>}
      {card.tag === "reserve" && <span className="rounded-full bg-white/70 px-2 py-0.5 text-foreground">💛 Envie commune</span>}
    </span>
  );
}

interface GameCardTileProps {
  card: GameCard;
  /** picked: outlined and ticked */
  picked?: boolean;
  /** makes the card a toggle button */
  onToggle?: () => void;
  className?: string;
  children?: ReactNode;
}

/** A card of the hand: a block of colour with the dish, its duration and its badge. */
export function GameCardTile({ card, picked = false, onToggle, className, children }: GameCardTileProps) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-[15px] leading-tight font-extrabold text-balance">{cardName(card)}</span>
        {picked && (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-background">
            <Check className="size-4" />
          </span>
        )}
      </span>
      <CardMeta card={card} />
      {children}
    </>
  );
  const style = { backgroundColor: colorOf(card) };
  const base = cn(
    "flex min-h-[4.5rem] flex-col justify-between gap-1 rounded-xl px-3 py-2.5 text-left transition-[outline-color,transform]",
    picked ? "outline-3 outline-foreground" : "outline-3 outline-transparent",
    className,
  );
  if (!onToggle) return <div className={base} style={style}>{body}</div>;
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onToggle}
      className={cn(base, "outline-offset-0 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]")}
      style={style}
    >
      {body}
    </button>
  );
}
