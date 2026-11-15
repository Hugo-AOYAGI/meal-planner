import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invalidate } from "@/lib/api/query";
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

/** The API answers `{ error }` (409 "occupé") as the error message's text. */
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
      select((part.data as { id: string }).id);
    },
    onFinish: () => void invalidate.all(queryClient), // also refreshes the history list
  });
  const { messages, setMessages, clearError, resumeStream } = chat;

  /** The turn runs on the server and survives this page: stopping it takes a request, not just dropping the stream. */
  const stop = useCallback(async () => {
    await fetch("/api/chat/stop", { method: "POST" }).catch(() => {});
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

  // refresh the screens after each write tool, not only at the end of the run
  useEffect(() => {
    const n = doneWrites(messages);
    if (n > writes.current) void invalidate.all(queryClient);
    writes.current = n;
  }, [messages, queryClient]);

  const send = useCallback((text: string, files: FileUIPart[]) => chat.sendMessage({ text, files }), [chat.sendMessage]);

  const reset = useCallback(() => {
    void stop();
    clearError();
    setMessages([]);
    writes.current = 0;
    select(null);
  }, [stop, clearError, setMessages, select]);

  /** Reopens a past conversation; the next message resumes it. */
  const open = useCallback(
    async (id: string) => {
      void stop();
      clearError();
      select(id);
      await load(id, true);
    },
    [stop, clearError, select, load],
  );

  const busy = chat.status === "submitted" || chat.status === "streaming";
  return { messages, status: chat.status, busy, error: chat.error ? errorText(chat.error) : null, conversationId: currentId, send, stop, reset, open };
}
