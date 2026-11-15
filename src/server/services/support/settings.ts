import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, settingsSchema, type Settings, type SettingsUpdate } from "@shared/schemas";
import { db } from "../../db";
import { setting } from "../../db/schema";

const KEY = "settings";

export function getSettings(): Settings {
  const row = db.select().from(setting).where(eq(setting.key, KEY)).get();
  return settingsSchema.parse({ ...DEFAULT_SETTINGS, ...(row?.value as object | undefined) });
}

export function updateSettings(patch: SettingsUpdate): Settings {
  const next = settingsSchema.parse({ ...getSettings(), ...patch });
  db.insert(setting)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: setting.key, set: { value: next } })
    .run();
  return next;
}
