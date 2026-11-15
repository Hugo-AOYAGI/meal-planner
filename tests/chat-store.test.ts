import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { appendMessages, deleteConversation, getOrCreateConversation, listConversations, loadMessages } from "@server/services/support/chat-store";

const msg = (id: string, role: "user" | "assistant", text: string): UIMessage => ({ id, role, parts: [{ type: "text", text }] });

test("listConversations: titled by the first user message, newest activity first, empty ones hidden", async () => {
  const a = getOrCreateConversation();
  const b = getOrCreateConversation();
  getOrCreateConversation(); // no message: not listed
  appendMessages(a.id, [msg("a1", "user", `  Une idée de   dîner ${"très ".repeat(30)}léger  `), msg("a2", "assistant", "Voici")]);
  await Bun.sleep(5);
  appendMessages(b.id, [msg("b1", "user", "Courses")]);
  await Bun.sleep(5);
  appendMessages(a.id, [msg("a3", "user", "Merci")]); // activity in a: it moves first

  const list = listConversations();
  expect(list.map((c) => c.id)).toEqual([a.id, b.id]);
  expect(list[1]!.title).toBe("Courses");
  expect(list[0]!.title.length).toBeLessThanOrEqual(60);
  expect(list[0]!.title.startsWith("Une idée de dîner très")).toBe(true);
  expect(list[0]!.title.endsWith("…")).toBe(true);
  expect(Date.parse(list[0]!.updatedAt)).toBeGreaterThan(Date.parse(list[1]!.updatedAt));

  expect(deleteConversation(a.id)).toBe(true);
  expect(deleteConversation(a.id)).toBe(false);
  expect(loadMessages(a.id)).toEqual([]); // cascade
  expect(listConversations().map((c) => c.id)).toEqual([b.id]);
});
