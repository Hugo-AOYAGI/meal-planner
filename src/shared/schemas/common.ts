import { z } from "zod";
import { AISLES, INGREDIENT_SOURCES, MEAL_KINDS, MEAL_STATUSES, MOMENTS } from "../constants";
import { EXTRA_NUTRIENT_KEYS } from "../nutrients";

type WithoutDefault<T> = T extends z.ZodDefault<infer Inner> ? Inner : T;

/**
 * The schema of a partial update. A plain `.partial()` keeps the `.default()`s, so every omitted field
 * would come back as its default and overwrite the stored value: the defaults are dropped first.
 */
export function patchOf<S extends z.ZodRawShape>(schema: z.ZodObject<S>) {
  const shape = Object.fromEntries(Object.entries(schema.shape).map(([key, field]) => [key, field instanceof z.ZodDefault ? field.unwrap() : field]));
  return z.object(shape as { [K in keyof S]: WithoutDefault<S[K]> }).partial();
}

// ---------- primitives ----------
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const idSchema = z.number().int().positive();
export const mealKindSchema = z.enum(MEAL_KINDS);
export const mealStatusSchema = z.enum(MEAL_STATUSES);
export const momentSchema = z.enum(MOMENTS);
export const aisleSchema = z.enum(AISLES);
export const ingredientSourceSchema = z.enum(INGREDIENT_SOURCES);

/** Query-string numbers/booleans arrive as strings. */
export const queryInt = z.coerce.number().int().positive();

// ---------- nutrition ----------
/** Per-100 g values on an ingredient; null = unknown. */
export const per100Schema = z.object({
  kcal: z.number().nonnegative().nullable(),
  protein: z.number().nonnegative().nullable(),
  carbs: z.number().nonnegative().nullable(),
  fat: z.number().nonnegative().nullable(),
  fibre: z.number().nonnegative().nullable(),
});
export type Per100 = z.infer<typeof per100Schema>;

/** Computed nutrition values (always numbers). */
export const nutrientsSchema = z.object({
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fibre: z.number(),
});
export type Nutrients = z.infer<typeof nutrientsSchema>;

const extraNutrientSchema = z.enum(EXTRA_NUTRIENT_KEYS);

/**
 * Nutrition per person of one recipe. `partial`: some lines were skipped. `estimated`: counted values rely on estimates.
 * `extras`: the detail values (null = no ingredient has it); `partial` lists those missing on at least one line.
 */
export const nutritionSchema = z.object({
  perPerson: nutrientsSchema,
  partial: z.boolean(),
  estimated: z.boolean(),
  linesCounted: z.number().int(),
  linesTotal: z.number().int(),
  extras: z.object({
    perPerson: z.record(extraNutrientSchema, z.number().nullable()),
    partial: z.array(extraNutrientSchema),
  }),
});
export type Nutrition = z.infer<typeof nutritionSchema>;

// ---------- ciqual ----------
export const ciqualFoodSchema = per100Schema.extend({
  code: z.string(),
  name: z.string(),
  group: z.string().nullable(),
});
export type CiqualFood = z.infer<typeof ciqualFoodSchema>;

export const ciqualSearchQuerySchema = z.object({
  q: z.string().default(""),
  limit: queryInt.max(50).default(15),
});
export type CiqualSearchQuery = z.infer<typeof ciqualSearchQuerySchema>;

// ---------- ingredients ----------
export const ingredientSchema = per100Schema.extend({
  id: idSchema,
  name: z.string(),
  aisle: aisleSchema,
  ciqualCode: z.string().nullable(),
  source: ingredientSourceSchema,
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const ingredientInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  aisle: aisleSchema.default("autre"),
  kcal: per100Schema.shape.kcal.default(null),
  protein: per100Schema.shape.protein.default(null),
  carbs: per100Schema.shape.carbs.default(null),
  fat: per100Schema.shape.fat.default(null),
  fibre: per100Schema.shape.fibre.default(null),
  ciqualCode: z.string().nullable().default(null),
  source: ingredientSourceSchema.default("manual"),
});
export type IngredientInput = z.infer<typeof ingredientInputSchema>;
export const ingredientUpdateSchema = patchOf(ingredientInputSchema);
export type IngredientUpdate = z.infer<typeof ingredientUpdateSchema>;

export const ingredientSearchQuerySchema = z.object({
  q: z.string().default(""),
  limit: queryInt.max(200).default(50),
});
export type IngredientSearchQuery = z.infer<typeof ingredientSearchQuerySchema>;

