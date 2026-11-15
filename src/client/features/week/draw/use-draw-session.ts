import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Moment } from "@shared/constants";
import type { DrawStatus, Suggestion } from "@shared/schemas";
import { api, unwrap } from "@/lib/api/api";
import { invalidate } from "@/lib/api/query";
import { useSettings } from "@/lib/api/queries";

export interface DrawOptions {
  days: number;
  moments: Moment[];
  status: DrawStatus;
}

/** Identifies the slot a proposal is for. */
export const slotKey = (slot: { date: string; moment: Moment }) => `${slot.date}/${slot.moment}`;

interface DrawSessionInput {
  /** first day drawn */
  date: string;
  /** one day, redrawing what its slots hold; otherwise 7 days at first, filling only the empty slots */
  oneDay: boolean;
  /** the moment enabled at first, instead of those of the settings */
  moment?: Moment;
  /** called once the proposals are in the planning */
  onApplied: () => void;
}

/**
 * One go at drawing: choose days, moments and a filter, propose meals, keep or move some, add them to the planning.
 * Changing an option throws the proposals away, since they were drawn for the previous one.
 */
export function useDrawSession({ date, oneDay, moment, onApplied }: DrawSessionInput) {
  const queryClient = useQueryClient();
  const defaultMoments = useSettings().data?.drawMoments ?? ["soir"];
  const [options, setOptions] = useState<DrawOptions>({
    days: oneDay ? 1 : 7,
    moments: moment ? [moment] : defaultMoments,
    status: "all",
  });
  /** null until the first draw */
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [locked, setLocked] = useState<string[]>([]);

  const keptSuggestions = (suggestions ?? []).filter((s) => locked.includes(slotKey(s)));
  const propose = useMutation({
    mutationFn: () =>
      unwrap(
        api.plan.suggestions.$post({
          json: {
            date,
            ...options,
            replace: oneDay,
            locked: keptSuggestions.map((s) => ({ date: s.date, moment: s.moment, mealIds: s.meals.map((m) => m.id) })),
          },
        }),
      ),
    onSuccess: (drawn) => setSuggestions([...keptSuggestions, ...drawn]),
  });
  const apply = useMutation({
    mutationFn: () => unwrap(api.plan["apply-suggestions"].$post({ json: { slots: suggestions ?? [] } })),
    onSuccess: () => {
      invalidate.plan(queryClient);
      onApplied();
    },
  });

  const discard = () => {
    setSuggestions(null);
    setLocked([]);
    propose.reset();
    apply.reset();
  };

  return {
    options,
    changeOptions(change: Partial<DrawOptions>) {
      setOptions({ ...options, ...change });
      discard();
    },
    suggestions,
    locked,
    toggleLock: (key: string) =>
      setLocked((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key])),
    /** Exchanges the meals of two proposals; a lock stays with its meals. */
    swap(a: string, b: string) {
      const first = suggestions?.find((s) => slotKey(s) === a);
      const second = suggestions?.find((s) => slotKey(s) === b);
      if (!first || !second || a === b) return;
      const meals = (s: Suggestion) => (slotKey(s) === a ? second.meals : slotKey(s) === b ? first.meals : s.meals);
      setSuggestions((items) => items && items.map((s) => ({ ...s, meals: meals(s) })));
      setLocked((keys) => keys.map((key) => (key === a ? b : key === b ? a : key)));
    },
    propose: () => propose.mutate(),
    apply: () => apply.mutate(),
    proposing: propose.isPending,
    applying: apply.isPending,
    error: propose.isError
      ? `Impossible de proposer des repas. ${propose.error.message}`
      : apply.isError
        ? `Impossible d’enregistrer. ${apply.error.message}`
        : null,
  };
}
