import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { idSchema, leftoverEatSchema, leftoverInputSchema, leftoverUpdateSchema, pushSubscriptionSchema } from "@shared/schemas";
import { addLeftover, eatLeftover, listFridge, updateLeftover } from "../services/fridge/leftovers";
import { pushPublicKey, sendReminder, subscribe, unsubscribe } from "../services/fridge/reminders";

const idParam = z.object({ id: z.coerce.number().pipe(idSchema) });

/** The fridge: leftovers kept from planned meals or added by hand. Each write answers with the fridge. */
export const fridgeRoute = new Hono()
  .get("/", (c) => c.json(listFridge()))
  .post("/", zValidator("json", leftoverInputSchema), (c) => c.json(addLeftover(c.req.valid("json"))))
  .patch("/:id", zValidator("param", idParam), zValidator("json", leftoverUpdateSchema), (c) =>
    c.json(updateLeftover(c.req.valid("param").id, c.req.valid("json"))),
  )
  .post("/:id/eat", zValidator("param", idParam), zValidator("json", leftoverEatSchema), (c) =>
    c.json(eatLeftover(c.req.valid("param").id, c.req.valid("json"))),
  );

/** Web Push for the leftover reminders: each device subscribes by itself. */
export const pushRoute = new Hono()
  .get("/key", (c) => c.json({ key: pushPublicKey() }))
  .post("/subscription", zValidator("json", pushSubscriptionSchema), (c) => {
    subscribe(c.req.valid("json"));
    return c.json({ ok: true });
  })
  .post("/unsubscribe", zValidator("json", z.object({ endpoint: z.string().max(1000) })), (c) => {
    unsubscribe(c.req.valid("json").endpoint);
    return c.json({ ok: true });
  })
  /** sends the reminder now (to try it out); `sent` is 0 when nothing in the fridge is old enough */
  .post("/test", async (c) => c.json({ sent: await sendReminder() }));
