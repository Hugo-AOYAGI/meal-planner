import { useEffect, useState } from "react";
import type { GameCard, GameView } from "@shared/schemas";
import { cardName, colorOf } from "../cards/GameCardTile";

const SHOWN_MS = 2200;
/** `${game}:${card}` of the matches already celebrated on this page, so reopening the sheet does not replay them. */
const celebrated = new Set<string>();

/**
 * "💥 Match !": pops over the sheet when a reveal or a catch-up makes new matches, then fades by itself (or on tap).
 * The pop is a short CSS animation, cut by `prefers-reduced-motion` (see index.css).
 */
export function MatchBurst({ view }: { view: GameView }) {
  const [cards, setCards] = useState<GameCard[]>([]);

  useEffect(() => {
    if (view.phase === "done") return;
    const fresh = view.matches.filter((c) => view.fresh.includes(c.id) && !celebrated.has(`${view.id}:${c.id}`));
    if (!fresh.length) return;
    for (const card of fresh) celebrated.add(`${view.id}:${card.id}`);
    setCards(fresh);
  }, [view]);

  useEffect(() => {
    if (!cards.length) return;
    const timer = setTimeout(() => setCards([]), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [cards]);

  if (!cards.length) return null;
  return (
    <button
      type="button"
      onClick={() => setCards([])}
      aria-live="polite"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[inherit] bg-background/95 p-6 duration-200 animate-in fade-in-0"
    >
      <span className="display text-5xl duration-300 animate-in zoom-in-50 spin-in-6">💥 Match !</span>
      <ul className="flex flex-col items-center gap-2">
        {cards.map((card, i) => (
          <li
            key={card.id}
            className="rounded-xl px-4 py-2 text-lg font-extrabold duration-300 animate-in fill-mode-both slide-in-from-bottom-4 fade-in-0"
            style={{ backgroundColor: colorOf(card), animationDelay: `${150 + i * 90}ms` }}
          >
            {cardName(card)}
          </li>
        ))}
      </ul>
      <span className="text-sm text-dim">Vous êtes d’accord tous les deux</span>
    </button>
  );
}
