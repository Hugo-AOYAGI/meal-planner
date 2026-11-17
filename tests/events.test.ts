import { expect, test } from "bun:test";
import type { UIMessageChunk } from "ai";
import { Hono } from "hono";
import { follow, isBusy, liveRun, queueRun, stopRuns } from "@server/agent/runtime/live-run";
import { emitChat, emitOnWrite, eventsRoute } from "@server/events";

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

test("a turn start reaches the event streams as a chat event", async () => {
  const app = new Hono().route("/api/events", eventsRoute);
  const reader = (await app.request("/api/events")).body!.getReader();
  const read = async () => new TextDecoder().decode((await reader.read()).value);
  expect(await read()).toBe(": ok\n\n");
  emitChat("c1", "start");
  expect(await read()).toBe('event: chat\ndata: {"conversationId":"c1","phase":"start"}\n\n');
  await reader.cancel();
});

/** A turn that writes `text` then waits for `release`. */
function turn(text: string, started: string[], release: Promise<void>) {
  return () =>
    new ReadableStream<UIMessageChunk>({
      async start(controller) {
        started.push(text);
        controller.enqueue({ type: "text-delta", id: "t", delta: text });
        await release;
        controller.close();
      },
    });
}

async function collect(stream: ReadableStream<UIMessageChunk>) {
  const chunks: UIMessageChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

test("turns run one at a time, in order; a waiting turn stopped leaves the line", async () => {
  const started: string[] = [];
  let releaseFirst!: () => void;
  const first = queueRun("a", turn("one", started, new Promise((r) => (releaseFirst = r))));
  const second = queueRun("b", turn("two", started, Promise.resolve()), [{ type: "data-conversation", data: { id: "b", queued: true } }]);
  const third = queueRun("c", turn("three", started, Promise.resolve()));
  expect(started).toEqual(["one"]);
  expect(liveRun("a")).toBe(first);
  expect(liveRun("b")).toBeNull();

  stopRuns("c");
  expect(await collect(follow(third))).toEqual([]);
  releaseFirst();
  expect(await collect(follow(second))).toEqual([
    { type: "data-conversation", data: { id: "b", queued: true } },
    { type: "text-delta", id: "t", delta: "two" },
  ]);
  expect(started).toEqual(["one", "two"]);
  expect(isBusy()).toBe(false);
});
