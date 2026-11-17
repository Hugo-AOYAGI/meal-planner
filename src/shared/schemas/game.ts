import { z } from "zod";
import { dateSchema, idSchema, momentSchema } from "./common";
import { drawStatusSchema, suggestionSchema } from "./planning";

/** A household member taking part, by `Member.id` (see settings). */
export const playerIdSchema = z.string().min(1).max(40);

/** A card of the hand: one main (a dish, or a protein with its starch and vegetable). */
export const gameCardSchema = z.object({
  /** unique within the game */
  id: z.string(),
  meals: z.array(z.object({ id: idSchema, name: z.string() })).min(1),
  /** minutes of the longest part's default recipe; null when one part has no duration */
  durationMin: z.number().int().nullable(),
  /** `new`: a dish never made yet; `reserve`: a past match both wanted but that had no slot ("envie commune") */
  tag: z.enum(["new", "reserve"]).nullable(),
});
export type GameCard = z.infer<typeof gameCardSchema>;

/** `plan`: fill the coming days. `quick`: one fast meal for tonight. */
export const gameModeSchema = z.enum(["plan", "quick"]);
export type GameMode = z.infer<typeof gameModeSchema>;

export const gameOptionsSchema = z.object({
  /** first day considered */
  from: dateSchema,
  days: z.number().int().min(1).max(7),
  moments: z.array(momentSchema).min(1),
  status: drawStatusSchema,
});
export type GameOptions = z.infer<typeof gameOptionsSchema>;

/**
 * `picking`: everyone picks secretly, then says they are ready. `catchup`: each answers yes/no to the other's
 * unmatched picks. `placing`: the matches sit in the slots and can be reordered before validating. `done`: written.
 */
export const gamePhaseSchema = z.enum(["picking", "catchup", "placing", "done"]);
export type GamePhase = z.infer<typeof gamePhaseSchema>;

const slotRefSchema = z.object({ date: dateSchema, moment: momentSchema });

/** The game as one player sees it: the other's choices stay hidden until the reveal. */
export const gameViewSchema = z.object({
  id: z.string(),
  mode: gameModeSchema,
  phase: gamePhaseSchema,
  /** 1 for the first hand; each mini-hand for the slots still empty adds one */
  round: z.number().int(),
  options: gameOptionsSchema,
  /** the player this view is for */
  me: playerIdSchema,
  players: z.array(z.object({ id: playerIdSchema, ready: z.boolean(), picked: z.number().int() })),
  /** slots this game fills, in order: only those that need a meal */
  slots: z.array(slotRefSchema),
  /** slots still without a match */
  needed: z.number().int(),
  /** cards each player picks this round (a hand fits a screen: big plans take several rounds) */
  toPick: z.number().int(),
  hand: z.array(gameCardSchema),
  myPicks: z.array(z.string()),
  /** catch-up: the other's unmatched picks, for me to accept or refuse; my answers so far */
  toAnswer: z.array(gameCardSchema),
  myAnswers: z.record(z.string(), z.boolean()),
  /** cards both said yes to, so far */
  matches: z.array(gameCardSchema),
  /** ids of the matches made by the last reveal or catch-up, to celebrate them */
  fresh: z.array(z.string()),
  /** placing: which match goes in which slot */
  placement: z.array(slotRefSchema.extend({ card: gameCardSchema })),
  /** the library had nothing more to deal */
  exhausted: z.boolean(),
});
export type GameView = z.infer<typeof gameViewSchema>;

export const gameStartSchema = z.object({
  player: playerIdSchema,
  mode: gameModeSchema.default("plan"),
  options: gameOptionsSchema.partial().optional(),
});
export type GameStart = z.infer<typeof gameStartSchema>;

/** Everything a player can do once the game runs. */
export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join") }),
  z.object({ type: z.literal("pick"), card: z.string() }),
  z.object({ type: z.literal("ready"), ready: z.boolean() }),
  z.object({ type: z.literal("answer"), card: z.string(), yes: z.boolean() }),
  z.object({ type: z.literal("options"), options: gameOptionsSchema.omit({ from: true }).partial() }),
  /** a whole new hand for this round */
  z.object({ type: z.literal("reroll") }),
  /** stop dealing mini-hands and place what matched */
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("swap"), a: z.string(), b: z.string() }),
  z.object({ type: z.literal("validate") }),
  z.object({ type: z.literal("abandon") }),
]);
export type GameAction = z.infer<typeof gameActionSchema>;
export const gameActInputSchema = z.object({ player: playerIdSchema, action: gameActionSchema });

/** The dice on one slot: a few proposals to pick from, ready to apply. */
export const slotCardsInputSchema = slotRefSchema.extend({ count: z.number().int().min(1).max(5).default(3) });
export const slotCardSchema = z.object({ suggestion: suggestionSchema, tag: z.enum(["reserve"]).nullable() });
export type SlotCard = z.infer<typeof slotCardSchema>;
