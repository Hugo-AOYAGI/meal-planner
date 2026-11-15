import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { today } from "@shared/dates";
import { DB_PATH, sqlite } from "./db";

const KEEP = 7;

/** `VACUUM INTO data/backups/<date>.db`, then keeps the newest 7 files. */
export function backupNow(): string | null {
  if (DB_PATH === ":memory:") return null;
  const dir = join(dirname(DB_PATH), "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${today()}.db`);
  rmSync(file, { force: true });
  sqlite.run("VACUUM INTO ?", [file]);
  for (const old of readdirSync(dir).filter((f) => f.endsWith(".db")).sort().slice(0, -KEEP)) rmSync(join(dir, old));
  return file;
}

/** Runs a backup every night around 03:00 (local time), in-process. */
export function scheduleNightlyBackup(): void {
  const next = new Date();
  next.setHours(3, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    try {
      backupNow();
    } catch (e) {
      console.error("backup failed", e);
    }
    scheduleNightlyBackup();
  }, next.getTime() - Date.now()).unref();
}
