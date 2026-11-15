import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ShoppingList } from "@shared/schemas";
import { api, unwrap } from "@/lib/api/api";
import { keys } from "@/lib/api/query";

/** The periods offered, in days from today. */
export const PERIODS = [3, 7, 14] as const;
export type Period = (typeof PERIODS)[number];
const DEFAULT_PERIOD: Period = 7;
const STORAGE_KEY = "meal-planner.shopping-days";

/** The period shown, remembered on this device. */
export function useShoppingPeriod(): [Period, (days: Period) => void] {
  const [days, setDays] = useState<Period>(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      return PERIODS.find((p) => p === saved) ?? DEFAULT_PERIOD;
    } catch {
      return DEFAULT_PERIOD;
    }
  });
  return [
    days,
    (next) => {
      setDays(next);
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* storage unavailable: the choice just won't survive a reload */
      }
    },
  ];
}

const MUTATION_KEY = ["shopping"];

/** How many shopping writes are in flight or waiting for the network. */
export const useShoppingPending = () => useIsMutating({ mutationKey: MUTATION_KEY });

/**
 * The list of the `days` days from today: refetched on focus and every 5 s (react-query pauses the interval while the tab is hidden).
 * It is asked for even when the browser thinks it is offline, and a failed poll keeps the list shown (`isError` with data = offline);
 * no polling while writes wait, the server's list would undo their optimistic state.
 */
export function useShoppingList(days: number) {
  const pending = useShoppingPending();
  return useQuery({
    queryKey: keys.shopping.days(days),
    queryFn: () => unwrap(api.shopping.$get({ query: { days: String(days) } })),
    staleTime: 0,
    networkMode: "always",
    meta: { silent: true },
    refetchInterval: pending ? false : 5_000,
  });
}

/**
 * Shopping write: `optimistic` patches the cached list at once; what the server answers (the list, or its extras)
 * replaces it, and a failure restores the previous one. A lost connection is not a failure: the write is retried
 * until the network is back (writes go one at a time, in order), so ticking in a shop without signal still works.
 */
function useListMutation<V>(days: number, run: (v: V) => Promise<Partial<ShoppingList>>, optimistic?: (list: ShoppingList, v: V) => ShoppingList) {
  const qc = useQueryClient();
  const key = keys.shopping.days(days);
  return useMutation({
    mutationKey: MUTATION_KEY,
    scope: { id: "shopping" },
    networkMode: "offlineFirst",
    retry: (_count, error) => error instanceof TypeError,
    mutationFn: run,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ShoppingList>(key);
      if (previous && optimistic) qc.setQueryData(key, optimistic(previous, v));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(key, ctx.previous),
    onSuccess: (fresh) => qc.setQueryData<ShoppingList>(key, (list) => list && { ...list, ...fresh }),
  });
}

export function useShoppingActions(days: number) {
  const qc = useQueryClient();
  const extras = (list: Promise<ShoppingList["extras"]>) => list.then((extras) => ({ extras }));
  return {
    checkItem: useListMutation(
      days,
      (v: { ingredientId: number; checked: boolean }) => unwrap(api.shopping.check.$put({ json: { days, ...v } })),
      (list, v) => ({
        ...list,
        aisles: list.aisles.map((a) => ({
          ...a,
          items: a.items.map((i) => (i.ingredientId === v.ingredientId ? { ...i, checked: v.checked } : i)),
        })),
      }),
    ),
    excludeMeal: useListMutation(
      days,
      (v: { entryId: number; excluded: boolean }) =>
        unwrap(api.shopping.exclude.$put({ json: { days, ...v } })).then((list) => {
          void qc.invalidateQueries({ queryKey: keys.plan.all }); // the Semaine tab shows the mark
          return list;
        }),
      (list, v) => ({ ...list, meals: list.meals.map((m) => (m.entryId === v.entryId ? { ...m, excluded: v.excluded } : m)) }),
    ),
    addExtra: useListMutation(days, (label: string) => extras(unwrap(api.shopping.extras.$post({ json: { label } })))),
    checkExtra: useListMutation(
      days,
      (v: { id: number; checked: boolean }) => extras(unwrap(api.shopping.extras[":id"].$patch({ param: { id: String(v.id) }, json: { checked: v.checked } }))),
      (list, v) => ({ ...list, extras: list.extras.map((e) => (e.id === v.id ? { ...e, checked: v.checked } : e)) }),
    ),
    removeExtra: useListMutation(
      days,
      (id: number) => extras(unwrap(api.shopping.extras[":id"].$delete({ param: { id: String(id) } }))),
      (list, id) => ({ ...list, extras: list.extras.filter((e) => e.id !== id) }),
    ),
  };
}
