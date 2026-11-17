import { useSyncExternalStore } from "react";
import { entryState } from "@/lib/hooks/use-back";

const subscribe = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

/** The URL hash without "#": `tab` or `tab/id`. Reload and back keep it. */
export function useHash(): { tab: string; id: number | null } {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash.slice(1));
  const [tab = "", rest] = hash.split("/");
  const id = Number(rest);
  return { tab, id: rest && Number.isInteger(id) ? id : null };
}

export const setHash = (hash: string) => {
  window.location.hash = hash;
};

function go(hash: string, mode: "push" | "replace", state: object) {
  const url = `${location.pathname}${location.search}#${hash}`;
  if (mode === "push") history.pushState(state, "", url);
  else history.replaceState(state, "", url);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/**
 * Switches tab without piling tabs up in the history: from `home` the other tab is one entry above it, so the back
 * action returns home; between other tabs the entry is replaced; from `home` the back action leaves the app.
 */
export function goToTab(tab: string, home: string) {
  const current = location.hash.slice(1).split("/")[0] || home;
  if (tab === current) return;
  const fromHome = (history.state as { fromHome?: boolean } | null)?.fromHome;
  if (current === home) go(tab, "push", entryState({ fromHome: true }));
  else if (tab === home && fromHome) history.back();
  else go(tab, "replace", entryState({ fromHome }));
}

/** Leaves a meal opened by an in-app link: back to where the link was, or (opened directly) to the Repas tab. */
export function leaveLinkedMeal() {
  if ((history.state as { linked?: boolean } | null)?.linked) history.back();
  else go("repas", "replace", entryState());
}

/** In-app link to a meal, opened by the Repas tab. */
export const mealHref = (id: number) => `#repas/${id}`;
