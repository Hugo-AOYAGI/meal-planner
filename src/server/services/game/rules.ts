import { today } from "@shared/dates";
import type { GameAction, GameCard, GameOptions, GameStart } from "@shared/schemas";
import type { Random } from "../calc/draw";
import { AppError } from "../support/errors";
import { getSettings } from "../support/settings";
import { dealCards, handSize, picksPerRound, slotKey, slotsFor } from "./deal";
import { refuse, validate } from "./finish";
import { addToReserve, currentGame, setGame, type Game } from "./store";

const mealIdsOf = (cards: GameCard[]) => cards.flatMap((c) => c.meals.map((m) => m.id));
export const needed = (game: Game) => Math.max(0, game.slots.length - game.matches.length);
/** How many cards each player picks this round. */
export const toPick = (game: Game) => picksPerRound(needed(game));
const roundHand = (game: Game) => handSize(game.mode, toPick(game));
const cardsById = (game: Game, ids: string[]) => game.hand.filter((c) => ids.includes(c.id));

function deal(game: Game, count: number): GameCard[] {
  const exclude = [...mealIdsOf(game.hand), ...mealIdsOf(game.matches), ...game.refused, ...game.skipped];
  return dealCards({ mode: game.mode, options: game.options, count, exclude, nextId: () => `c${++game.seq}`, random: game.random });
}

/** The other player's picks that did not match: what `player` answers in catch-up. */
export function toAnswer(game: Game, player: string): GameCard[] {
  const other = game.players.find((p) => p !== player);
  const matched = new Set(game.matches.map((c) => c.id));
  return other ? cardsById(game, game.picks[other] ?? []).filter((c) => !matched.has(c.id)) : [];
}

/** Starts the household's game, or returns the one running (joining it). */
/** Once the household has declared its members, only they play. */
function checkPlayer(player: string): void {
  const members = getSettings().members;
  if (members.length && !members.some((m) => m.id === player)) throw new AppError("Joueur inconnu : choisissez qui joue.", 409);
}

export function startGame({ player, mode, options }: GameStart, random: Random = Math.random): Game {
  checkPlayer(player);
  const running = currentGame();
  if (running && running.phase !== "done") {
    if (!running.players.includes(player)) join(running, player);
    setGame(running);
    return running;
  }
  const moments = getSettings().drawMoments;
  const full: GameOptions = {
    from: today(),
    days: mode === "quick" ? 1 : 7,
    moments: mode === "quick" ? ["soir"] : moments.length ? moments : ["soir"],
    status: "all",
    ...options,
  };
  if (full.from < today()) full.from = today();
  const game: Game = {
    id: crypto.randomUUID(), mode, options: full, players: [player], phase: "picking", round: 1,
    slots: slotsFor(mode, full), hand: [], picks: { [player]: [] }, ready: {}, answers: {}, matches: [], fresh: [],
    revertible: null, refused: [], skipped: [], placement: {}, exhausted: false, touched: Date.now(), seq: 0, random,
  };
  game.hand = deal(game, roundHand(game));
  game.exhausted = !game.hand.length;
  setGame(game);
  return game;
}

function join(game: Game, player: string): void {
  if (game.players.includes(player)) return;
  if (game.players.length >= 2) throw new AppError("La partie a déjà deux joueurs.", 409);
  if (game.phase === "placing" && game.revertible) {
    // the starter had validated alone: back to picking, their picks become their secret picks
    const [starter] = game.players as [string];
    game.matches = game.matches.slice(0, game.revertible.matchesBefore);
    game.picks[starter] = game.revertible.picks;
    game.ready[starter] = true;
    game.placement = {};
    game.phase = "picking";
    game.revertible = null;
  } else if (game.phase !== "picking") throw new AppError("La partie est trop avancée pour la rejoindre.", 409);
  game.players.push(player);
  game.picks[player] = [];
  game.ready[player] = false;
}

function toPlacing(game: Game): void {
  const overflow = game.matches.slice(game.slots.length);
  if (overflow.length) addToReserve(overflow);
  game.matches = game.matches.slice(0, game.slots.length);
  game.placement = Object.fromEntries(game.matches.map((card, i) => [slotKey(game.slots[i]!), card.id]));
  game.phase = "placing";
}

/** A new round for the slots still empty: a mini-hand without the cards just refused or skipped. */
function nextRound(game: Game): void {
  // the last hand is left out of this one (matched and refused cards are left out for good)
  game.skipped = mealIdsOf(game.hand);
  game.round++;
  game.hand = [];
  game.hand = deal(game, roundHand(game));
  game.skipped = [];
  for (const p of game.players) {
    game.picks[p] = [];
    game.ready[p] = false;
  }
  game.answers = {};
  if (!game.hand.length) {
    game.exhausted = true;
    toPlacing(game);
  } else game.phase = "picking";
}

const afterRound = (game: Game) => (needed(game) === 0 ? toPlacing(game) : nextRound(game));

function resolvePicks(game: Game): void {
  game.fresh = [];
  if (game.players.length === 1) {
    const [solo] = game.players as [string];
    const revertible = { matchesBefore: game.matches.length, picks: game.picks[solo]! };
    game.matches.push(...cardsById(game, game.picks[solo]!));
    afterRound(game);
    game.revertible = game.phase === "placing" ? revertible : null;
    return;
  }
  const [a, b] = game.players.map((p) => game.picks[p] ?? []) as [string[], string[]];
  const common = cardsById(game, a.filter((id) => b.includes(id)));
  game.matches.push(...common);
  game.fresh = common.map((c) => c.id);
  const pending = game.players.some((p) => toAnswer(game, p).length);
  if (needed(game) > 0 && pending) {
    game.phase = "catchup";
    game.answers = Object.fromEntries(game.players.map((p) => [p, {}]));
  } else afterRound(game);
}

function resolveCatchup(game: Game): void {
  for (const player of game.players) {
    for (const card of toAnswer(game, player)) {
      if (game.answers[player]?.[card.id]) {
        game.matches.push(card);
        game.fresh.push(card.id);
      } else refuse(game, card);
    }
  }
  afterRound(game);
}

function changeOptions(game: Game, change: Extract<GameAction, { type: "options" }>["options"]): void {
  if (game.mode === "quick") throw new AppError("Le tirage rapide porte sur un seul repas.");
  const statusChanged = change.status !== undefined && change.status !== game.options.status;
  game.options = { ...game.options, ...change };
  game.slots = slotsFor(game.mode, game.options);
  if (game.matches.length > game.slots.length) {
    addToReserve(game.matches.slice(game.slots.length));
    game.matches = game.matches.slice(0, game.slots.length);
  }
  if (game.phase !== "picking") return void (needed(game) ? nextRound(game) : toPlacing(game));
  const n = toPick(game);
  const picked = new Set(Object.values(game.picks).flat());
  if (statusChanged) game.hand = game.hand.filter((c) => picked.has(c.id));
  const target = roundHand(game);
  if (game.hand.length < target) game.hand.push(...deal(game, target - game.hand.length));
  while (game.hand.length > target) {
    const spare = game.hand.findLastIndex((c) => !picked.has(c.id));
    if (spare < 0) break;
    game.hand.splice(spare, 1);
  }
  for (const p of game.players) {
    game.picks[p] = (game.picks[p] ?? []).filter((id) => game.hand.some((c) => c.id === id)).slice(0, n);
    game.ready[p] = false;
  }
  if (n === 0) toPlacing(game);
}

function expect(game: Game, ...phases: Game["phase"][]): void {
  if (!phases.includes(game.phase)) throw new AppError("Cette action n’est plus possible à ce stade.", 409);
}

/** Applies one player's action to the running game. */
export function act(player: string, action: GameAction): Game | null {
  const game = currentGame();
  if (!game) throw new AppError("Aucun tirage en cours.", 404);
  checkPlayer(player);
  if (action.type === "join") join(game, player);
  else if (!game.players.includes(player)) throw new AppError("Rejoignez d’abord le tirage.", 409);
  switch (action.type) {
    case "pick": {
      expect(game, "picking");
      if (!game.hand.some((c) => c.id === action.card)) throw new AppError("Carte inconnue.");
      const picks = game.picks[player]!;
      const n = toPick(game);
      if (picks.includes(action.card)) picks.splice(picks.indexOf(action.card), 1);
      else if (picks.length < n) picks.push(action.card);
      else if (n === 1) picks.splice(0, 1, action.card);
      else throw new AppError(`Déjà ${n} choix : retirez-en un d’abord.`);
      game.ready[player] = false;
      break;
    }
    case "ready":
      expect(game, "picking");
      if (action.ready && !game.picks[player]!.length && game.hand.length) throw new AppError("Choisissez au moins un plat.");
      game.ready[player] = action.ready;
      if (game.players.every((p) => game.ready[p])) resolvePicks(game);
      break;
    case "answer":
      expect(game, "catchup");
      if (!toAnswer(game, player).some((c) => c.id === action.card)) throw new AppError("Carte inconnue.");
      game.answers[player] = { ...game.answers[player], [action.card]: action.yes };
      if (game.players.every((p) => toAnswer(game, p).every((c) => c.id in (game.answers[p] ?? {})))) resolveCatchup(game);
      break;
    case "options":
      expect(game, "picking", "catchup", "placing");
      changeOptions(game, action.options);
      break;
    case "reroll":
      expect(game, "picking");
      game.skipped = mealIdsOf(game.hand);
      game.hand = [];
      game.hand = deal(game, roundHand(game));
      game.skipped = [];
      for (const p of game.players) {
        game.picks[p] = [];
        game.ready[p] = false;
      }
      break;
    case "finish":
      expect(game, "picking", "catchup");
      toPlacing(game);
      break;
    case "swap": {
      expect(game, "placing");
      const { a, b } = action;
      const [ca, cb] = [game.placement[a], game.placement[b]];
      if (!game.slots.some((s) => slotKey(s) === b) || !ca) throw new AppError("Créneau inconnu.");
      game.placement[b] = ca;
      if (cb) game.placement[a] = cb;
      else delete game.placement[a];
      break;
    }
    case "validate":
      expect(game, "placing");
      validate(game);
      break;
    case "abandon":
      setGame(null);
      return null;
  }
  setGame(game);
  return game;
}
