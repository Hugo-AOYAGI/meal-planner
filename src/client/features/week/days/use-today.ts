import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Where today's day is, relative to what is on screen. */
export type TodayPlace = "here" | "above" | "below";

/** The sticky toolbar and a little air: today counts as in view only below them. */
const TOP_MARGIN = 80;

/**
 * Keeps track of `day` in the scrolling `<main>` that holds `page`: puts it right under the sticky toolbar once the days
 * are `loaded` (older days sit above, out of sight), says where it is when scrolled away, and scrolls back to it.
 */
export function useToday(
  day: string,
  loaded: boolean,
  page: RefObject<HTMLElement | null>,
  toolbar: RefObject<HTMLElement | null>,
) {
  const [place, setPlace] = useState<TodayPlace>("here");
  const positioned = useRef(false);

  const scrollTo = useCallback(
    (behavior: ScrollBehavior) => {
      const scroller = page.current?.closest("main");
      // what is shown first: the block that opens on today (with the fridge above it), or else today's day
      const target =
        page.current?.querySelector<HTMLElement>("[data-plan-start]") ?? page.current?.querySelector<HTMLElement>(`[data-date="${day}"]`);
      if (!scroller || !target) return false;
      const top = toolbar.current?.getBoundingClientRect().bottom ?? scroller.getBoundingClientRect().top;
      scroller.scrollBy({ top: target.getBoundingClientRect().top - top - 8, behavior });
      return true;
    },
    [day, page, toolbar],
  );

  useLayoutEffect(() => {
    if (loaded && !positioned.current) positioned.current = scrollTo("instant");
  }, [loaded, scrollTo]);

  useEffect(() => {
    const scroller = page.current?.closest("main");
    const target = page.current?.querySelector<HTMLElement>(`[data-date="${day}"]`);
    if (!loaded || !scroller || !target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const above = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
        setPlace(entry.isIntersecting ? "here" : above ? "above" : "below");
      },
      { root: scroller, rootMargin: `-${TOP_MARGIN}px 0px 0px 0px` },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [day, loaded, page]);

  return { place, goToToday: () => scrollTo("smooth") };
}
