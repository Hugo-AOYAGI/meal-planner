import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  idSchema,
  shoppingCheckInputSchema,
  shoppingExtraInputSchema,
  shoppingExtraUpdateSchema,
  shoppingQuerySchema,
} from "@shared/schemas";
import {
  addShoppingExtra,
  deleteShoppingExtra,
  getShoppingList,
  setShoppingCheck,
  updateShoppingExtra,
} from "../services/planning/shopping";

const idParam = z.object({ id: z.coerce.number().pipe(idSchema) });

export const shoppingRoute = new Hono()
  .get("/", zValidator("query", shoppingQuerySchema), (c) => c.json(getShoppingList(c.req.valid("query").days)))
  .put("/check", zValidator("json", shoppingCheckInputSchema), (c) => c.json(setShoppingCheck(c.req.valid("json"))))
  .post("/extras", zValidator("json", shoppingExtraInputSchema), (c) => c.json(addShoppingExtra(c.req.valid("json")), 201))
  .patch("/extras/:id", zValidator("param", idParam), zValidator("json", shoppingExtraUpdateSchema), (c) =>
    c.json(updateShoppingExtra(c.req.valid("param").id, c.req.valid("json"))),
  )
  .delete("/extras/:id", zValidator("param", idParam), (c) => c.json(deleteShoppingExtra(c.req.valid("param").id)));
