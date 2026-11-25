import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MealListQuery } from "@shared/schemas";

/** Failed writes and failed loads surface as a toast (loads are deduplicated per query; `meta.silent` opts a query out). */
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({ onError: (error) => toast.error(error.message) }),
  queryCache: new QueryCache({
    onError: (error, query) => query.meta?.silent || toast.error(error.message, { id: query.queryHash }),
  }),
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

/** Query keys. Every key of a family starts with the family name, so `keys.meals.all` matches them all. */
export const keys = {
  meals: {
    all: ["meals"] as const,
    list: (filter: MealListQuery = {}) => ["meals", "list", filter] as const,
    detail: (id: number) => ["meals", "detail", id] as const,
  },
  recipes: {
    detail: (id: number, servings?: number) => ["recipes", id, servings ?? null] as const,
  },
  ingredients: {
    all: ["ingredients"] as const,
    search: (q: string) => ["ingredients", "search", q] as const,
  },
  ciqual: { search: (q: string) => ["ciqual", q] as const },
  plan: {
    all: ["plan"] as const,
    week: (week: string) => ["plan", week] as const,
    /** a run of days from `from`; `scroll` is the planning's endless list */
    days: (from: string, days: number | "scroll") => ["plan", "days", from, days] as const,
    /** the leftovers in the fridge: they follow the plan */
    fridge: ["plan", "fridge"] as const,
  },
  shopping: {
    all: ["shopping"] as const,
    /** the list of the `days` days from today */
    days: (days: number) => ["shopping", days] as const,
  },
  settings: ["settings"] as const,
  preferences: ["preferences"] as const,
  /** the draw game, as seen by one player */
  game: {
    all: ["game"] as const,
    view: (player: string) => ["game", player] as const,
  },
  chat: {
    all: ["chat"] as const,
    list: ["chat", "list"] as const,
  },
};

/**
 * Invalidation after a write. Pick the narrowest that is true:
 * - `meals`: a meal or recipe changed (also affects the plan and shopping, so they refresh too);
 * - `plan`: a slot changed or the draw ran (meals' last-cooked and shopping refresh too);
 * - `shopping`: only ticks / free lines changed;
 * - `ingredients`: an ingredient changed (recipes and shopping show its name/aisle/values);
 * - `all`: after an agent run. The dice's open cards are left alone, so they do not reshuffle under the finger.
 */
export const invalidate = {
  meals: (qc: QueryClient) =>
    Promise.all([keys.meals.all, ["recipes"], keys.plan.all, keys.shopping.all].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  plan: (qc: QueryClient) =>
    Promise.all([keys.plan.all, keys.meals.all, keys.shopping.all].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  shopping: (qc: QueryClient) => qc.invalidateQueries({ queryKey: keys.shopping.all }),
  ingredients: (qc: QueryClient) =>
    Promise.all([keys.ingredients.all, keys.meals.all, ["recipes"], keys.plan.all, keys.shopping.all].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  settings: (qc: QueryClient) => qc.invalidateQueries({ queryKey: keys.settings }),
  preferences: (qc: QueryClient) => qc.invalidateQueries({ queryKey: keys.preferences }),
  all: (qc: QueryClient) => qc.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "slot-cards" }),
};
