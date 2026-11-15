import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { idSchema, mealInputSchema, mealListQuerySchema, mealUpdateSchema } from "@shared/schemas";
import { createMeal, deleteMeal, getMeal, listMeals, updateMeal } from "../../services/catalog/meals";

const idParam = z.object({ id: z.coerce.number().pipe(idSchema) });

export const mealsRoute = new Hono()
  .get("/", zValidator("query", mealListQuerySchema), (c) => c.json(listMeals(c.req.valid("query"))))
  .post("/", zValidator("json", mealInputSchema), (c) => c.json(createMeal(c.req.valid("json")), 201))
  .get("/:id", zValidator("param", idParam), (c) => c.json(getMeal(c.req.valid("param").id)))
  .patch("/:id", zValidator("param", idParam), zValidator("json", mealUpdateSchema), (c) =>
    c.json(updateMeal(c.req.valid("param").id, c.req.valid("json"))),
  )
  .delete("/:id", zValidator("param", idParam), (c) => {
    deleteMeal(c.req.valid("param").id);
    return c.json({ ok: true as const });
  });
