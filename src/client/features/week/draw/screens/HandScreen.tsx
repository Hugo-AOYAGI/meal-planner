import { Dices, Flag, Smartphone } from "lucide-react";
import type { GameView } from "@shared/schemas";
import { Button } from "@/components/ui/actions/button";
import { GameCardTile } from "../cards/GameCardTile";
import type { GameSession } from "../use-game-session";

/** While alone: who may still join, playing on the same phone, or a hint to declare members. */
function AloneHint({ session, view }: { session: GameSession; view: GameView }) {
  const { identity } = session;
  if (identity.noMembers)
    return <p className="text-xs text-dim">Pour jouer à deux, ajoutez les membres du foyer dans Foyer.</p>;
  const others = identity.members.filter((m) => !view.players.some((p) => p.id === m.id));
  if (!others.length) return null;
  const names = others.map((m) => m.name).join(" ou ");
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-subtle p-3">
      <p className="text-sm font-bold">
        En attente de {names}… <span className="font-semibold text-dim">ou valide seul.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {others.map((member) => (
          <Button key={member.id} variant="secondary" size="sm" className="bg-background" onClick={() => session.playTogether(member.id)}>
            <Smartphone />
            {others.length > 1 ? `Avec ${member.name} sur ce téléphone` : "À deux sur ce téléphone"}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** The secret round: pick as many cards as there are slots to fill, then say you are ready. */
export function HandScreen({ session, view }: { session: GameSession; view: GameView }) {
  const alone = view.players.length === 1;
  const ready = !!view.players.find((p) => p.id === view.me)?.ready;
  const picked = view.myPicks.length;
  const toggle = (card: string) => session.act({ type: "pick", card });

  if (!view.hand.length)
    return (
      <div className="flex flex-col gap-3">
        <p className="font-bold">Plus rien à proposer pour ces jours et ces filtres.</p>
        {view.round > 1 && (
          <Button onClick={() => session.act({ type: "finish" })}>Finir avec ce qu’on a</Button>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold">
          {view.round > 1 ? "Encore " : "Choisis "}
          {view.needed} {view.needed === 1 ? "plat" : "plats"}
          {!alone && <span className="font-semibold text-dim"> · en secret</span>}
        </p>
        <span className="display text-2xl tabular-nums" aria-label={`${picked} sur ${view.needed}`}>
          {picked} / {view.needed}
        </span>
      </div>
      <div className="grid max-h-[42dvh] grid-cols-2 gap-2 overflow-y-auto p-1 md:max-h-[52vh]">
        {view.hand.map((card) => (
          <GameCardTile key={card.id} card={card} picked={view.myPicks.includes(card.id)} onToggle={() => toggle(card.id)} />
        ))}
      </div>
      {alone && <AloneHint session={session} view={view} />}
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
          Tout relancer
        </Button>
        {view.round > 1 && (
          <Button variant="ghost" className="h-11" disabled={session.busy} onClick={() => session.act({ type: "finish" })}>
            <Flag />
            Finir avec ce qu’on a
          </Button>
        )}
      </div>
    </div>
  );
}
