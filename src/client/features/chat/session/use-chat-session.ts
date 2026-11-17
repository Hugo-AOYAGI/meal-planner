import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invalidate } from "@/lib/api/query";
import { onChatEvent } from "@/lib/hooks/use-live-updates";
import { isWriteTool } from "@/features/chat/messages/tool-label";

const KEY = "meal-planner.conversation";

const stored = {
  get: () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (id: string | null) => {
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable: the conversation just won't survive a reload */
    }
  },
};

/** The API answers `{ error }` as the error message's text. */
function errorText(error: Error) {
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    /* plain message */
  }
  return error.message;
}

const doneWrites = (messages: UIMessage[]) =>
  messages.flatMap((m) => m.parts).filter((p) => p.type === "dynamic-tool" && p.state === "output-available" && isWriteTool(p.toolName)).length;

/** useChat wired to /api/chat, with the conversation id kept in localStorage and history loaded on mount. */
export function useChatSession() {
  const queryClient = useQueryClient();
  const conversationId = useRef<string | null>(stored.get());
  const [currentId, setCurrentId] = useState<string | null>(conversationId.current);
  const select = useCallback((id: string | null) => {
    conversationId.current = id;
    setCurrentId(id);
    stored.set(id);
  }, []);
  const writes = useRef(0);
  /** The message sent waits for another turn to end. */
  const [queued, setQueued] = useState(false);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // the server keeps the history: send only the new message
        prepareSendMessagesRequest: ({ messages }) => ({ body: { conversationId: conversationId.current, messages: messages.slice(-1) } }),
        prepareReconnectToStreamRequest: () => ({ api: `/api/chat/${conversationId.current}/stream` }),
      }),
    [],
  );
  const chat = useChat({
    transport,
    onData: (part) => {
      if (part.type !== "data-conversation") return;
      const data = part.data as { id: string; queued?: boolean };
      select(data.id);
      setQueued(!!data.queued);
    },
    onFinish: () => void invalidate.all(queryClient), // also refreshes the history list
  });
  const { messages, setMessages, clearError, resumeStream } = chat;
  const busy = chat.status === "submitted" || chat.status === "streaming";
  const following = useRef(busy);
  following.current = busy;
  useEffect(() => {
    if (!busy) setQueued(false);
  }, [busy]);

  /** The turn runs on the server and survives this page: stopping it takes a request, not just dropping the stream. Also stops a turn sent from another device in this conversation. */
  const stop = useCallback(async () => {
    const id = conversationId.current;
    if (id) await fetch(`/api/chat/${id}/stop`, { method: "POST" }).catch(() => {});
    await chat.stop();
  }, [chat.stop]);

  /** Shows the stored messages of a conversation, then follows its turn if one is still running. One that no longer exists (deleted elsewhere) quietly becomes a new one. */
  const load = useCallback(
    async (id: string, replace: boolean) => {
      try {
        const res = await fetch(`/api/chat/${id}`);
        if (!res.ok) return;
        const history = (await res.json()) as UIMessage[];
        if (!history.length) {
          if (conversationId.current === id) select(null);
          return;
        }
        writes.current = doneWrites(history);
        setMessages((current) => (replace || !current.length ? history : current));
        void resumeStream();
      } catch {
        /* offline: keep what is shown */
      }
    },
    [setMessages, select, resumeStream],
  );

  useEffect(() => {
    if (conversationId.current) void load(conversationId.current, false);
  }, [load]);

  // back on the page (phone unlocked, app reopened): the stream may have died meanwhile, so pick the turn up from the server
  useEffect(() => {
    const onVisible = async () => {
      const id = conversationId.current;
      if (document.visibilityState !== "visible" || !id) return;
      await chat.stop();
      clearError();
      await load(id, true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [chat.stop, clearError, load]);

  // a turn sent from another device in this conversation: show it as it goes (ours is already followed by its request)
  useEffect(
    () =>
      onChatEvent(({ conversationId: id, phase }) => {
        if (phase !== "start" || id !== conversationId.current || following.current) return;
        clearError();
        void load(id, true);
      }),
    [clearError, load],
  );

  // refresh the screens after each write tool, not only at the end of the run
  useEffect(() => {
    const n = doneWrites(messages);
    if (n > writes.current) void invalidate.all(queryClient);
    writes.current = n;
  }, [messages, queryClient]);

  const send = useCallback((text: string, files: FileUIPart[]) => chat.sendMessage({ text, files }), [chat.sendMessage]);

  /** Leaving a conversation leaves its turn running on the server (it may be someone else's): only the stream is dropped. */
  const reset = useCallback(() => {
    void chat.stop();
    clearError();
    setMessages([]);
    writes.current = 0;
    select(null);
  }, [chat.stop, clearError, setMessages, select]);

  /** Reopens a past conversation; the next message resumes it. */
  const open = useCallback(
    async (id: string) => {
      void chat.stop();
      clearError();
      select(id);
      await load(id, true);
    },
    [chat.stop, clearError, select, load],
  );

  return { messages, status: chat.status, busy, queued, error: chat.error ? errorText(chat.error) : null, conversationId: currentId, send, stop, reset, open };
}
