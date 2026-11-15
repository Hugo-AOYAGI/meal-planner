import { useSyncExternalStore } from "react";

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True below the `md` breakpoint (phones). */
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");

/** True from the `lg` breakpoint: room for a docked side panel. */
export const useIsWide = () => useMediaQuery("(min-width: 1024px)");
