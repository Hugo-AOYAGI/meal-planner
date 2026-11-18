import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Codex, type ThreadEvent, type ThreadItem } from "@openai/codex-sdk";
import type { UIMessageChunk } from "ai";
import { DB_PATH } from "../../db";
import { toolOutput } from "../bridge";
import { systemPrompt } from "../prompt";
import { foodLabReference } from "../reference/food-lab";
import { agentDir, type RunInput } from "./run";

export const CODEX_MODEL = process.env.MEAL_PLANNER_CODEX_MODEL ?? "gpt-6.1-terra";

/**
 * Codex runs as its own process: it reaches the app tools through the stdio MCP server, pre-approved.
 * Shell, plugins, apps and hooks are off, so tools come from the configured MCP servers and web search.
 */
const codex = () => {
  const foodLab = foodLabReference();
  return new Codex({
    config: {
      developer_instructions: systemPrompt(foodLab?.contents),
      mcp_servers: {
        app: {
          command: process.execPath,
          args: [resolve(import.meta.dir, "mcp-stdio.ts")],
          env: { DB_PATH: resolve(DB_PATH) },
          default_tools_approval_mode: "approve",
        },
        ...(foodLab ? { food_lab: { ...foodLab.server, default_tools_approval_mode: "approve" } } : {}),
      },
      features: {
        shell_tool: false,
        plugins: false,
        apps: false,
        hooks: false,
      },
    },
  });
};

/** Codex reads images from disk: they are written next to the session and removed after the turn. */
function writeImages(images: RunInput["images"]): {
  paths: string[];
  cleanup: () => void;
} {
  if (!images.length) return { paths: [], cleanup: () => {} };
  const dir = join(agentDir(), `img-${randomUUID()}`);
  mkdirSync(dir);
  const paths = images.map((image, i) => {
    const path = join(
      dir,
      `${i}.${image.mediaType.split("/")[1]?.replace(/\W.*/, "") || "jpg"}`,
    );
    writeFileSync(path, Buffer.from(image.data, "base64"));
    return path;
  });
  return {
    paths,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** One thread item as UI chunks. Agent message updates carry cumulative text. */
function* itemChunks(
  phase: "started" | "updated" | "completed",
  item: ThreadItem,
  run: string,
  open: Set<string>,
  textLengths: Map<string, number>,
): Generator<UIMessageChunk> {
  const id = `${run}-${item.id}`;
  const tool =
    item.type === "mcp_tool_call"
      ? { name: `mcp__${item.server}__${item.tool}`, input: item.arguments }
      : item.type === "web_search"
        ? { name: "WebSearch", input: { query: item.query } }
        : null;
  if (tool) {
    if (!open.has(id)) {
      open.add(id);
      yield {
        type: "tool-input-start",
        toolCallId: id,
        toolName: tool.name,
        dynamic: true,
      };
      yield {
        type: "tool-input-available",
        toolCallId: id,
        toolName: tool.name,
        input: tool.input,
        dynamic: true,
      };
    }
    if (phase !== "completed") return;
    if (item.type === "mcp_tool_call" && item.error)
      yield {
        type: "tool-output-error",
        toolCallId: id,
        errorText: item.error.message,
        dynamic: true,
      };
    else
      yield {
        type: "tool-output-available",
        toolCallId: id,
        output:
          item.type === "mcp_tool_call"
            ? toolOutput(item.result?.content)
            : null,
        dynamic: true,
      };
  } else if (item.type === "agent_message") {
    const length = textLengths.get(id);
    if (length === undefined && !item.text) return;
    if (length === undefined) yield { type: "text-start", id };
    const delta = item.text.slice(length ?? 0);
    if (delta) yield { type: "text-delta", id, delta };
    if (phase === "completed") {
      textLengths.delete(id);
      yield { type: "text-end", id };
    } else {
      textLengths.set(id, Math.max(length ?? 0, item.text.length));
    }
  }
}

/** Runs one Codex turn as UI chunks. When resuming fails before anything was produced, retries once on a new thread. */
export async function* runCodex(
  input: RunInput,
  onSession: (id: string) => void,
): AsyncGenerator<UIMessageChunk> {
  const options = {
    model: CODEX_MODEL,
    modelReasoningEffort: "medium",
    sandboxMode: "read-only",
    approvalPolicy: "never",
    webSearchMode: "live",
    skipGitRepoCheck: true,
    workingDirectory: agentDir(),
  } as const;
  const { paths, cleanup } = writeImages(input.images);
  const prompt = [
    { type: "text" as const, text: input.text || "Voici une photo." },
    ...paths.map((path) => ({ type: "local_image" as const, path })),
  ];
  const run = randomUUID().slice(0, 8);
  try {
    for (const resume of input.sessionId ? [input.sessionId, null] : [null]) {
      const thread = resume
        ? codex().resumeThread(resume, options)
        : codex().startThread(options);
      const open = new Set<string>();
      const textLengths = new Map<string, number>();
      let produced = false;
      const failed = (): UIMessageChunk | null =>
        resume && !produced
          ? null
          : { type: "error", errorText: "Une erreur est survenue, réessayez." };
      try {
        const { events } = await thread.runStreamed(prompt, {
          signal: input.signal,
        });
        let retry = false;
        for await (const e of events as AsyncGenerator<ThreadEvent>) {
          if (e.type === "thread.started") onSession(e.thread_id);
          else if (e.type === "item.started" || e.type === "item.updated" || e.type === "item.completed") {
            for (const chunk of itemChunks(
              e.type === "item.started" ? "started" : e.type === "item.updated" ? "updated" : "completed",
              e.item,
              run,
              open,
              textLengths,
            )) {
              produced = true;
              yield chunk;
            }
          } else if (e.type === "turn.failed" || e.type === "error") {
            console.error(
              "codex:",
              e.type === "error" ? e.message : e.error.message,
            );
            const chunk = failed();
            if (chunk) yield chunk;
            else retry = true;
            break;
          }
        }
        if (!retry) return;
      } catch (e) {
        if (input.signal.aborted) throw e;
        const chunk = failed();
        if (!chunk) continue; // resume failed: retry fresh
        throw e;
      }
    }
  } finally {
    cleanup();
  }
}
