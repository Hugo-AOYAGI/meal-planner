import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  ciqualSearchQuerySchema,
  idSchema,
  ingredientInputSchema,
  ingredientSearchQuerySchema,
  ingredientUpdateSchema,
} from "@shared/schemas";
import { getCiqualFood, searchCiqual } from "../../services/catalog/ciqual";
import { createIngredient, getIngredient, searchIngredients, updateIngredient } from "../../services/catalog/ingredients";

const idParam = z.object({ id: z.coerce.number().pipe(idSchema) });

export const ingredientsRoute = new Hono()
  .get("/", zValidator("query", ingredientSearchQuerySchema), (c) => c.json(searchIngredients(c.req.valid("query"))))
  .post("/", zValidator("json", ingredientInputSchema), (c) => c.json(createIngredient(c.req.valid("json")), 201))
  .get("/:id", zValidator("param", idParam), (c) => c.json(getIngredient(c.req.valid("param").id)))
  .patch("/:id", zValidator("param", idParam), zValidator("json", ingredientUpdateSchema), (c) =>
    c.json(updateIngredient(c.req.valid("param").id, c.req.valid("json"))),
  );

export const ciqualRoute = new Hono()
  .get("/", zValidator("query", ciqualSearchQuerySchema), (c) => c.json(searchCiqual(c.req.valid("query"))))
  .get("/:code", zValidator("param", z.object({ code: z.string() })), (c) => c.json(getCiqualFood(c.req.valid("param").code)));
