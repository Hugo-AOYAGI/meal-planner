import { useSyncExternalStore } from "react";

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

/** In-app link to a meal, opened by the Repas tab. */
export const mealHref = (id: number) => `#repas/${id}`;
