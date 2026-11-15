import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

export const DB_PATH = process.env.DB_PATH ?? "data/meal-planner.db";

function open(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA synchronous = FULL");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: `${import.meta.dir}/migrations` });
  return { sqlite, db };
}

/** The app's single connection. Migrations are applied on import. Set DB_PATH=:memory: for tests. */
export const { sqlite, db } = open(DB_PATH);
