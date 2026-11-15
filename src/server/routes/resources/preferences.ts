import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { idSchema, preferenceInputSchema } from "@shared/schemas";
import { addPreference, listPreferences, removePreference } from "../../services/catalog/preferences";

const idParam = z.object({ id: z.coerce.number().pipe(idSchema) });

export const preferencesRoute = new Hono()
  .get("/", (c) => c.json(listPreferences()))
  .post("/", zValidator("json", preferenceInputSchema), (c) => c.json(addPreference(c.req.valid("json")), 201))
  .delete("/:id", zValidator("param", idParam), (c) => {
    removePreference(c.req.valid("param").id);
    return c.json({ ok: true as const });
  });
