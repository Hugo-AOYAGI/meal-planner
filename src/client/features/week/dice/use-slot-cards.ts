import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Moment } from "@shared/constants";
import type { Suggestion } from "@shared/schemas";
import { api, unwrap } from "@/lib/api/api";
import { invalidate } from "@/lib/api/query";

/** How many cards the dice deals. */
const COUNT = 3;

/**
 * The dice's cards for one slot. Dealt when the fan opens and forgotten when it closes, so each
 * opening deals afresh; `refetch` deals 3 new ones.
 */
export function useSlotCards(date: string, moment: Moment) {
  return useQuery({
    queryKey: ["slot-cards", date, moment],
    queryFn: () => unwrap(api.game["slot-cards"].$post({ json: { date, moment, count: COUNT } })),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

/** Writes a card to its slot: the main is replaced, starter and dessert stay. */
export function useApplyCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suggestion: Suggestion) => unwrap(api.plan["apply-suggestions"].$post({ json: { slots: [suggestion] } })),
    onSuccess: () => invalidate.plan(qc),
  });
}
