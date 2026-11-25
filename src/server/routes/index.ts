import { Hono } from "hono";
import { AppError } from "../services/support/errors";
import { fridgeRoute, pushRoute } from "./fridge";
import { gameRoute } from "./game";
import { ciqualRoute, ingredientsRoute } from "./resources/ingredients";
import { mealsRoute } from "./resources/meals";
import { preferencesRoute } from "./resources/preferences";
import { planRoute, settingsRoute } from "./plan";
import { recipesRoute } from "./resources/recipes";
import { shoppingRoute } from "./shopping";

/** JSON API under /api. Chained so `ApiType` carries every route for the typed `hc` client. */
export const api = new Hono()
  .route("/meals", mealsRoute)
  .route("/recipes", recipesRoute)
  .route("/preferences", preferencesRoute)
  .route("/ingredients", ingredientsRoute)
  .route("/ciqual", ciqualRoute)
  .route("/plan", planRoute)
  .route("/settings", settingsRoute)
  .route("/game", gameRoute)
  .route("/shopping", shoppingRoute)
  .route("/fridge", fridgeRoute)
  .route("/push", pushRoute);

api.onError((err, c) => {
  if (err instanceof AppError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Erreur interne" }, 500);
});

export type ApiType = typeof api;
