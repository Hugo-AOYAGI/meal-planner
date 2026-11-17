import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "meal-planner.offline";
const SAVE_DELAY_MS = 300;

/**
 * Keeps on this device the loaded data and the writes waiting for the network of the query families `families`
 * (first element of their query or mutation key), so a reload without signal still shows them and the writes go out
 * once the network is back. Their writes must have mutation defaults (`setMutationDefaults`) to run again after a reload.
 */
export function persistOffline(qc: QueryClient, families: string[]): void {
  const ours = (key?: readonly unknown[]) => !!key && families.includes(key[0] as string);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // kept forever: the saved copy must not vanish while another tab is shown
    if (saved) hydrate(qc, JSON.parse(saved), { defaultOptions: { queries: { gcTime: Infinity } } });
  } catch {
    /* unreadable or unavailable storage: start empty */
  }

  const save = () => {
    try {
      const state = dehydrate(qc, {
        // a list whose last refresh failed (offline) still has its data
        shouldDehydrateQuery: (q) => q.state.data !== undefined && ours(q.queryKey),
        shouldDehydrateMutation: (m) => m.state.status === "pending" && ours(m.options.mutationKey),
      });
      // a write cut short by the reload comes back paused, to be resumed
      for (const m of state.mutations) m.state = { ...m.state, isPaused: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable: only this page keeps them */
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };
  qc.getQueryCache().subscribe(later);
  qc.getMutationCache().subscribe(later);
  // a phone closes pages without warning: save as soon as the page is hidden
  addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && save());

  void qc.resumePausedMutations();
}
