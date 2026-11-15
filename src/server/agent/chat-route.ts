import { zValidator } from "@hono/zod-validator";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { appendMessages, deleteConversation, getOrCreateConversation, listConversations, loadMessages, saveSessionId } from "../services/support/chat-store";
import { emitChanged } from "../events";
import { getSettings } from "../services/support/settings";
import { follow, isBusy, liveRun, startRun, stopRun } from "./runtime/live-run";
import { runTurn } from "./runtime/providers";
import type { RunInput } from "./runtime/run";

/** What `useChat` sends (the client trims `messages` to the new one) plus the conversation id. */
const bodySchema = z.object({
  conversationId: z.string().nullish(),
  messages: z.array(z.custom<UIMessage>((m) => typeof m === "object" && m !== null && "parts" in m)).min(1),
});

function toRunInput(message: UIMessage): Pick<RunInput, "text" | "images"> {
  const text = message.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");
  const images = message.parts.flatMap((p) => {
    const m = p.type === "file" ? /^data:(image\/[\w.+-]+);base64,(.*)$/s.exec(p.url) : null;
    return m ? [{ mediaType: m[1]!, data: m[2]! }] : [];
  });
  return { text, images };
}

/** Images are not stored: keep the file part (name, type) with an empty url. */
const withoutImageData = (m: UIMessage): UIMessage => ({
  ...m,
  parts: m.parts.map((p) => (p.type === "file" ? { ...p, url: "" } : p)),
});

export const chatRoute = new Hono()
  .post("/", zValidator("json", bodySchema), (c) => {
    const { conversationId, messages } = c.req.valid("json");
    const userMessage = messages.at(-1)!;
    if (userMessage.role !== "user") return c.json({ error: "Message invalide" }, 400);
    if (isBusy()) return c.json({ error: "L'assistant est occupé, réessayez dans un instant." }, 409);

    const conversation = getOrCreateConversation(conversationId);
    const history = loadMessages(conversation.id);
    appendMessages(conversation.id, [withoutImageData(userMessage)]);
    // the run outlives this request: the response only follows it, and so can a later reconnection
    const run = startRun(conversation.id, (signal) =>
      createUIMessageStream({
        originalMessages: [userMessage],
        execute: async ({ writer }) => {
          try {
            writer.write({ type: "data-conversation", data: { id: conversation.id }, transient: true });
            writer.write({ type: "start" });
            const turn = runTurn({
              assistant: getSettings().assistant,
              input: { ...toRunInput(userMessage), signal },
              storedSession: conversation.sessionId,
              history,
              saveSession: (id) => saveSessionId(conversation.id, id),
            });
            for await (const chunk of turn) {
              writer.write(chunk);
              // the tools write outside the HTTP routes: tell the other browsers after each one
              if (chunk.type === "tool-output-available") emitChanged();
            }
            writer.write({ type: "finish" });
          } catch (e) {
            if (!signal.aborted) {
              console.error(e);
              writer.write({ type: "error", errorText: "L'assistant n'a pas pu répondre, réessayez." });
            }
          }
        },
        onFinish: ({ responseMessage }) => {
          if (responseMessage.parts.length) appendMessages(conversation.id, [responseMessage]);
        },
      }),
    );
    return createUIMessageStreamResponse({ stream: follow(run) });
  })
  .post("/stop", (c) => {
    stopRun();
    return c.body(null, 204);
  })
  /** The turn in progress for this conversation, replayed from its start; 204 when there is none. */
  .get("/:conversationId/stream", (c) => {
    const run = liveRun(c.req.param("conversationId"));
    return run ? createUIMessageStreamResponse({ stream: follow(run) }) : c.body(null, 204);
  })
  .get("/", (c) => c.json(listConversations()))
  .get("/:conversationId", (c) => c.json(loadMessages(c.req.param("conversationId"))))
  .delete("/:conversationId", (c) => (deleteConversation(c.req.param("conversationId")) ? c.body(null, 204) : c.json({ error: "Conversation introuvable" }, 404)));
