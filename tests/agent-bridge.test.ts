import { expect, test } from "bun:test";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { toUIChunks } from "@server/agent/bridge";
import { appTools } from "@server/agent/tools";

const ev = (event: object) => ({ type: "stream_event", event, session_id: "s1" }) as unknown as SDKMessage;

test("bridge maps Agent SDK messages to UI message chunks", async () => {
  const messages = [
    { type: "system", subtype: "init", session_id: "s1" },
    ev({ type: "message_start", message: { id: "m1" } }),
    ev({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
    ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Salut" } }),
    ev({ type: "content_block_stop", index: 0 }),
    ev({ type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "t1", name: "mcp__app__list_meals", input: {} } }),
    { type: "assistant", message: { id: "m1", content: [{ type: "tool_use", id: "t1", name: "mcp__app__list_meals", input: { q: "a" } }] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: '[{"id":1}]' }] }] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t2", is_error: true, content: "Repas introuvable (9)" }] } },
  ] as unknown as SDKMessage[];
  const sessions: string[] = [];
  const chunks = [];
  for await (const c of toUIChunks(messages as unknown as AsyncIterable<SDKMessage>, (id) => sessions.push(id))) chunks.push(c);
  expect(chunks.map((c) => c.type)).toEqual([
    "text-start", "text-delta", "text-end", "tool-input-start", "tool-input-available", "tool-output-available", "tool-output-error",
  ]);
  expect(chunks[5]).toMatchObject({ toolCallId: "t1", output: [{ id: 1 }] });
  expect(sessions[0]).toBe("s1");
});

test("app tools return the French error message instead of throwing", async () => {
  const getMeal = appTools.find((t) => t.name === "get_meal")!;
  const res = await getMeal.handler({ id: 9999 }, {});
  expect(res.isError).toBe(true);
  expect((res.content[0] as { text: string }).text).toContain("introuvable");
});
