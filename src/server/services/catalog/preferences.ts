import { eq } from "drizzle-orm";
import type { Preference, PreferenceInput } from "@shared/schemas";
import { db } from "../../db";
import { preference } from "../../db/schema";
import { notFound } from "../support/errors";

export const listPreferences = (): Preference[] => db.select().from(preference).orderBy(preference.id).all();

export const addPreference = ({ text }: PreferenceInput): Preference =>
  db.insert(preference).values({ text }).returning().get();

export function removePreference(id: number) {
  if (db.delete(preference).where(eq(preference.id, id)).returning({ id: preference.id }).all().length === 0) {
    throw notFound("Préférence", id);
  }
}
