import { eq } from "drizzle-orm";
import { today } from "@shared/dates";
import type { GameCard, GameMode, GameOptions, GamePhase } from "@shared/schemas";
import { db } from "../../db";
import { setting } from "../../db/schema";
import type { Random } from "../calc/draw";
import { getSettings } from "../support/settings";
import type { GameSlot } from "./deal";

/** A game in progress. It lives in memory only: a server restart ends it. */
export interface Game {
  id: string;
  mode: GameMode;
  options: GameOptions;
  /** the starter first */
  players: string[];
  phase: GamePhase;
  round: number;
  slots: GameSlot[];
  hand: GameCard[];
  picks: Record<string, string[]>;
  ready: Record<string, boolean>;
  /** catch-up answers: player -> card id -> yes */
  answers: Record<string, Record<string, boolean>>;
  matches: GameCard[];
  fresh: string[];
  /** a solo round went straight to placing: a player who joins now sends the game back to picking */
  revertible: { matchesBefore: number; picks: string[] } | null;
  /** meals refused in catch-up, never dealt again in this game */
  refused: number[];
  /** meals nobody picked last round, left out of the next hand only */
  skipped: number[];
  /** placing: slot key -> card id */
  placement: Record<string, string>;
  exhausted: boolean;
  touched: number;
  seq: number;
  random: Random;
}

const IDLE_MS = 30 * 60_000;
let current: Game | null = null;
const listeners = new Set<(gameId: string) => void>();

/** The household's game, unless it has been idle too long or a player is no longer a member. */
export function currentGame(): Game | null {
  if (current && Date.now() - current.touched > IDLE_MS) current = null;
  const members = getSettings().members;
  if (current && members.length && current.players.some((p) => !members.some((m) => m.id === p))) current = null;
  return current;
}

export function setGame(game: Game | null): void {
  current = game;
  if (game) game.touched = Date.now();
  for (const send of listeners) send(game?.id ?? "");
}

/** Called with the game id (empty when it ended) after every change; the SSE stream forwards it. */
export function onGameChange(listener: (gameId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------- the reserve and idea refusals, kept in the setting table ----------

export interface ReserveEntry {
  mealIds: number[];
  added: string;
}

const RESERVE_KEY = "draw-reserve";
const REFUSALS_KEY = "idea-refusals";
const RESERVE_MAX = 6;

function read<T>(key: string, fallback: T): T {
  const row = db.select().from(setting).where(eq(setting.key, key)).get();
  return (row?.value as T | undefined) ?? fallback;
}

function write(key: string, value: unknown): void {
  db.insert(setting).values({ key, value }).onConflictDoUpdate({ target: setting.key, set: { value } }).run();
}

/** "Envies communes": matches both players wanted that had no slot, oldest first. */
export const readReserve = (): ReserveEntry[] => read<ReserveEntry[]>(RESERVE_KEY, []);

const sameMain = (a: number[], b: number[]) => a[0] === b[0];

/** Adds cards to the reserve (a main already there is not added twice), keeping the newest `RESERVE_MAX`. */
export function addToReserve(cards: GameCard[]): void {
  const reserve = readReserve();
  for (const card of cards) {
    if (card.tag === "leftover") continue; // eaten from the fridge or not at all: not an "envie commune"
    const mealIds = card.meals.map((m) => m.id);
    if (!reserve.some((r) => sameMain(r.mealIds, mealIds))) reserve.push({ mealIds, added: today() });
  }
  write(RESERVE_KEY, reserve.slice(-RESERVE_MAX));
}

/** Drops the reserve entries whose main was just planned. */
export function removeFromReserve(mains: number[]): void {
  write(RESERVE_KEY, readReserve().filter((r) => !mains.includes(r.mealIds[0]!)));
}

/** Counts a refusal of an assistant idea; returns the new count. */
export function countIdeaRefusal(mealId: number): number {
  const refusals = read<Record<string, number>>(REFUSALS_KEY, {});
  refusals[mealId] = (refusals[mealId] ?? 0) + 1;
  write(REFUSALS_KEY, refusals);
  return refusals[mealId];
}
