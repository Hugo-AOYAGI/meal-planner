import { Hono, type MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";

/** In-process bus: one listener per connected browser. `origin` is the client that made the change (it already refreshed itself). */
const listeners = new Set<(origin: string) => void>();

export const emitChanged = (origin = "") => {
  for (const send of listeners) send(origin);
};

/** Emits after every successful write under /api. Chat POSTs (send, stop) change nothing by themselves: the run emits as its tools write. */
export const emitOnWrite: MiddlewareHandler = async (c, next) => {
  await next();
  const { method, path } = c.req;
  if (method === "GET" || method === "HEAD" || !c.res.ok) return;
  if (method === "POST" && path.startsWith("/api/chat")) return;
  emitChanged(c.req.header("x-client-id"));
};

const HEARTBEAT_MS = 25_000;

/** SSE: a `changed` event (data = origin client id, possibly empty) per write; a comment as heartbeat keeps the proxy from closing an idle stream. */
export const eventsRoute = new Hono().get("/", (c) =>
  streamSSE(c, async (stream) => {
    const send = (origin: string) => void stream.writeSSE({ event: "changed", data: origin });
    const heartbeat = setInterval(() => void stream.write(": ping\n\n"), HEARTBEAT_MS);
    listeners.add(send);
    try {
      await stream.write(": ok\n\n"); // flushes the headers so the browser sees the connection open
      await new Promise<void>((resolve) => stream.onAbort(resolve));
    } finally {
      listeners.delete(send);
      clearInterval(heartbeat);
    }
  }),
);
