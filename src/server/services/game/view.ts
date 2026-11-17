import type { GameView } from "@shared/schemas";
import { slotKey } from "./deal";
import { needed, toAnswer, toPick } from "./rules";
import type { Game } from "./store";

/** What `player` may see of the game: their own picks and answers, only counts of the other's before the reveal. */
export function viewFor(game: Game, player: string): GameView {
  const byId = new Map([...game.hand, ...game.matches].map((c) => [c.id, c]));
  return {
    id: game.id,
    mode: game.mode,
    phase: game.phase,
    round: game.round,
    options: game.options,
    me: player,
    players: game.players.map((id) => ({ id, ready: !!game.ready[id], picked: game.picks[id]?.length ?? 0 })),
    slots: game.slots.map(({ date, moment }) => ({ date, moment })),
    needed: needed(game),
    toPick: game.phase === "picking" ? toPick(game) : 0,
    hand: game.hand,
    myPicks: game.picks[player] ?? [],
    toAnswer: game.phase === "catchup" ? toAnswer(game, player) : [],
    myAnswers: game.answers[player] ?? {},
    matches: game.matches,
    fresh: game.fresh,
    placement: game.slots.flatMap(({ date, moment }) => {
      const card = byId.get(game.placement[slotKey({ date, moment })] ?? "");
      return card ? [{ date, moment, card }] : [];
    }),
    exhausted: game.exhausted,
  };
}
