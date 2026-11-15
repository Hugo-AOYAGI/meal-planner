import { expect, test } from "bun:test";
import { Hono } from "hono";
import { emitOnWrite, eventsRoute } from "@server/events";

test("a successful write reaches the open event streams; reads, failures and chat POSTs do not", async () => {
  const app = new Hono()
    .use("/api/*", emitOnWrite)
    .route("/api/events", eventsRoute)
    .get("/api/meals", (c) => c.json([]))
    .post("/api/meals", (c) => c.json({}, 201))
    .post("/api/bad", (c) => c.json({}, 400))
    .post("/api/chat/stop", (c) => c.body(null, 204));

  const reader = (await app.request("/api/events")).body!.getReader();
  const read = async () => new TextDecoder().decode((await reader.read()).value);
  expect(await read()).toBe(": ok\n\n");

  await app.request("/api/meals");
  await app.request("/api/bad", { method: "POST" });
  await app.request("/api/chat/stop", { method: "POST" });
  await app.request("/api/meals", { method: "POST", headers: { "x-client-id": "phone-a" } });
  expect(await read()).toBe("event: changed\ndata: phone-a\n\n");
  await reader.cancel();
});
