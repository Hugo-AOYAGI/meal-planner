import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The phone's back action closes what is on top first (a menu, a sheet, the assistant…), then leaves the tab, then
 * the app. Each open layer owns one history entry above the page's; every entry records `depth`, the number of layers
 * open under it, so going back to an entry closes the layers above its depth. A layer closed on screen (✕, tap
 * outside) gives its entry back.
 */
interface Layer {
  /** closes the layer; `false` keeps it open (it asks first, see the meal editor) */
  onBack: () => boolean | void;
}

const stack: Layer[] = [];
const depthOf = () => (history.state as { depth?: number } | null)?.depth ?? 0;

/** State for a history entry made at the current depth (by a tab change, a link...). */
export const entryState = (extra: object = {}) => ({ ...extra, depth: stack.length });

let syncing = false;
/** Layers closed on screen: once they have all closed (same tick), go back past their entries. */
function giveBackEntries() {
  if (syncing) return;
  syncing = true;
  setTimeout(() => {
    syncing = false;
    const extra = depthOf() - stack.length;
    if (extra > 0) history.go(-extra);
  }, 0);
}

/** An entry without depth is a new one made by an in-app link (`<a href="#repas/12">`): it opens at the current depth. */
function tagLinkEntry(): boolean {
  if ((history.state as { depth?: number } | null)?.depth !== undefined) return false;
  history.replaceState(entryState({ ...(history.state ?? {}), linked: true }), "");
  return true;
}

if (typeof window !== "undefined") {
  // the entry the app opened on: depth 0 (not a link)
  if ((history.state as { depth?: number } | null)?.depth === undefined) history.replaceState(entryState(history.state ?? {}), "");
  window.addEventListener("popstate", () => {
    if (tagLinkEntry()) return; // following a link, not going back
    const target = depthOf();
    while (stack.length > target) {
      const top = stack.at(-1)!;
      if (top.onBack() === false) {
        history.pushState(entryState(), ""); // it stays open: it keeps an entry
        return;
      }
      stack.pop(); // closing now: its cleanup must not give an entry back again
    }
  });
  window.addEventListener("hashchange", () => void tagLinkEntry());
}

/** While `active`, the back action calls `onBack` (which closes the layer, or returns `false` to stay). */
export function useBackLayer(active: boolean, onBack: () => boolean | void): void {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!active) return;
    const layer: Layer = { onBack: () => latest.current() };
    stack.push(layer);
    history.pushState(entryState(), "");
    return () => {
      const i = stack.indexOf(layer);
      if (i < 0) return; // closed by the back action: its entry is already gone
      stack.splice(i, 1);
      giveBackEntries();
    };
  }, [active]);
}

interface OpenProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** For an overlay root (sheet, dialog, popover): its open state, controlled or not, closed by the back action. */
export function useBackDismiss({ open, defaultOpen, onOpenChange }: OpenProps, enabled = true) {
  const [inner, setInner] = useState(defaultOpen ?? false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : inner;
  const change = useCallback(
    (next: boolean) => {
      if (!controlled) setInner(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );
  useBackLayer(enabled && isOpen, () => change(false));
  return { open: isOpen, onOpenChange: change };
}
