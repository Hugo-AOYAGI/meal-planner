import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MealListQuery, PreferenceInput, SetSlotInput, SettingsUpdate } from "@shared/schemas";
import { api, unwrap } from "@/lib/api/api";
import { invalidate, keys } from "@/lib/api/query";

export const useMeals = (filter: MealListQuery = {}) =>
  useQuery({
    queryKey: keys.meals.list(filter),
    queryFn: () => unwrap(api.meals.$get({ query: filter })),
    placeholderData: keepPreviousData,
  });

/** `silent`: no error toast and no retry, for places where the meal may have been deleted since. */
export const useMeal = (id: number, { silent = false } = {}) =>
  useQuery({
    queryKey: keys.meals.detail(id),
    queryFn: () => unwrap(api.meals[":id"].$get({ param: { id: String(id) } })),
    ...(silent && { meta: { silent }, retry: false }),
  });

export const useWeekPlan = (week: string) =>
  useQuery({ queryKey: keys.plan.week(week), queryFn: () => unwrap(api.plan.$get({ query: { week } })) });

export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => unwrap(api.settings.$get()) });

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: SettingsUpdate) => unwrap(api.settings.$patch({ json })),
    onSuccess: () => invalidate.settings(qc),
  });
}

export const usePreferences = () => useQuery({ queryKey: keys.preferences, queryFn: () => unwrap(api.preferences.$get()) });

export function useAddPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: PreferenceInput) => unwrap(api.preferences.$post({ json })),
    onSuccess: () => invalidate.preferences(qc),
  });
}

export function useRemovePreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => unwrap(api.preferences[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: () => invalidate.preferences(qc),
  });
}

/** Sets a slot; plan mutations run one at a time so rapid edits land in order. */
export function useSetSlot() {
  const qc = useQueryClient();
  return useMutation({
    scope: { id: "plan" },
    mutationFn: (json: SetSlotInput) => unwrap(api.plan.slot.$put({ json })),
    onSuccess: () => invalidate.plan(qc),
  });
}
