import type { UIMessage, UIMessageChunk } from "ai";
import type { Assistant } from "@shared/constants";
import { toUIChunks } from "../bridge";
import { runCodex } from "./codex";
import { runAgent, type RunInput } from "./run";

/** A conversation stores one session id; Codex ones carry this prefix so each assistant only resumes its own. */
const CODEX = "codex:";
const MAX_CONTEXT = 8000;

/** What was said so far, for an assistant that takes over a conversation it has no session for. */
function transcript(history: UIMessage[]): string {
  const lines = history.flatMap((m) => {
    const text = m.parts
      .flatMap((p) => (p.type === "text" ? [p.text] : []))
      .join("\n")
      .trim();
    return text
      ? [`${m.role === "user" ? "Utilisateur" : "Assistant"} : ${text}`]
      : [];
  });
  return lines.join("\n\n").slice(-MAX_CONTEXT);
}

interface Turn {
  assistant: Assistant;
  input: Pick<RunInput, "text" | "images" | "signal">;
  /** the conversation's stored session id (either assistant's), and its messages before this one */
  storedSession: string | null;
  history: UIMessage[];
  saveSession: (id: string) => void;
}

/** One turn with the chosen assistant, as UI chunks. Resumes its own session; otherwise starts one with the transcript as context. */
export function runTurn({
  assistant,
  input,
  storedSession,
  history,
  saveSession,
}: Turn): AsyncGenerator<UIMessageChunk> {
  const isCodex = storedSession?.startsWith(CODEX) ?? false;
  const sessionId =
    !storedSession || isCodex !== (assistant === "codex")
      ? null
      : isCodex
        ? storedSession.slice(CODEX.length)
        : storedSession;
  const context = sessionId ? "" : transcript(history);
  const text = context
    ? `Conversation jusqu'ici :\n\n${context}\n\nNouveau message :\n\n${input.text}`
    : input.text;
  const run: RunInput = { ...input, text, sessionId };
  return assistant === "codex"
    ? runCodex(run, (id) => saveSession(CODEX + id))
    : toUIChunks(runAgent(run), saveSession);
}
