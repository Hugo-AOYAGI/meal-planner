import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { gameActInputSchema, gameStartSchema, playerIdSchema, slotCardsInputSchema } from "@shared/schemas";
import { emitChanged } from "../events";
import { act, startGame } from "../services/game/rules";
import { slotCards } from "../services/game/deal";
import { currentGame } from "../services/game/store";
import { viewFor } from "../services/game/view";

/** The draw game: one at a time for the household, seen by each player through `viewFor`. */
export const gameRoute = new Hono()
  .get("/", zValidator("query", z.object({ player: playerIdSchema })), (c) => {
    const game = currentGame();
    return c.json(game ? viewFor(game, c.req.valid("query").player) : null);
  })
  .post("/start", zValidator("json", gameStartSchema), (c) => {
    const input = c.req.valid("json");
    return c.json(viewFor(startGame(input), input.player));
  })
  .post("/act", zValidator("json", gameActInputSchema), (c) => {
    const { player, action } = c.req.valid("json");
    const game = act(player, action);
    if (action.type === "validate") emitChanged(c.req.header("x-client-id")); // the plan changed
    return c.json(game ? viewFor(game, player) : null);
  })
  /** the dice on one slot: a few proposals to pick from (nothing is written) */
  .post("/slot-cards", zValidator("json", slotCardsInputSchema), (c) => {
    const { date, moment, count } = c.req.valid("json");
    return c.json(slotCards(date, moment, count));
  });
