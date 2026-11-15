import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { normalize } from "@shared/text";
import type { Ingredient, IngredientInput, IngredientSearchQuery, IngredientUpdate } from "@shared/schemas";
import { db } from "../../db";
import { ciqualFood, ingredient } from "../../db/schema";
import { AppError, notFound } from "../support/errors";

type Row = typeof ingredient.$inferSelect;
export const toIngredient = ({ nameNorm: _n, extras: _e, ...r }: Row): Ingredient => r;

/** The detail values follow the Ciqual code: copied from that food, none without a code. */
const extrasOf = (code: string | null) =>
  code === null ? null : (db.select({ extras: ciqualFood.extras }).from(ciqualFood).where(eq(ciqualFood.code, code)).get()?.extras ?? null);

/** Household ingredients matching `q` (accent-insensitive, every word). Empty `q` lists them all, A to Z. */
export function searchIngredients({ q, limit }: IngredientSearchQuery): Ingredient[] {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  const rows = db
    .select()
    .from(ingredient)
    .where(and(...words.map((w) => like(ingredient.nameNorm, `%${w}%`))))
    .orderBy(
      ...(words[0] ? [desc(like(ingredient.nameNorm, `${words[0]}%`))] : []),
      asc(sql`length(${ingredient.nameNorm})`),
      asc(ingredient.name),
    )
    .limit(limit)
    .all();
  return rows.map(toIngredient);
}

export function getIngredient(id: number): Ingredient {
  const row = db.select().from(ingredient).where(eq(ingredient.id, id)).get();
  if (!row) throw notFound("Ingrédient", id);
  return toIngredient(row);
}

export function createIngredient(input: IngredientInput): Ingredient {
  try {
    const row = db
      .insert(ingredient)
      .values({ ...input, extras: extrasOf(input.ciqualCode), nameNorm: normalize(input.name) })
      .returning()
      .get();
    return toIngredient(row);
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new AppError(`L'ingrédient « ${input.name} » existe déjà`, 409);
    throw e;
  }
}

export function updateIngredient(id: number, patch: IngredientUpdate): Ingredient {
  getIngredient(id);
  if (!Object.keys(patch).length) return getIngredient(id);
  try {
    const row = db
      .update(ingredient)
      .set({
        ...patch,
        ...(patch.name ? { nameNorm: normalize(patch.name) } : {}),
        ...(patch.ciqualCode !== undefined ? { extras: extrasOf(patch.ciqualCode) } : {}),
      })
      .where(eq(ingredient.id, id))
      .returning()
      .get();
    return toIngredient(row!);
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new AppError(`L'ingrédient « ${patch.name} » existe déjà`, 409);
    throw e;
  }
}
