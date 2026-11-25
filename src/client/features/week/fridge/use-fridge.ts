import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Moment } from "@shared/constants";
import type { LeftoverEat, LeftoverInput, LeftoverUpdate } from "@shared/schemas";
import { api, unwrap } from "@/lib/api/api";
import { invalidate, keys } from "@/lib/api/query";

export const useFridge = () => useQuery({ queryKey: keys.plan.fridge, queryFn: () => unwrap(api.fridge.$get()) });

/** Writes to the fridge: they may change the plan ("Ce soir"), so the plan family refreshes, the fridge with it. */
function useFridgeWrite<T>(write: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ scope: { id: "plan" }, mutationFn: write, onSuccess: () => invalidate.plan(qc) });
}

export const useAddLeftover = () => useFridgeWrite((json: LeftoverInput) => unwrap(api.fridge.$post({ json })));

export const useUpdateLeftover = () =>
  useFridgeWrite(({ id, ...json }: LeftoverUpdate & { id: number }) =>
    unwrap(api.fridge[":id"].$patch({ param: { id: String(id) }, json })),
  );

export const useEatLeftover = () =>
  useFridgeWrite(({ id, ...json }: LeftoverEat & { id: number }) =>
    unwrap(api.fridge[":id"].eat.$post({ param: { id: String(id) }, json })),
  );

/** The meal a leftover is eaten at from the fridge: lunch until 14:00, dinner after. */
export const nextMoment = (now = new Date()): Moment => (now.getHours() < 14 ? "midi" : "soir");
