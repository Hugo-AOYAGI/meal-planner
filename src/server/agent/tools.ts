import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readReference, searchReferences } from "./reference/knowledge";
import {
  ciqualSearchQuerySchema,
  dateSchema,
  dayRangeSchema,
  idSchema,
  ingredientInputSchema,
  ingredientSearchQuerySchema,
  ingredientUpdateSchema,
  mealInputSchema,
  mealListQuerySchema,
  mealUpdateSchema,
  preferenceInputSchema,
  momentSchema,
  recipeInputSchema,
  recipeUpdateSchema,
  setSlotInputSchema,
  shoppingDaysSchema,
  shoppingExtraInputSchema,
  suggestionInputSchema,
  weekQuerySchema,
  type Recipe,
  type WeekPlan,
} from "@shared/schemas";
import { searchCiqual } from "../services/catalog/ciqual";
import { drawWeek, redrawSlot, suggestMeals } from "../services/planning/draw";
import { AppError } from "../services/support/errors";
import { createIngredient, deleteIngredient, getIngredient, searchIngredients, updateIngredient } from "../services/catalog/ingredients";
import { getHistory, getNutritionSummary } from "../services/planning/insights";
import { addPreference, removePreference } from "../services/catalog/preferences";
import { createMeal, deleteMeal, getMeal, listMeals, updateMeal } from "../services/catalog/meals";
import { getDays, getWeek, setSlot } from "../services/planning/plan";
import { createRecipe, deleteRecipe, getRecipe, setDefaultRecipe, updateRecipe } from "../services/catalog/recipes";
import { addShoppingExtra, deleteShoppingExtra, getShoppingList, setShoppingCheck, setShoppingExclusion, updateShoppingExtra } from "../services/planning/shopping";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

function failure(e: unknown) {
  const text =
    e instanceof AppError ? e.message : e instanceof z.ZodError ? `Entrée invalide : ${z.prettifyError(e)}` : "Erreur interne";
  if (!(e instanceof AppError || e instanceof z.ZodError)) console.error(e);
  return { content: [{ type: "text" as const, text }], isError: true };
}

/** A tool built from a zod object: input is parsed with the schema (applying defaults), errors become isError results. */
function define<S extends z.ZodObject>(name: string, description: string, schema: S, run: (input: z.output<S>) => unknown) {
  return tool(name, description, schema.shape, async (args) => {
    try {
      return json(run(schema.parse(args)));
    } catch (e) {
      return failure(e);
    }
  });
}

const withId = <S extends z.ZodObject>(patch: S) => z.object({ id: idSchema, ...patch.shape });

/** Recipe without the nested ingredient objects: the model needs ids, names and quantities only. */
const compactRecipe = (r: Recipe) => ({
  id: r.id,
  mealId: r.mealId,
  name: r.name,
  servings: r.servings,
  durationMin: r.durationMin,
  steps: r.steps,
  lines: r.lines.map((l) => ({
    ingredientId: l.ingredient.id,
    ingredient: l.ingredient.name,
    quantity: l.quantity,
    unit: l.unit,
    grams: l.grams,
    gramsEstimated: l.gramsEstimated,
    note: l.note,
  })),
  nutrition: r.nutrition,
});

const mealRef = (m: { id: number; name: string; kind: string; status: string }) => ({ id: m.id, name: m.name, kind: m.kind, status: m.status });

/** The filled slots of a week, by meal name. */
const filledSlots = (plan: WeekPlan) =>
  plan.slots.filter((s) => s.entries.length).map((s) => ({ date: s.date, moment: s.moment, meals: s.entries.map((e) => e.mealName) }));

const WEEK = dateSchema.describe("N'importe quel jour de la semaine voulue (YYYY-MM-DD)");
/** The shopping list's period. */
const DAYS = shoppingDaysSchema.describe("Nombre de jours couverts par la liste, à partir d'aujourd'hui (7 par défaut)");

const referenceSearchSchema = z.object({
  query: z.string().trim().max(180).default(""),
  chapter_id: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(25).default(12),
  offset: z.number().int().nonnegative().default(0),
});

export const appTools = [
  define("search_sections", "Parcourt les sections des références locales ou cherche dans leurs titres. chapter_id filtre par chapitre.", referenceSearchSchema, (input) => searchReferences(input, true)),
  define("search", "Recherche par mots-clés dans les titres et le texte des références locales. Renvoie des extraits et les identifiants à lire.", referenceSearchSchema.extend({ query: z.string().trim().min(1).max(180) }), (input) => searchReferences(input, false)),
  define("read_section", "Lit une section Markdown des références locales à partir de son identifiant exact.", z.object({ section_id: z.string().min(1).max(200) }), ({ section_id }) => {
    const markdown = readReference(section_id);
    return markdown === undefined
      ? { error: "Section introuvable. Vérifie l’identifiant avec search_sections." }
      : { id: section_id, href: `#reference/${section_id}`, markdown };
  }),
  define(
    "list_meals",
    "Recherche les repas de la bibliothèque. q : mots qui doivent chacun apparaître dans le nom du repas ou dans un de ses ingrédients (« poulet riz ») ; excludes : ingrédients à éviter (« arachide, champignon »). Filtres de type et de statut.",
    mealListQuerySchema, (q) =>
      listMeals(q).map((m) => ({ ...mealRef(m), lastCooked: m.lastCooked, recipeCount: m.recipeCount })),
  ),
  define("get_meal", "Un repas avec ses recettes (lignes, étapes, nutrition par personne).", z.object({ id: idSchema }), ({ id }) => {
    const m = getMeal(id);
    return { ...mealRef(m), notes: m.notes, recipes: m.recipes.map(compactRecipe) };
  }),
  define("create_meal", "Crée un repas (sans recette). Utiliser status=to_try pour une idée à essayer.", mealInputSchema, (i) => mealRef(createMeal(i))),
  define("update_meal", "Modifie un repas (nom, type, statut, notes).", withId(mealUpdateSchema), ({ id, ...patch }) => mealRef(updateMeal(id, patch))),
  define(
    "create_recipe",
    "Crée une recette pour un repas. Chaque ligne référence un ingrédient existant (ingredientId) avec grams renseigné.",
    recipeInputSchema,
    (i) => compactRecipe(createRecipe(i)),
  ),
  define("update_recipe", "Modifie une recette. Si `lines` est fourni, il remplace toutes les lignes.", withId(recipeUpdateSchema), ({ id, ...patch }) =>
    compactRecipe(updateRecipe(id, patch)),
  ),
  define(
    "set_default_recipe",
    "Choisit la recette qu'un repas utilise par défaut (au planning, au tirage). Ne change pas les créneaux déjà planifiés.",
    z.object({ id: idSchema }),
    ({ id }) => compactRecipe(setDefaultRecipe(id)),
  ),
  define(
    "delete_meal",
    "Supprime définitivement un repas, avec ses recettes et ses passages au planning (donc son historique). Seulement sur demande explicite.",
    z.object({ id: idSchema }),
    ({ id }) => {
      const m = getMeal(id);
      deleteMeal(id);
      return { deleted: m.name, recipes: m.recipes.length, timesCooked: m.timesCooked };
    },
  ),
  define(
    "delete_recipe",
    "Supprime définitivement une recette d'un repas (le repas reste). Seulement sur demande explicite.",
    z.object({ id: idSchema }),
    ({ id }) => {
      const r = getRecipe(id);
      deleteRecipe(id);
      return { deleted: r.name, mealId: r.mealId };
    },
  ),
  define(
    "delete_ingredient",
    "Supprime définitivement un ingrédient du foyer. Refusé s'il est encore utilisé par une recette (l'erreur les nomme). Seulement sur demande explicite.",
    z.object({ id: idSchema }),
    ({ id }) => {
      const { name } = getIngredient(id);
      deleteIngredient(id);
      return { deleted: name };
    },
  ),
  define(
    "add_preference",
    "Retient une préférence ou une contrainte durable du foyer (goûts, allergies, régimes, habitudes), en une phrase courte. Seulement quand l'utilisateur la donne ou demande de la retenir.",
    preferenceInputSchema,
    addPreference,
  ),
  define("remove_preference", "Oublie une préférence du foyer, sur demande de l'utilisateur.", z.object({ id: idSchema }), ({ id }) => {
    removePreference(id);
    return { removed: id };
  }),
  define("search_ingredients", "Cherche dans les ingrédients du foyer (q vide = tous).", ingredientSearchQuerySchema, searchIngredients),
  define("create_ingredient", "Crée un ingrédient avec ses valeurs pour 100 g.", ingredientInputSchema, createIngredient),
  define("update_ingredient", "Modifie un ingrédient (rayon, valeurs pour 100 g, code Ciqual).", withId(ingredientUpdateSchema), ({ id, ...patch }) =>
    updateIngredient(id, patch),
  ),
  define("search_ciqual", "Cherche un aliment dans la table Ciqual (valeurs pour 100 g).", ciqualSearchQuerySchema, searchCiqual),
  define("get_week_plan", "Le planning d'une semaine (créneaux midi/soir non vides et moyennes par jour).", weekQuerySchema, ({ week }) => {
    const plan = getWeek(week);
    return { ...plan, slots: plan.slots.filter((s) => s.entries.length) };
  }),
  define("get_days_plan", "Planning de jours consécutifs à partir de from, avec tous les plats, entrées et desserts de chaque créneau.", dayRangeSchema, ({ from, days }) => getDays(from, days)),
  define("suggest_meals", "Propose des repas aléatoires sans modifier le planning, en tenant compte des jours précédents et des nutriments disponibles.", suggestionInputSchema, suggestMeals),
  define("set_slot", "Remplit un créneau du planning. entries remplace tous les repas du créneau ([] le vide) : conserver les entrées, plats et desserts existants voulus.", setSlotInputSchema, (i) =>
    setSlot(i).slots.find((s) => s.date === i.date && s.moment === i.moment),
  ),
  define("draw_week", "Tire au sort des repas pour les créneaux vides de la semaine (à partir d'aujourd'hui). Ne touche pas aux créneaux remplis.", z.object({ week: WEEK }), ({ week }) =>
    filledSlots(drawWeek(week)),
  ),
  define(
    "redraw_slot",
    "Tire au sort le plat d'un créneau, en remplaçant celui qu'il contient (entrée et dessert restent). Seulement si l'utilisateur demande de changer ce créneau.",
    z.object({ date: dateSchema, moment: momentSchema }),
    ({ date, moment }) => filledSlots(redrawSlot(date, moment)).find((s) => s.date === date && s.moment === moment) ?? null,
  ),
  define(
    "get_shopping_list",
    "La liste de courses des prochains jours, à partir d'aujourd'hui : ingrédients par rayon (quantités restant à acheter, repas d'origine, coché ou non), ajouts manuels, et `meals`, tous les repas planifiés de la période (entryId, date, moment, excluded = laissé hors liste, empty = sans recette donc sans effet sur la liste).",
    z.object({ days: DAYS }),
    ({ days }) => getShoppingList(days),
  ),
  define("add_shopping_item", "Ajoute un article libre à la liste de courses (ex. « Café ») dans son rayon (aisle) ; il y reste jusqu'à ce qu'on le retire.", shoppingExtraInputSchema.required({ aisle: true }), addShoppingExtra),
  define(
    "check_shopping_item",
    "Coche ou décoche une ligne de la liste de courses : un ingrédient (ingredientId) ou un ajout manuel (extraId). Cocher un ingrédient signifie « acheté pour les repas comptés dans la liste des `days` prochains jours » : un repas planifié ou ajouté à la liste ensuite revient à acheter. Un ajout manuel coché disparaît le lendemain.",
    z.object({ days: DAYS, ingredientId: idSchema.optional(), extraId: idSchema.optional(), checked: z.boolean() }),
    ({ days, ingredientId, extraId, checked }) => {
      if (extraId) updateShoppingExtra(extraId, { checked });
      else if (ingredientId) setShoppingCheck({ days, ingredientId, checked });
      else throw new AppError("ingredientId ou extraId requis");
      return { checked };
    },
  ),
  define(
    "exclude_meal_from_shopping",
    "Laisse un repas planifié hors de la liste de courses (il dîne dehors, il reste des restes, les ingrédients sont déjà à la maison), ou le remet dedans. entryId vient de `meals` (get_shopping_list) ou des entrées de get_days_plan.",
    z.object({ days: DAYS, entryId: idSchema, excluded: z.boolean() }),
    ({ entryId, excluded, days }) => {
      setShoppingExclusion({ days, entryId, excluded });
      return { entryId, excluded };
    },
  ),
  define("remove_shopping_item", "Retire un ajout manuel de la liste de courses (extraId, voir `extras`). Sur demande de l'utilisateur.", z.object({ extraId: idSchema }), ({ extraId }) => {
    deleteShoppingExtra(extraId);
    return { removed: extraId };
  }),
  define(
    "get_history",
    "Les repas mangés entre deux dates (incluses), du plus fréquent au moins fréquent, avec le nombre de fois et la dernière date.",
    z.object({ from: dateSchema, to: dateSchema }),
    ({ from, to }) => getHistory(from, to),
  ),
  define(
    "get_nutrition_summary",
    "Bilan nutritionnel d'une semaine : valeurs par personne pour chaque jour planifié, y compris les détails disponibles (fer, vitamines, types de lipides, etc.). partialDetails indique les valeurs incomplètes et null une valeur inconnue ; uncounted liste les repas sans nutrition calculable.",
    z.object({ week: WEEK }),
    ({ week }) => getNutritionSummary(week),
  ),
];

export const appServer = createSdkMcpServer({ name: "app", tools: appTools });
