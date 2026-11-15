import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { normalize } from "@shared/text";
import type { CiqualFood, CiqualSearchQuery } from "@shared/schemas";
import { db } from "../../db";
import { ciqualFood } from "../../db/schema";
import { notFound } from "../support/errors";

const toFood = (r: typeof ciqualFood.$inferSelect): CiqualFood => ({
  code: r.code,
  name: r.name,
  group: r.groupName,
  kcal: r.kcal,
  protein: r.protein,
  carbs: r.carbs,
  fat: r.fat,
  fibre: r.fibre,
});

/** Accent-insensitive: every word must appear. Names starting with the query first, then shorter names. */
export function searchCiqual({ q, limit }: CiqualSearchQuery): CiqualFood[] {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rows = db
    .select()
    .from(ciqualFood)
    .where(and(...words.map((w) => like(ciqualFood.nameNorm, `%${w}%`))))
    .orderBy(
      desc(like(ciqualFood.nameNorm, `${words[0]}%`)),
      asc(sql`length(${ciqualFood.nameNorm})`),
      asc(ciqualFood.name),
    )
    .limit(limit)
    .all();
  return rows.map(toFood);
}

export function getCiqualFood(code: string): CiqualFood {
  const row = db.select().from(ciqualFood).where(eq(ciqualFood.code, code)).get();
  if (!row) throw notFound("Aliment Ciqual", code);
  return toFood(row);
}
