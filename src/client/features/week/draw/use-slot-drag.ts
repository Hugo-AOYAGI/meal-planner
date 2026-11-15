import type { PointerEvent } from "react";
import { useEffect, useRef } from "react";

/** Marks the rows that can be dragged and dropped on. */
export const SLOT_ATTRIBUTE = "data-slot-key";
const SLOT_SELECTOR = `[${SLOT_ATTRIBUTE}]`;

/**
 * Drag handles for touch screens. A copy of the row follows the finger while it is held on the handle;
 * letting go over another row (`SLOT_ATTRIBUTE`) calls `onDrop(from, to)`.
 * Returns the pointer handlers of the handle of the row `key`.
 */
export function useSlotDrag(onDrop: (from: string, to: string) => void) {
  const drag = useRef<{ key: string; ghost: HTMLElement } | null>(null);
  const end = () => {
    drag.current?.ghost.remove();
    drag.current = null;
  };
  useEffect(() => end, []);

  const follow = (ghost: HTMLElement, event: PointerEvent) => {
    ghost.style.transform = `translate(${event.clientX - ghost.offsetWidth / 2}px, ${event.clientY - ghost.offsetHeight / 2}px)`;
  };

  return (key: string) => ({
    onPointerDown(event: PointerEvent<HTMLElement>) {
      const row = event.currentTarget.closest<HTMLElement>(SLOT_SELECTOR);
      if (!row) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const ghost = row.cloneNode(true) as HTMLElement;
      ghost.removeAttribute(SLOT_ATTRIBUTE);
      ghost.setAttribute("aria-hidden", "true");
      ghost.querySelectorAll("button").forEach((button) => (button.tabIndex = -1));
      Object.assign(ghost.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: `${row.offsetWidth}px`,
        zIndex: "100",
        pointerEvents: "none",
        opacity: "0.9",
      });
      document.body.append(ghost);
      follow(ghost, event);
      drag.current = { key, ghost };
    },
    onPointerMove(event: PointerEvent) {
      if (drag.current) follow(drag.current.ghost, event);
    },
    onPointerUp(event: PointerEvent) {
      const over = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(SLOT_SELECTOR);
      if (drag.current && over?.getAttribute(SLOT_ATTRIBUTE))
        onDrop(drag.current.key, over.getAttribute(SLOT_ATTRIBUTE)!);
      end();
    },
    onPointerCancel: end,
  });
}
