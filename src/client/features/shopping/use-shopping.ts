import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** The list of the `days` days from today: refetched on focus and every 5 s (react-query pauses the interval while the tab is hidden). */
export function useShoppingList(days: number) {
  return useQuery({
    queryKey: keys.shopping.days(days),
    queryFn: () => unwrap(api.shopping.$get({ query: { days: String(days) } })),
    staleTime: 0,
    refetchInterval: 5_000,
  });
}

/**
 * Shopping write: `optimistic` patches the cached list at once; what the server answers (the list, or its extras)
 * replaces it, and a failure restores the previous one.
 */
function useListMutation<V>(days: number, run: (v: V) => Promise<Partial<ShoppingList>>, optimistic?: (list: ShoppingList, v: V) => ShoppingList) {
  const qc = useQueryClient();
  const key = keys.shopping.days(days);
  return useMutation({
    scope: { id: "shopping" },
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
