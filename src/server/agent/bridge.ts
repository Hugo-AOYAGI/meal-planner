import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { UIMessageChunk } from "ai";

const MAX_OUTPUT = 2000;

/** Tool results arrive as a string or a list of text blocks; keep JSON structured when possible and bound the size. */
export function toolOutput(content: unknown): unknown {
  const text = Array.isArray(content) ? content.map((b) => (b?.type === "text" ? b.text : "")).join("") : String(content ?? "");
  if (text.length > MAX_OUTPUT) return text.slice(0, MAX_OUTPUT) + "…";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Maps Agent SDK messages onto AI SDK UI message chunks (not including `start`/`finish`).
 * Text comes from partial stream events; tool calls and results from the complete messages.
 */
export async function* toUIChunks(messages: AsyncIterable<SDKMessage>, onSession: (id: string) => void): AsyncGenerator<UIMessageChunk> {
  let msgId = "";
  const textBlocks = new Set<string>(); // ids of open text blocks
  for await (const m of messages) {
    if ("session_id" in m && m.session_id) onSession(m.session_id);
    if (m.type === "stream_event") {
      const e = m.event;
      const id = `${msgId}-${"index" in e ? e.index : ""}`;
      if (e.type === "message_start") msgId = e.message.id;
      else if (e.type === "content_block_start" && e.content_block.type === "text") {
        textBlocks.add(id);
        yield { type: "text-start", id };
      } else if (e.type === "content_block_start" && e.content_block.type === "tool_use") {
        yield { type: "tool-input-start", toolCallId: e.content_block.id, toolName: e.content_block.name, dynamic: true };
      } else if (e.type === "content_block_delta" && e.delta.type === "text_delta") {
        yield { type: "text-delta", id, delta: e.delta.text };
      } else if (e.type === "content_block_stop" && textBlocks.delete(id)) {
        yield { type: "text-end", id };
      }
    } else if (m.type === "assistant") {
      for (const b of m.message.content) {
        if (b.type === "tool_use") yield { type: "tool-input-available", toolCallId: b.id, toolName: b.name, input: b.input, dynamic: true };
      }
    } else if (m.type === "user" && Array.isArray(m.message.content)) {
      for (const b of m.message.content) {
        if (b.type !== "tool_result") continue;
        const output = toolOutput(b.content);
        yield b.is_error
          ? { type: "tool-output-error", toolCallId: b.tool_use_id, errorText: typeof output === "string" ? output : JSON.stringify(output), dynamic: true }
          : { type: "tool-output-available", toolCallId: b.tool_use_id, output, dynamic: true };
      }
    } else if (m.type === "result" && m.is_error) {
      yield { type: "error", errorText: "Une erreur est survenue, réessayez." };
    }
  }
}
