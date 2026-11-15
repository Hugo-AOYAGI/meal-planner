import { useEffect, useRef } from "react";

/** Load older days when the user scrolls to the start, without moving their place. */
export function PreviousDays({ load, disabled }: { load: () => Promise<unknown>; disabled: boolean }) {
  const marker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = marker.current;
    const scroller = element?.closest<HTMLElement>("main");
    if (!element || !scroller || disabled) return;
    let armed = false;
    let loading = false;
    const arm = () => {
      armed = true;
      observer.unobserve(element);
      observer.observe(element);
    };
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry?.isIntersecting || !armed || loading) return;
        loading = true;
        armed = false;
        const anchor = scroller.querySelector<HTMLElement>("[data-date]");
        const position = anchor?.getBoundingClientRect().top;
        await load();
        requestAnimationFrame(() => {
          if (anchor && position !== undefined && anchor.isConnected) {
            scroller.scrollTop += anchor.getBoundingClientRect().top - position;
          }
        });
      },
      { root: scroller, rootMargin: "400px 0px 0px" },
    );
    scroller.addEventListener("wheel", arm, { passive: true });
    scroller.addEventListener("touchstart", arm, { passive: true });
    scroller.addEventListener("keydown", arm);
    observer.observe(element);
    return () => {
      observer.disconnect();
      scroller.removeEventListener("wheel", arm);
      scroller.removeEventListener("touchstart", arm);
      scroller.removeEventListener("keydown", arm);
    };
  }, [load, disabled]);
  return <div ref={marker} className="h-px w-px shrink-0" aria-hidden="true" />;
}
