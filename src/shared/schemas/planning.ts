import { z } from "zod";
import { MEAL_STATUSES } from "../constants";
import { aisleSchema, dateSchema, idSchema, mealKindSchema, momentSchema } from "./common";

// ---------- week plan ----------
export const weekQuerySchema = z.object({
  /** any date; the week containing it is used. Defaults to the current week. */
  week: dateSchema.optional(),
});

export const slotEntryInputSchema = z.object({
  mealId: idSchema,
  /** defaults to the meal's first recipe (null when it has none) */
  recipeId: idSchema.nullable().optional(),
});
export type SlotEntryInput = z.infer<typeof slotEntryInputSchema>;

/** Sets a slot. `entries` replaces all entries ([] clears the slot); omitted = keep. `servings` omitted = keep (or household size for a new slot). */
export const setSlotInputSchema = z.object({
  date: dateSchema,
  moment: momentSchema,
  servings: z.number().int().positive().max(50).optional(),
  entries: z.array(slotEntryInputSchema).optional(),
});
export type SetSlotInput = z.infer<typeof setSlotInputSchema>;

export const slotEntrySchema = z.object({
  id: idSchema,
  position: z.number().int(),
  mealId: idSchema,
  mealName: z.string(),
  mealKind: mealKindSchema,
  recipeId: idSchema.nullable(),
  recipeName: z.string().nullable(),
  /** the meal's recipes, for the recipe selector */
  recipeOptions: z.array(z.object({ id: idSchema, name: z.string() })),
  /** kcal per person of the chosen recipe; null when no recipe or no countable line */
  kcalPerPerson: z.number().nullable(),
  /** left out of the shopping list */
  excluded: z.boolean(),
});
export type SlotEntry = z.infer<typeof slotEntrySchema>;

export const slotSchema = z.object({
  date: dateSchema,
  moment: momentSchema,
  servings: z.number().int(),
  entries: z.array(slotEntrySchema),
  /** sum of the entries' kcal per person; null when no entry has a value */
  kcalPerPerson: z.number().nullable(),
});
export type Slot = z.infer<typeof slotSchema>;

export const weekPlanSchema = z.object({
  /** Monday, YYYY-MM-DD */
  week: dateSchema,
  /** always 14 slots: 7 days x (midi, soir), in date order */
  slots: z.array(slotSchema),
  /** per person per day, over days having at least one planned entry with a value */
  averages: z.object({
    days: z.number().int(),
    kcal: z.number(),
    protein: z.number(),
    fibre: z.number(),
  }),
});
export type WeekPlan = z.infer<typeof weekPlanSchema>;

/** A run of consecutive days, wherever it starts. */
export const dayRangeSchema = z.object({ from: dateSchema, days: z.coerce.number().int().min(1).max(31) });
/** The plan of a run of days: 2 slots per day (midi, soir) in date order; averages over those days. */
export const dayPlanSchema = weekPlanSchema.omit({ week: true }).extend(dayRangeSchema.shape);
export type DayPlan = z.infer<typeof dayPlanSchema>;

// ---------- draw ----------
/** Which meals a draw may pick: all of them, the usual ones, or those still to try. */
export const drawStatusSchema = z.enum(["all", ...MEAL_STATUSES]);
export type DrawStatus = z.infer<typeof drawStatusSchema>;

/** What to draw: the moments of `days` days from `date`. */
export const suggestionInputSchema = z.object({
  date: dateSchema,
  days: z.number().int().min(1).max(7),
  moments: z.array(momentSchema).min(1),
  status: drawStatusSchema,
  /** also redraw the main of slots that already hold a meal, instead of filling only the empty ones */
  replace: z.boolean(),
  /** proposals the user keeps: their meals are reserved and their slots are not drawn again */
  locked: z.array(z.object({ date: dateSchema, moment: momentSchema, mealIds: z.array(idSchema).min(1) })).optional(),
});
export type SuggestionInput = z.infer<typeof suggestionInputSchema>;

const entryRefSchema = z.object({ mealId: idSchema, recipeId: idSchema.nullable() });

/**
 * A proposed main (with its sides, for a protein) for one slot. Applying it keeps the `kept` entries
 * (starters, desserts) and only goes through while the slot still holds `expected`.
 */
export const suggestionSchema = z.object({
  date: dateSchema,
  moment: momentSchema,
  meals: z.array(z.object({ id: idSchema, name: z.string() })).min(1),
  kept: z.array(entryRefSchema),
  expected: z.array(entryRefSchema),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

/** At most one proposal per slot of a week of 7 days. */
export const applySuggestionsSchema = z.object({ slots: z.array(suggestionSchema).min(1).max(14) });

// ---------- shopping ----------
/** How many days the list covers, starting today. */
export const shoppingDaysSchema = z.number().int().min(1).max(31).default(7);
export const shoppingQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(31).default(7) });

export const shoppingItemSchema = z.object({
  ingredientId: idSchema,
  name: z.string(),
  aisle: aisleSchema,
  /** summed per unit; unit "" = pieces */
  quantities: z.array(z.object({ unit: z.string(), quantity: z.number() })),
  /** total grams; null unless every line has grams */
  totalGrams: z.number().nullable(),
  /** names of the meals this comes from */
  meals: z.array(z.string()),
  /** ticked: everything needed in the period is bought. Otherwise quantities and meals are what is left to buy. */
  checked: z.boolean(),
});
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const shoppingExtraSchema = z.object({
  id: idSchema,
  label: z.string(),
  checked: z.boolean(),
});
export type ShoppingExtra = z.infer<typeof shoppingExtraSchema>;

export const shoppingMealSchema = z.object({
  /** the plan entry: what `excluded` is set on */
  entryId: idSchema,
  mealId: idSchema,
  name: z.string(),
  date: dateSchema,
  moment: momentSchema,
  excluded: z.boolean(),
  /** no recipe, or a recipe without ingredients: adds nothing to the list, excluded or not */
  empty: z.boolean(),
});
export type ShoppingMeal = z.infer<typeof shoppingMealSchema>;

export const shoppingListSchema = z.object({
  /** the period covered: today and the last day, both included */
  from: dateSchema,
  to: dateSchema,
  /** only aisles that have items, in AISLES order */
  aisles: z.array(z.object({ aisle: aisleSchema, items: z.array(shoppingItemSchema) })),
  /** lines added by hand; the same whatever the period */
  extras: z.array(shoppingExtraSchema),
  /** every meal planned in the period, in date order, whether counted or not */
  meals: z.array(shoppingMealSchema),
});
export type ShoppingList = z.infer<typeof shoppingListSchema>;

/** Leaves a planned meal (a plan entry) out of the list, or puts it back; answers with the list of `days` days. */
export const shoppingExcludeInputSchema = z.object({
  days: shoppingDaysSchema,
  entryId: idSchema,
  excluded: z.boolean(),
});
export type ShoppingExcludeInput = z.infer<typeof shoppingExcludeInputSchema>;

/** Ticks (or unticks) an ingredient of the list covering `days` days. */
export const shoppingCheckInputSchema = z.object({
  days: shoppingDaysSchema,
  ingredientId: idSchema,
  checked: z.boolean(),
});
export type ShoppingCheckInput = z.infer<typeof shoppingCheckInputSchema>;
export const shoppingExtraInputSchema = z.object({
  label: z.string().trim().min(1).max(120),
});
export type ShoppingExtraInput = z.infer<typeof shoppingExtraInputSchema>;
export const shoppingExtraUpdateSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  checked: z.boolean().optional(),
});
export type ShoppingExtraUpdate = z.infer<typeof shoppingExtraUpdateSchema>;

// ---------- chat ----------
export const chatConversationSchema = z.object({
  id: z.string(),
  /** Agent SDK session id, null until the first run */
  sessionId: z.string().nullable(),
});
export type ChatConversation = z.infer<typeof chatConversationSchema>;

/** A row of the history list: the title is the first user message, `updatedAt` the ISO time of the last message. */
export const chatConversationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.string(),
});
export type ChatConversationSummary = z.infer<typeof chatConversationSummarySchema>;
