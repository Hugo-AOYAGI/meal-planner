type Info = { running: string; done: string; detail?: (input: Record<string, unknown>) => unknown };

const name = (i: Record<string, unknown>) => i.name;
const query = (i: Record<string, unknown>) => i.q;

/** Short French labels per tool (the `mcp__app__` prefix is stripped). */
const TOOLS: Record<string, Info> = {
  list_meals: { running: "Recherche de repas", done: "Repas recherchés", detail: query },
  get_meal: { running: "Lecture d'un repas", done: "Repas lu" },
  create_meal: { running: "Création du repas", done: "Repas créé", detail: name },
  update_meal: { running: "Modification du repas", done: "Repas modifié", detail: name },
  create_recipe: { running: "Création de la recette", done: "Recette créée", detail: name },
  update_recipe: { running: "Modification de la recette", done: "Recette modifiée", detail: name },
  search_ingredients: { running: "Recherche d'ingrédients", done: "Ingrédients recherchés", detail: query },
  create_ingredient: { running: "Création de l'ingrédient", done: "Ingrédient créé", detail: name },
  update_ingredient: { running: "Modification de l'ingrédient", done: "Ingrédient modifié", detail: name },
  search_ciqual: { running: "Recherche Ciqual", done: "Ciqual", detail: query },
  get_week_plan: { running: "Lecture du planning", done: "Planning lu", detail: (i) => i.week },
  set_slot: { running: "Mise à jour du planning", done: "Planning mis à jour", detail: (i) => [i.date, i.moment].filter(Boolean).join(" ") },
  delete_ingredient: { running: "Suppression de l'ingrédient", done: "Ingrédient supprimé" },
  delete_meal: { running: "Suppression du repas", done: "Repas supprimé" },
  set_default_recipe: { running: "Choix de la recette par défaut", done: "Recette par défaut choisie", detail: name },
  delete_recipe: { running: "Suppression de la recette", done: "Recette supprimée" },
  draw_week: { running: "Tirage de la semaine", done: "Semaine tirée", detail: (i) => i.week },
  redraw_slot: { running: "Tirage du créneau", done: "Créneau tiré", detail: (i) => [i.date, i.moment].filter(Boolean).join(" ") },
  get_shopping_list: { running: "Lecture des courses", done: "Courses lues", detail: (i) => i.days && `${i.days} jours` },
  add_shopping_item: { running: "Ajout aux courses", done: "Ajouté aux courses", detail: (i) => i.label },
  check_shopping_item: { running: "Mise à jour des courses", done: "Courses mises à jour" },
  get_history: { running: "Lecture de l'historique", done: "Historique lu", detail: (i) => [i.from, i.to].filter(Boolean).join(" → ") },
  get_nutrition_summary: { running: "Calcul du bilan nutritionnel", done: "Bilan nutritionnel", detail: (i) => i.week },
  WebSearch: { running: "Recherche web", done: "Recherche web", detail: (i) => i.query },
  WebFetch: { running: "Lecture d'une page", done: "Page lue", detail: (i) => i.url },
};

/** Tools whose success changes data the screens display. */
export const isWriteTool = (tool: string) => /^(create_|update_|set_|add_|check_|draw_|redraw_|delete_)/.test(tool.replace("mcp__app__", ""));

/** The meal a successful write tool touched, if any (meal tools return the meal, recipe tools its recipe). */
export function mealIdOf(toolName: string, output: unknown): number | undefined {
  const key = toolName.replace("mcp__app__", "");
  const o = output && typeof output === "object" ? (output as { id?: unknown; mealId?: unknown }) : {};
  const id = /^(create|update)_meal$/.test(key) ? o.id : /^(create|update)_recipe$/.test(key) ? o.mealId : undefined;
  return typeof id === "number" ? id : undefined;
}

export function toolLabel(toolName: string, input: unknown, state: "running" | "done" | "error", errorText?: string) {
  const key = toolName.replace("mcp__app__", "");
  const info = TOOLS[key];
  const label = (state === "done" ? info?.done : info?.running) ?? key;
  const raw = input && typeof input === "object" ? info?.detail?.(input as Record<string, unknown>) : undefined;
  const detail = typeof raw === "string" && raw ? raw : undefined;
  if (state === "error") return `${label} : ${errorText ?? "échec"}`;
  return detail ? `${label} · ${detail}` : label;
}
