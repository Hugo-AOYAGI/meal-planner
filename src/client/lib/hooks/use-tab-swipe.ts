import { useRef, type TouchEvent } from "react";

const MIN_DISTANCE = 70;
/** How much more sideways than vertical a gesture must be to count as a swipe. */
const MIN_SLOPE = 1.5;
/** Things that use a sideways gesture themselves. */
const OWN_GESTURE = "input, textarea, select, [role=slider], [data-no-tab-swipe]";

/** Whether `element`, or something around it up to `root`, scrolls sideways: a swipe there scrolls it. */
function scrollsSideways(element: Element, root: Element) {
  for (let el: Element | null = element; el && el !== root; el = el.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth) return true;
  }
  return false;
}

/**
 * Touch handlers for the page area: a horizontal swipe calls `onSwipe(1)` (next) or `onSwipe(-1)` (previous).
 * A gesture that started on a control, in something that scrolls sideways, or in an overlay rendered
 * elsewhere in the page (React still bubbles its events here) is left alone.
 */
export function useTabSwipe(enabled: boolean, onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      const target = event.target as Element;
      const page = event.currentTarget;
      start.current = null;
      if (!enabled || event.touches.length !== 1 || !page.contains(target)) return;
      if (target.closest(OWN_GESTURE) || scrollsSideways(target, page)) return;
      start.current = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const from = start.current;
      start.current = null;
      if (!from || event.changedTouches.length !== 1) return;
      const x = event.changedTouches[0]!.clientX - from.x;
      const y = event.changedTouches[0]!.clientY - from.y;
      if (Math.abs(x) >= MIN_DISTANCE && Math.abs(x) >= Math.abs(y) * MIN_SLOPE) onSwipe(x < 0 ? 1 : -1);
    },
    onTouchCancel() {
      start.current = null;
    },
  };
}
