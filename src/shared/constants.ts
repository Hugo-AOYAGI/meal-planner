export const MEAL_KINDS = ["plat", "proteine", "feculent", "legume", "entree", "dessert"] as const;
export type MealKind = (typeof MEAL_KINDS)[number];
export const MEAL_KIND_LABELS: Record<MealKind, string> = {
  plat: "Plat",
  proteine: "Protéine",
  feculent: "Féculent",
  legume: "Légume",
  entree: "Entrée",
  dessert: "Dessert",
};

/** The courses of a lunch or dinner, in serving order. A meal's course comes from its kind. */
export const COURSES = ["entree", "plat", "dessert"] as const;
export type Course = (typeof COURSES)[number];
export const COURSE_LABELS: Record<Course, string> = { entree: "Entrée", plat: "Plat", dessert: "Dessert" };
/** Starters and desserts are their own kinds; every other kind is part of the main. */
export const courseOf = (kind: MealKind): Course => (kind === "entree" || kind === "dessert" ? kind : "plat");
/** Entries in serving order: starter, mains, dessert. Entries of a same course keep their order. */
export const byCourse = <T extends { mealKind: MealKind }>(entries: T[]): T[] =>
  entries.toSorted((a, b) => COURSES.indexOf(courseOf(a.mealKind)) - COURSES.indexOf(courseOf(b.mealKind)));

/** `idea`: prepared by the assistant for the draw's "Nouveau" card, hidden from the library until it is picked. */
export const MEAL_STATUSES = ["regular", "to_try", "idea"] as const;
export type MealStatus = (typeof MEAL_STATUSES)[number];

/** How a leftover left the fridge, when it is declared rather than eaten through the plan. */
export const LEFTOVER_ENDS = ["eaten", "thrown"] as const;
export type LeftoverEnd = (typeof LEFTOVER_ENDS)[number];

/** The agents the chat can run on. */
export const ASSISTANTS = ["claude", "codex"] as const;
export type Assistant = (typeof ASSISTANTS)[number];
export const ASSISTANT_LABELS: Record<Assistant, { name: string; model: string }> = {
  claude: { name: "Claude", model: "Sonnet 5.5" },
  codex: { name: "Codex", model: "Terra 6.1" },
};

export const MOMENTS = ["midi", "soir"] as const;
export type Moment = (typeof MOMENTS)[number];
export const MOMENT_LABELS: Record<Moment, string> = { midi: "Midi", soir: "Soir" };

/** Fixed aisle list; the array order is the display order of the shopping list. */
export const AISLES = [
  "fruits_legumes",
  "viandes_poissons",
  "cremerie",
  "epicerie",
  "surgeles",
  "boulangerie",
  "boissons",
  "autre",
] as const;
export type Aisle = (typeof AISLES)[number];
export const AISLE_LABELS: Record<Aisle, string> = {
  fruits_legumes: "Fruits et légumes",
  viandes_poissons: "Viandes et poissons",
  cremerie: "Crèmerie",
  epicerie: "Épicerie",
  surgeles: "Surgelés",
  boulangerie: "Boulangerie",
  boissons: "Boissons",
  autre: "Autre",
};

export const INGREDIENT_SOURCES = ["ciqual", "estimated", "manual"] as const;
export type IngredientSource = (typeof INGREDIENT_SOURCES)[number];

/** The five nutrition values, per 100 g on ingredients, per person on recipes. */
export const NUTRIENTS = ["kcal", "protein", "carbs", "fat", "fibre"] as const;
export type Nutrient = (typeof NUTRIENTS)[number];
export const NUTRIENT_LABELS: Record<Nutrient, string> = {
  kcal: "Énergie",
  protein: "Protéines",
  carbs: "Glucides",
  fat: "Lipides",
  fibre: "Fibres",
};
export const NUTRIENT_UNITS: Record<Nutrient, string> = {
  kcal: "kcal",
  protein: "g",
  carbs: "g",
  fat: "g",
  fibre: "g",
};
