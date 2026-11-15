import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { idSchema, recipeInputSchema, recipeQuerySchema, recipeUpdateSchema } from "@shared/schemas";
import { createRecipe, deleteRecipe, getRecipe, setDefaultRecipe, updateRecipe } from "../../services/catalog/recipes";

const idParam = z.object({ id: z.coerce.number().pipe(idSchema) });

export const recipesRoute = new Hono()
  .post("/", zValidator("json", recipeInputSchema), (c) => c.json(createRecipe(c.req.valid("json")), 201))
  .get("/:id", zValidator("param", idParam), zValidator("query", recipeQuerySchema), (c) =>
    c.json(getRecipe(c.req.valid("param").id, c.req.valid("query").servings)),
  )
  .put("/:id", zValidator("param", idParam), zValidator("json", recipeUpdateSchema), (c) =>
    c.json(updateRecipe(c.req.valid("param").id, c.req.valid("json"))),
  )
  .post("/:id/default", zValidator("param", idParam), (c) => c.json(setDefaultRecipe(c.req.valid("param").id)))
  .delete("/:id", zValidator("param", idParam), (c) => {
    deleteRecipe(c.req.valid("param").id);
    return c.json({ ok: true as const });
  });
