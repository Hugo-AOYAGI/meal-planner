import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { scheduleBackgroundJobs } from "./agent/background";
import { chatRoute } from "./agent/chat-route";
import { scheduleNightlyBackup } from "./backup";
import { emitOnWrite, eventsRoute } from "./events";
import { scheduleReminders } from "./services/fridge/reminders";
import { api } from "./routes";

const PORT = Number(process.env.PORT ?? 4173);
const dist = resolve(import.meta.dir, "../../dist");

const app = new Hono();

// live updates: every successful write tells the other browsers to refresh
app.use("/api/*", emitOnWrite);
app.route("/api/events", eventsRoute);

app.route("/api/chat", chatRoute);
app.route("/api", api);
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Built SPA with fallback to index.html (production; in dev Vite serves the client).
if (existsSync(dist)) {
  const root = relative(process.cwd(), dist) || ".";
  app.use("*", serveStatic({ root }));
  app.get("*", serveStatic({ root, path: "index.html" }));
}

scheduleNightlyBackup();
if (process.env.DB_PATH !== ":memory:") scheduleReminders();
if (process.env.MEAL_PLANNER_BACKGROUND !== "off") scheduleBackgroundJobs();

// idleTimeout 0: a chat stream can stay silent for a long time while the agent runs a tool (Bun's default cuts it at 10 s).
export default { port: PORT, hostname: "127.0.0.1", idleTimeout: 0, fetch: app.fetch };
