import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import type { Aisle, IngredientSource, MealKind, MealStatus, Moment } from "@shared/constants";
import type { Extras100 } from "@shared/nutrients";

/** Read-only reference imported from ANSES Ciqual (per 100 g). */
export const ciqualFood = sqliteTable(
  "ciqual_food",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    /** lowercase, accent-free name used by the search */
    nameNorm: text("name_norm").notNull(),
    groupName: text("group_name"),
    kcal: real("kcal"),
    protein: real("protein"),
    carbs: real("carbs"),
    fat: real("fat"),
    fibre: real("fibre"),
    /** detail values (see EXTRA_NUTRIENTS); null until `seed:ciqual` has run with them */
    extras: text("extras", { mode: "json" }).$type<Extras100>(),
  },
  (t) => [index("ciqual_food_name_norm").on(t.nameNorm)],
);

export const ingredient = sqliteTable("ingredient", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  nameNorm: text("name_norm").notNull(),
  aisle: text("aisle").$type<Aisle>().notNull().default("autre"),
  kcal: real("kcal"),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  fibre: real("fibre"),
  ciqualCode: text("ciqual_code"),
  /** detail values copied from the Ciqual food of `ciqualCode`; null without one */
  extras: text("extras", { mode: "json" }).$type<Extras100>(),
  source: text("source").$type<IngredientSource>().notNull().default("manual"),
});

export const meal = sqliteTable("meal", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameNorm: text("name_norm").notNull(),
  kind: text("kind").$type<MealKind>().notNull().default("plat"),
  status: text("status").$type<MealStatus>().notNull().default("regular"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const recipe = sqliteTable(
  "recipe",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mealId: integer("meal_id").notNull().references(() => meal.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    servings: integer("servings").notNull().default(4),
    durationMin: integer("duration_min"),
    steps: text("steps", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    sourceUrl: text("source_url"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("recipe_meal").on(t.mealId)],
);

export const recipeIngredient = sqliteTable(
  "recipe_ingredient",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipeId: integer("recipe_id").notNull().references(() => recipe.id, { onDelete: "cascade" }),
    ingredientId: integer("ingredient_id").notNull().references(() => ingredient.id),
    quantity: real("quantity"),
    unit: text("unit").notNull().default(""),
    grams: real("grams"),
    gramsEstimated: integer("grams_estimated", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("recipe_ingredient_recipe").on(t.recipeId)],
);

export const planSlot = sqliteTable(
  "plan_slot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    moment: text("moment").$type<Moment>().notNull(),
    servings: integer("servings").notNull(),
  },
  (t) => [unique("plan_slot_date_moment").on(t.date, t.moment)],
);

export const planEntry = sqliteTable(
  "plan_entry",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slotId: integer("slot_id").notNull().references(() => planSlot.id, { onDelete: "cascade" }),
    mealId: integer("meal_id").notNull().references(() => meal.id, { onDelete: "cascade" }),
    recipeId: integer("recipe_id").references(() => recipe.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    /** left out of the shopping list: newly planned meals start out, they are put in by hand; `applySlot` carries it over when a slot is rewritten */
    excluded: integer("excluded", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("plan_entry_slot").on(t.slotId), index("plan_entry_meal").on(t.mealId)],
);

/**
 * A row means the ingredient is bought for one planned meal (its slot and meal): a meal planned or put in the list
 * afterwards is not covered, so its share comes back to buy. Rows of past days are dropped. See `aggregateShopping`.
 */
export const shoppingBought = sqliteTable(
  "shopping_bought",
  {
    ingredientId: integer("ingredient_id").notNull().references(() => ingredient.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    moment: text("moment").$type<Moment>().notNull(),
    mealId: integer("meal_id").notNull().references(() => meal.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ingredientId, t.date, t.moment, t.mealId] })],
);

/** Lines added by hand: one list, whatever the period shown; a ticked one is removed the next day. */
export const shoppingExtra = sqliteTable("shopping_extra", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  checked: integer("checked", { mode: "boolean" }).notNull().default(false),
  /** the day it was ticked: it is removed from the next day on */
  checkedOn: text("checked_on"),
  /** the aisle it is shown in; null while it is being classified (see `classifyExtras`) */
  aisle: text("aisle").$type<Aisle>(),
});

/** A standing note about the household ("Léo n'aime pas les champignons"), read by the assistant at every turn. */
export const preference = sqliteTable("preference", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
});

/** key/value, value is JSON. */
export const setting = sqliteTable("setting", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

export const chatConversation = sqliteTable("chat_conversation", {
  id: text("id").primaryKey(),
  /** Agent SDK session id, set after the first run */
  sessionId: text("session_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  /** ISO time of the last message (bumped when messages are stored) */
  updatedAt: text("updated_at").notNull().default(""),
});

export const chatMessage = sqliteTable(
  "chat_message",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    /** UIMessage id */
    id: text("id").notNull(),
    conversationId: text("conversation_id").notNull().references(() => chatConversation.id, { onDelete: "cascade" }),
    /** the whole UIMessage as JSON */
    message: text("message", { mode: "json" }).notNull(),
  },
  (t) => [unique("chat_message_conv_id").on(t.conversationId, t.id), index("chat_message_conv").on(t.conversationId)],
);
