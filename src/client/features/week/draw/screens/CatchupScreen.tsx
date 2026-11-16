import { Flag } from "lucide-react";
import type { GameView } from "@shared/schemas";
import { Button } from "@/components/ui/actions/button";
import { cn } from "@/lib/formatting/utils";
import { GameCardTile, cardName } from "../cards/GameCardTile";
import type { GameSession } from "../use-game-session";

const answerButton = "min-h-11 flex-1 rounded-lg text-sm font-extrabold focus-visible:outline-2";

/** The matches so far, as small chips. */
export function MatchList({ view }: { view: GameView }) {
  if (!view.matches.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="micro-label">💥 {view.matches.length === 1 ? "Votre match" : "Vos matchs"}</span>
      <ul className="flex flex-wrap gap-1.5">
        {view.matches.map((card) => (
          <li key={card.id} className="rounded-full bg-subtle px-3 py-1 text-sm font-bold">
            {cardName(card)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Catch-up: yes or no to each of the other's picks that did not match. A yes is a match. */
export function CatchupScreen({ session, view }: { session: GameSession; view: GameView }) {
  const other = view.players.find((p) => p.id !== view.me);
  const otherName = other ? session.identity.memberOf(other.id).name : "l’autre";
  const done = view.toAnswer.every((card) => card.id in view.myAnswers);
  const answer = (card: string, yes: boolean) => session.act({ type: "answer", card, yes });

  return (
    <div className="flex flex-col gap-4">
      <MatchList view={view} />
      {view.toAnswer.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-bold">Les choix de {otherName} : d’accord ?</p>
          <div className="grid max-h-[46dvh] grid-cols-2 gap-2 overflow-y-auto p-1">
            {view.toAnswer.map((card) => {
              const said = view.myAnswers[card.id];
              return (
                <GameCardTile key={card.id} card={card}>
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      aria-pressed={said === true}
                      onClick={() => answer(card.id, true)}
                      className={cn(answerButton, said === true ? "bg-foreground text-background" : "bg-white/70")}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      aria-pressed={said === false}
                      onClick={() => answer(card.id, false)}
                      className={cn(answerButton, said === false ? "bg-foreground text-background" : "bg-white/70")}
                    >
                      Non
                    </button>
                  </span>
                </GameCardTile>
              );
            })}
          </div>
        </div>
      )}
      {done && (
        <p className="rounded-xl bg-foreground px-4 py-3 text-center font-bold text-background">
          ⏳ {otherName} répond à tes choix…
        </p>
      )}
      {view.round > 1 && (
        <Button variant="ghost" className="h-11 self-start" disabled={session.busy} onClick={() => session.act({ type: "finish" })}>
          <Flag />
          Finir avec ce qu’on a
        </Button>
      )}
    </div>
  );
}
