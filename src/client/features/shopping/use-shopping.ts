import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ShoppingList } from "@shared/schemas";
import { api, unwrap } from "@/lib/api/api";
import { keys, queryClient } from "@/lib/api/query";

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
    gcTime: Infinity, // kept, and saved on the device, even while another tab is shown
    networkMode: "always",
    meta: { silent: true },
    refetchInterval: pending ? false : 5_000,
  });
}

/** One write to the list. Plain data, so a write still waiting for the network survives a reload (see `persistOffline`). */
export type ShoppingWrite =
  | { type: "check"; days: number; ingredientId: number; checked: boolean }
  | { type: "exclude"; days: number; entryId: number; excluded: boolean }
  | { type: "add"; label: string }
  | { type: "checkExtra"; id: number; checked: boolean }
  | { type: "removeExtra"; id: number };

/** Sends a write; the server answers with the list of its period, or with the hand-added lines. */
function send(w: ShoppingWrite): Promise<Partial<ShoppingList>> {
  const extras = (list: Promise<ShoppingList["extras"]>) => list.then((extras) => ({ extras }));
  switch (w.type) {
    case "check":
      return unwrap(api.shopping.check.$put({ json: { days: w.days, ingredientId: w.ingredientId, checked: w.checked } }));
    case "exclude":
      return unwrap(api.shopping.exclude.$put({ json: { days: w.days, entryId: w.entryId, excluded: w.excluded } }));
    case "add":
      return extras(unwrap(api.shopping.extras.$post({ json: { label: w.label } })));
    case "checkExtra":
      return extras(unwrap(api.shopping.extras[":id"].$patch({ param: { id: String(w.id) }, json: { checked: w.checked } })));
    case "removeExtra":
      return extras(unwrap(api.shopping.extras[":id"].$delete({ param: { id: String(w.id) } })));
  }
}

/** What the list looks like once the write is through, shown at once (also offline). */
function optimistic(list: ShoppingList, w: ShoppingWrite): ShoppingList {
  switch (w.type) {
    case "check":
      return {
        ...list,
        aisles: list.aisles.map((a) => ({ ...a, items: a.items.map((i) => (i.ingredientId === w.ingredientId ? { ...i, checked: w.checked } : i)) })),
      };
    case "exclude":
      return { ...list, meals: list.meals.map((m) => (m.entryId === w.entryId ? { ...m, excluded: w.excluded } : m)) };
    case "add": // unsorted until the server files it in its aisle; a negative id until it is saved
      return { ...list, extras: [...list.extras, { id: -Date.now(), label: w.label, checked: false, aisle: null }] };
    case "checkExtra":
      return { ...list, extras: list.extras.map((e) => (e.id === w.id ? { ...e, checked: w.checked } : e)) };
    case "removeExtra":
      return { ...list, extras: list.extras.filter((e) => e.id !== w.id) };
  }
}

/**
 * How every shopping write runs, also one restored after a reload: one at a time, in order; a lost connection is not
 * a failure, the write waits for the network (so ticking in a shop without signal works); the answer goes in the cache.
 */
queryClient.setMutationDefaults(MUTATION_KEY, {
  mutationFn: (w: ShoppingWrite) => send(w),
  scope: { id: "shopping" },
  networkMode: "offlineFirst",
  retry: (_count: number, error: Error) => error instanceof TypeError,
  onSuccess: (fresh: Partial<ShoppingList>, w: ShoppingWrite) => {
    const lists = { queryKey: keys.shopping.all };
    if ("days" in w) queryClient.setQueryData<ShoppingList>(keys.shopping.days(w.days), (list) => list && { ...list, ...fresh });
    if (fresh.extras) queryClient.setQueriesData<ShoppingList>(lists, (list) => list && { ...list, extras: fresh.extras! });
    // the other periods catch up when shown (no refetch now: it would undo the writes still waiting)
    void queryClient.invalidateQueries({ ...lists, refetchType: "none" });
    if (w.type === "exclude") void queryClient.invalidateQueries({ queryKey: keys.plan.all });
  },
});

/** The list's writes: each shows at once in every cached period, and a refused one restores them. */
export function useShoppingActions(days: number) {
  const qc = useQueryClient();
  const { mutate } = useMutation<Partial<ShoppingList>, Error, ShoppingWrite, [readonly unknown[], ShoppingList | undefined][]>({
    mutationKey: MUTATION_KEY,
    onMutate: async (w) => {
      await qc.cancelQueries({ queryKey: keys.shopping.all });
      const previous = qc.getQueriesData<ShoppingList>({ queryKey: keys.shopping.all });
      qc.setQueriesData<ShoppingList>({ queryKey: keys.shopping.all }, (list) => list && optimistic(list, w));
      return previous;
    },
    onError: (_e, _w, previous) => previous?.forEach(([key, list]) => qc.setQueryData(key, list)),
  });
  return {
    checkItem: (v: { ingredientId: number; checked: boolean }) => mutate({ type: "check", days, ...v }),
    excludeMeal: (v: { entryId: number; excluded: boolean }) => mutate({ type: "exclude", days, ...v }),
    addExtra: (label: string) => mutate({ type: "add", label }),
    checkExtra: (v: { id: number; checked: boolean }) => mutate({ type: "checkExtra", ...v }),
    removeExtra: (id: number) => mutate({ type: "removeExtra", id }),
  };
}
