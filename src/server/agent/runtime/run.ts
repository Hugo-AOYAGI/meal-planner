import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { query, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { DB_PATH } from "../../db";
import { systemPrompt } from "../prompt";
import { foodLabReference } from "../reference/food-lab";
import { appServer } from "../tools";

export type RunInput = {
  text: string;
  /** base64 images (no data: prefix) */
  images: { mediaType: string; data: string }[];
  /** Agent SDK session to resume */
  sessionId: string | null;
  signal: AbortSignal;
};

/** Fixed working directory next to the database, so sessions resume. */
export const agentDir = () => {
  const dir = resolve(dirname(DB_PATH), "agent");
  mkdirSync(dir, { recursive: true });
  return dir;
};

async function* userMessage({ text, images }: RunInput): AsyncGenerator<SDKUserMessage> {
  yield {
    type: "user",
    parent_tool_use_id: null,
    session_id: "",
    message: {
      role: "user",
      content: [
        { type: "text", text: text || "Voici une photo." },
        ...images.map((i) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: i.mediaType as "image/jpeg", data: i.data },
        })),
      ],
    },
  };
}

function start(input: RunInput, resume: string | null) {
  const foodLab = foodLabReference();
  const abortController = new AbortController();
  input.signal.addEventListener("abort", () => abortController.abort(), { once: true });
  return query({
    prompt: input.images.length ? userMessage(input) : input.text,
    options: {
      model: process.env.MEAL_PLANNER_MODEL ?? "claude-sonnet-5-5",
      effort: "medium",
      systemPrompt: systemPrompt(foodLab?.contents),
      tools: ["WebSearch", "WebFetch"],
      allowedTools: [
        "WebSearch", "WebFetch", "mcp__app__*",
        ...(foodLab ? ["mcp__food_lab__search_sections", "mcp__food_lab__search", "mcp__food_lab__read_section"] : []),
      ],
      mcpServers: { app: appServer, ...(foodLab ? { food_lab: foodLab.server } : {}) },
      permissionMode: "dontAsk",
      settingSources: [],
      strictMcpConfig: true,
      includePartialMessages: true,
      cwd: agentDir(),
      abortController,
      env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", ENABLE_CLAUDEAI_MCP_SERVERS: "false" },
      ...(resume ? { resume } : {}),
    },
  });
}

/** Runs one agent turn. When resuming fails before anything was produced (unknown session), retries once without `resume`. */
export async function* runAgent(input: RunInput): AsyncGenerator<SDKMessage> {
  for (const resume of input.sessionId ? [input.sessionId, null] : [null]) {
    const q = start(input, resume);
    let produced = false;
    try {
      for await (const m of q) {
        if (m.type === "stream_event" || m.type === "assistant") produced = true;
        if (resume && !produced && m.type === "result" && m.is_error) break; // resume failed: retry fresh
        yield m;
        if (m.type === "result") return;
      }
      if (produced || !resume) return;
    } catch (e) {
      if (produced || !resume || input.signal.aborted) throw e;
    } finally {
      q.close();
    }
  }
}
