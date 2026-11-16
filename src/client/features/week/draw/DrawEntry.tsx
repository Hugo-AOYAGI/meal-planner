import { Dices, Moon, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/actions/button";
import type { GameSession } from "./use-game-session";

/** The planning's two ways in: "Tirer" (the coming days) and "Ce soir" (one quick meal). */
export function DrawButtons({ session }: { session: GameSession }) {
  return (
    <>
      <Button variant="outline" size="sm" aria-label="Un repas rapide pour ce soir" onClick={() => session.launch("quick")}>
        <Moon />
        <span className="max-sm:hidden">Ce soir</span>
      </Button>
      <Button size="sm" onClick={() => session.launch("plan")}>
        <Dices />
        Tirer
      </Button>
    </>
  );
}

/**
 * Shown on the planning while the sheet is closed: someone else started a game this device can join,
 * or this device's game is still running.
 */
export function JoinBanner({ session }: { session: GameSession }) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const game = session.running;
  const me = session.identity.me?.id;
  if (session.open || !game || game.phase === "done" || dismissed === game.id) return null;
  const playing = !!me && game.players.some((p) => p.id === me);
  const joinable = !playing && game.players.length < 2 && (game.phase === "picking" || game.phase === "placing");
  if (!playing && !joinable) return null;

  const starter = session.identity.memberOf(game.players[0]!.id).name;
  const what = game.mode === "quick" ? "un repas rapide" : "un tirage";
  return (
    <div
      role="status"
      className="mt-1 mb-2 flex items-center gap-2 rounded-xl bg-[var(--sun)] py-1.5 pr-1.5 pl-4 duration-200 animate-in fade-in-0 slide-in-from-top-2"
    >
      <span className="min-w-0 flex-1 text-sm font-bold">
        🎲 {playing ? "Tirage en cours" : `${starter} a lancé ${what}`}
      </span>
      <Button size="sm" onClick={() => session.launch(game.mode)}>
        {playing ? "Reprendre" : "Rejoindre"}
      </Button>
      <button
        type="button"
        aria-label="Masquer"
        onClick={() => setDismissed(game.id)}
        className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-black/5 focus-visible:outline-2"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
