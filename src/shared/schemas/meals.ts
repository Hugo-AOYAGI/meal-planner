import { z } from "zod";
import { ASSISTANTS, LEFTOVER_ENDS } from "../constants";
import {
  dateSchema, idSchema, ingredientSchema, mealKindSchema, mealStatusSchema,
  momentSchema, nutritionSchema, patchOf, queryInt,
} from "./common";

// ---------- recipes ----------
export const recipeLineInputSchema = z.object({
  ingredientId: idSchema,
  /** null = "to taste", no quantity */
  quantity: z.number().nonnegative().nullable().default(null),
  /** free text: g, ml, gousses, ... ; "" for pieces */
  unit: z.string().trim().max(30).default(""),
  /** weight in grams for the stored quantity; null = unknown (line skipped in nutrition) */
  grams: z.number().nonnegative().nullable().default(null),
  gramsEstimated: z.boolean().default(false),
  note: z.string().trim().max(200).nullable().default(null),
});
export type RecipeLineInput = z.infer<typeof recipeLineInputSchema>;

export const recipeLineSchema = z.object({
  id: idSchema,
  position: z.number().int(),
  ingredient: ingredientSchema,
  quantity: z.number().nullable(),
  unit: z.string(),
  grams: z.number().nullable(),
  gramsEstimated: z.boolean(),
  note: z.string().nullable(),
});
export type RecipeLine = z.infer<typeof recipeLineSchema>;

export const recipeInputSchema = z.object({
  mealId: idSchema,
  name: z.string().trim().min(1).max(120),
  servings: z.number().int().positive().max(50).default(4),
  durationMin: z.number().int().nonnegative().nullable().default(null),
  steps: z.array(z.string().trim().min(1)).default([]),
  sourceUrl: z.string().url().nullable().default(null),
  lines: z.array(recipeLineInputSchema).default([]),
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;

/** Partial update; when `lines` is present it replaces all lines. */
export const recipeUpdateSchema = patchOf(recipeInputSchema.omit({ mealId: true }));
export type RecipeUpdate = z.infer<typeof recipeUpdateSchema>;

export const recipeSchema = z.object({
  id: idSchema,
  mealId: idSchema,
  name: z.string(),
  /** servings the quantities refer to: the recipe base servings, or the requested ones when fetched with ?servings=N */
  servings: z.number().int(),
  durationMin: z.number().int().nullable(),
  steps: z.array(z.string()),
  sourceUrl: z.string().nullable(),
  position: z.number().int(),
  lines: z.array(recipeLineSchema),
  nutrition: nutritionSchema,
});
export type Recipe = z.infer<typeof recipeSchema>;

export const recipeQuerySchema = z.object({
  /** scale quantities and grams to this number of people (nutrition per person is unaffected) */
  servings: queryInt.max(50).optional(),
});

// ---------- meals ----------
export const mealInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: mealKindSchema.default("plat"),
  status: mealStatusSchema.default("regular"),
  notes: z.string().trim().max(2000).nullable().default(null),
});
export type MealInput = z.infer<typeof mealInputSchema>;
export const mealUpdateSchema = patchOf(mealInputSchema);
export type MealUpdate = z.infer<typeof mealUpdateSchema>;

export const mealSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: mealKindSchema,
  status: mealStatusSchema,
  notes: z.string().nullable(),
  /** most recent plan entry dated today or earlier; null = never cooked */
  lastCooked: dateSchema.nullable(),
  timesCooked: z.number().int(),
  recipeCount: z.number().int(),
});
export type MealSummary = z.infer<typeof mealSummarySchema>;

export const mealDetailSchema = mealSummarySchema.extend({ recipes: z.array(recipeSchema) });
export type MealDetail = z.infer<typeof mealDetailSchema>;

export const mealListQuerySchema = z.object({
  /** words that must each appear in the meal's name or in one of its ingredients */
  q: z.string().optional(),
  /** ingredients the meal must not contain (separated by commas or spaces) */
  excludes: z.string().optional(),
  kind: mealKindSchema.optional(),
  status: mealStatusSchema.optional(),
});
export type MealListQuery = z.infer<typeof mealListQuerySchema>;

// ---------- settings ----------
/** A household member, as the draw game knows them. `id` is stable; name and colour can change. */
export const memberSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(30),
  /** one of the palette tokens (sun, tomato, leaf, sky, lilac, rose) */
  color: z.enum(["sun", "tomato", "leaf", "sky", "lilac", "rose"]),
});
export type Member = z.infer<typeof memberSchema>;

export const settingsSchema = z.object({
  /** default servings for newly created slots */
  householdSize: z.number().int().positive().max(50),
  /** moments the draw fills */
  drawMoments: z.array(momentSchema),
  /** the agent behind the chat */
  assistant: z.enum(ASSISTANTS),
  /** the people who play the draw; each device says which one it is */
  members: z.array(memberSchema).max(6),
  /** the quick draw only offers meals ready in this many minutes */
  quickMaxMinutes: z.number().int().min(5).max(120),
});
export type Settings = z.infer<typeof settingsSchema>;
export const settingsUpdateSchema = patchOf(settingsSchema);
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
export const DEFAULT_SETTINGS: Settings = { householdSize: 2, drawMoments: ["soir"], assistant: "claude", members: [], quickMaxMinutes: 25 };


// ---------- household preferences ----------
export const preferenceInputSchema = z.object({ text: z.string().trim().min(1).max(300) });
export type PreferenceInput = z.infer<typeof preferenceInputSchema>;
export const preferenceSchema = preferenceInputSchema.extend({ id: idSchema });
export type Preference = z.infer<typeof preferenceSchema>;

// ---------- fridge ----------
/** A leftover in the fridge: portions kept from a planned meal, or added by hand. */
export const leftoverSchema = z.object({
  id: idSchema,
  /** the meal it comes from; null for one added by hand under a free name */
  mealId: idSchema.nullable(),
  name: z.string(),
  /** the day it was cooked */
  createdOn: dateSchema,
  /** days since `createdOn` */
  age: z.number().int(),
  /** portions left */
  remaining: z.number().int(),
  /** added by hand rather than kept from a planned meal */
  manual: z.boolean(),
});
export type Leftover = z.infer<typeof leftoverSchema>;

/** A leftover added by hand: a meal of the library or a free name. */
export const leftoverInputSchema = z
  .object({
    mealId: idSchema.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    portions: z.number().int().min(1).max(30),
    createdOn: dateSchema.optional(),
  })
  .refine((v) => v.mealId !== undefined || v.name !== undefined, "mealId ou name requis");
export type LeftoverInput = z.infer<typeof leftoverInputSchema>;

/** Corrects what is left (`remaining`), or takes it out of the fridge (`done`). */
export const leftoverUpdateSchema = z.object({
  remaining: z.number().int().min(0).max(30).optional(),
  done: z.enum(LEFTOVER_ENDS).optional(),
});
export type LeftoverUpdate = z.infer<typeof leftoverUpdateSchema>;

/** Eats a leftover at a meal: added to that slot as a "Restes" entry. */
export const leftoverEatSchema = z.object({ date: dateSchema, moment: momentSchema });
export type LeftoverEat = z.infer<typeof leftoverEatSchema>;

/** A browser's Web Push subscription (`PushSubscription.toJSON()`). */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
