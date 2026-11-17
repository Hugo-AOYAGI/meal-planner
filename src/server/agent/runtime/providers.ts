import { query } from "@anthropic-ai/claude-agent-sdk";
import { Codex } from "@openai/codex-sdk";
import type { UIMessage, UIMessageChunk } from "ai";
import type { Assistant } from "@shared/constants";
import { toUIChunks } from "../bridge";
import { CODEX_MODEL, runCodex } from "./codex";
import { agentDir, runAgent, type RunInput } from "./run";

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

/**
 * A small one-shot question to the chosen assistant, without tools nor session (sorting a shopping line...):
 * a light model, the plain text of the answer.
 */
export async function askOnce(assistant: Assistant, prompt: string): Promise<string> {
  if (assistant === "codex") {
    const thread = new Codex({ config: { features: { shell_tool: false, plugins: false, apps: false, hooks: false } } }).startThread({
      model: CODEX_MODEL,
      modelReasoningEffort: "low",
      sandboxMode: "read-only",
      approvalPolicy: "never",
      skipGitRepoCheck: true,
      workingDirectory: agentDir(),
    });
    return (await thread.run(prompt)).finalResponse;
  }
  const q = query({
    prompt,
    options: {
      model: process.env.MEAL_PLANNER_QUICK_MODEL ?? "claude-haiku-5-5",
      systemPrompt: "Tu réponds exactement dans le format demandé, sans rien d'autre.",
      tools: [],
      maxTurns: 1,
      permissionMode: "dontAsk",
      settingSources: [],
      strictMcpConfig: true,
      cwd: agentDir(),
      env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", ENABLE_CLAUDEAI_MCP_SERVERS: "false" },
    },
  });
  try {
    for await (const m of q) {
      if (m.type !== "result") continue;
      if (m.subtype !== "success" || m.is_error) throw new Error(`askOnce: ${m.subtype}`);
      return m.result;
    }
    throw new Error("askOnce: no result");
  } finally {
    q.close();
  }
}
