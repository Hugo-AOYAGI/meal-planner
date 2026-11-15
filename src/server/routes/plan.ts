import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  applySuggestionsSchema,
  dayRangeSchema,
  setSlotInputSchema,
  settingsUpdateSchema,
  suggestionInputSchema,
  weekQuerySchema,
} from "@shared/schemas";
import { applySuggestions, suggestMeals } from "../services/planning/draw";
import { getDays, getWeek, setSlot } from "../services/planning/plan";
import { getSettings, updateSettings } from "../services/support/settings";

export const planRoute = new Hono()
  .get("/", zValidator("query", weekQuerySchema), (c) => c.json(getWeek(c.req.valid("query").week)))
  .get("/days", zValidator("query", dayRangeSchema), (c) => {
    const { from, days } = c.req.valid("query");
    return c.json(getDays(from, days));
  })
  .put("/slot", zValidator("json", setSlotInputSchema), (c) => c.json(setSlot(c.req.valid("json"))))
  .post("/suggestions", zValidator("json", suggestionInputSchema), (c) => c.json(suggestMeals(c.req.valid("json"))))
  .post("/apply-suggestions", zValidator("json", applySuggestionsSchema), (c) => {
    applySuggestions(c.req.valid("json").slots);
    return c.json({ ok: true });
  });

export const settingsRoute = new Hono()
  .get("/", (c) => c.json(getSettings()))
  .patch("/", zValidator("json", settingsUpdateSchema), (c) => c.json(updateSettings(c.req.valid("json"))));
