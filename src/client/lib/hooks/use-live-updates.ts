import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { clientId } from "@/lib/api/api";
import { invalidate, keys } from "@/lib/api/query";

const DEBOUNCE_MS = 300;
const RETRY_MS = 5_000;

export interface ChatEvent {
  conversationId: string;
  phase: "start" | "end";
}

const chatListeners = new Set<(event: ChatEvent) => void>();

/** Calls `listener` when a turn of the assistant starts or ends, whoever sent it. Returns the unsubscribe. */
export function onChatEvent(listener: (event: ChatEvent) => void) {
  chatListeners.add(listener);
  return () => void chatListeners.delete(listener);
}

/**
 * Refreshes every query when another device (or the assistant) changes the data: one EventSource on /api/events.
 * A `draw` event (a move in the draw game, from any device) refreshes the game views only.
 * Relays the assistant's turn events to `onChatEvent` listeners.
 * Also refreshes when the page comes back (a sleeping phone missed events) and when the stream reconnects.
 * Mount once, at the app root.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let source: EventSource | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let opened = false;

    const refresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void invalidate.all(queryClient), DEBOUNCE_MS);
    };
    const connect = () => {
      clearTimeout(retry);
      source?.close();
      const es = new EventSource("/api/events");
      source = es;
      es.addEventListener("changed", (e) => {
        if (e.data !== clientId) refresh(); // our own writes already refreshed this screen
      });
      es.addEventListener("draw", () => void queryClient.invalidateQueries({ queryKey: keys.game.all }));
      es.addEventListener("chat", (e) => {
        refresh(); // the history list: a conversation appeared or moved up
        const event = JSON.parse(e.data) as ChatEvent;
        for (const listener of chatListeners) listener(event);
      });
      es.onopen = () => {
        if (opened) refresh(); // reconnection: events were missed meanwhile
        opened = true;
      };
      // EventSource retries a dropped stream by itself, but gives up on an HTTP error (proxy 502 while the server restarts)
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) retry = setTimeout(connect, RETRY_MS);
      };
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (source?.readyState === EventSource.CLOSED) connect();
      refresh();
    };

    connect();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(debounce);
      clearTimeout(retry);
      source?.close();
    };
  }, [queryClient]);
}
