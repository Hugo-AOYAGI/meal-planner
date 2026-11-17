import { Dices, Flag, Smartphone } from "lucide-react";
import type { GameView } from "@shared/schemas";
import { Button } from "@/components/ui/actions/button";
import { cn } from "@/lib/formatting/utils";
import { GameCardTile } from "../cards/GameCardTile";
import type { GameSession } from "../use-game-session";

/** While alone: who may still join, or playing on the same phone. */
function AloneHint({ session, view }: { session: GameSession; view: GameView }) {
  const { identity } = session;
  const others = identity.members.filter((m) => !view.players.some((p) => p.id === m.id));
  if (!others.length)
    return <p className="text-xs text-dim">À deux ? L’autre touche « Tirer » sur son téléphone pour rejoindre.</p>;
  const names = others.map((m) => m.name).join(" ou ");
  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 text-xs font-semibold text-dim">{names} peut rejoindre depuis son téléphone, ou :</p>
      {others.map((member) => (
        <Button key={member.id} variant="secondary" size="sm" className="shrink-0" onClick={() => session.playTogether(member.id)}>
          <Smartphone />
          {others.length > 1 ? `Avec ${member.name} ici` : "À deux ici"}
        </Button>
      ))}
    </div>
  );
}

/** The secret round: pick about as many cards as there are slots to fill (more is allowed), then say you are ready. */
export function HandScreen({ session, view }: { session: GameSession; view: GameView }) {
  const alone = view.players.length === 1;
  const ready = !!view.players.find((p) => p.id === view.me)?.ready;
  const picked = view.myPicks.length;
  /** more picks than empty slots: allowed, the extra matches go to the reserve */
  const over = picked > view.toPick;
  const toggle = (card: string) => session.act({ type: "pick", card });

  if (!view.hand.length)
    return (
      <div className="flex flex-col gap-3">
        <p className="font-bold">
          {view.slots.length
            ? "Plus rien à proposer pour ces jours et ces filtres."
            : "Tout est déjà prévu sur ces jours : allonge la durée ou ajoute un moment."}
        </p>
        {view.round > 1 && (
          <Button onClick={() => session.act({ type: "finish" })}>Finir avec ce qu’on a</Button>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold">
          {view.toPick > 1 ? `Choisis ${view.toPick} plats` : "Choisis 1 plat"}
          {!alone && <span className="font-semibold text-dim"> · en secret</span>}
          <span className="block text-xs font-semibold text-dim">
            {over ? "En trop : ils iront dans les envies communes" : view.round > 1 ? `Manche ${view.round} · ${view.needed} repas à trouver` : "Plus si tu veux, le surplus est gardé"}
          </span>
        </p>
        <span
          className={cn("display text-2xl tabular-nums transition-colors", over && "text-brand-text")}
          aria-label={`${picked} sur ${view.toPick}`}
        >
          {picked} / {view.toPick}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-0.5">
        {view.hand.map((card) => (
          <GameCardTile key={card.id} card={card} picked={view.myPicks.includes(card.id)} onToggle={() => toggle(card.id)} />
        ))}
      </div>
      {alone && view.round === 1 && <AloneHint session={session} view={view} />}
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-11 min-w-28 flex-1 text-base sm:flex-none"
          variant={ready ? "secondary" : "default"}
          disabled={!picked || session.busy}
          onClick={() => session.act({ type: "ready", ready: !ready })}
        >
          {alone ? "Valider" : ready ? "Prêt ✓ · Modifier" : "Prêt"}
        </Button>
        <Button variant="outline" className="h-11" disabled={session.busy} onClick={() => session.act({ type: "reroll" })}>
          <Dices />
          Relancer
        </Button>
        {view.round > 1 && (
          <Button variant="ghost" className="h-11" disabled={session.busy} onClick={() => session.act({ type: "finish" })}>
            <Flag />
            Finir
          </Button>
        )}
      </div>
    </div>
  );
}
