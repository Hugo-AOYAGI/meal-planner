import { randomUUID } from "node:crypto";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import type { ChatConversation, ChatConversationSummary } from "@shared/schemas";
import { db } from "../../db";
import { chatConversation, chatMessage } from "../../db/schema";

/** The conversation with this id, or a new one when `id` is missing or unknown. */
export function getOrCreateConversation(id?: string | null): ChatConversation {
  const existing = id ? db.select().from(chatConversation).where(eq(chatConversation.id, id)).get() : undefined;
  const row = existing ?? db.insert(chatConversation).values({ id: randomUUID() }).returning().get();
  return { id: row.id, sessionId: row.sessionId };
}

/** Remembers the Agent SDK session id so the next message can `resume` it. */
export function saveSessionId(conversationId: string, sessionId: string): void {
  db.update(chatConversation).set({ sessionId }).where(eq(chatConversation.id, conversationId)).run();
}

export function loadMessages(conversationId: string): UIMessage[] {
  return db
    .select({ message: chatMessage.message })
    .from(chatMessage)
    .where(eq(chatMessage.conversationId, conversationId))
    .orderBy(asc(chatMessage.seq))
    .all()
    .map((r) => r.message as UIMessage);
}

const TITLE_MAX = 60;

/** Conversations with at least one message, newest activity first. The title is the first user message. */
export function listConversations(): ChatConversationSummary[] {
  // raw table names: drizzle would render the outer column unqualified, and it would resolve to the inner table
  const firstUserMessage = sql<string | null>`(
    select m.message from chat_message m
    where m.conversation_id = chat_conversation.id and json_extract(m.message, '$.role') = 'user'
    order by m.seq limit 1)`.mapWith((v) => (v ? (JSON.parse(v) as UIMessage) : null));
  return db
    .select({ id: chatConversation.id, updatedAt: chatConversation.updatedAt, first: firstUserMessage })
    .from(chatConversation)
    .where(sql`exists (select 1 from chat_message m where m.conversation_id = chat_conversation.id)`)
    .orderBy(desc(chatConversation.updatedAt), desc(chatConversation.createdAt))
    .all()
    .map(({ id, updatedAt, first }) => {
      const text = first?.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join(" ").replace(/\s+/g, " ").trim();
      const title = !text ? "Photo" : text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1).trimEnd()}…` : text;
      return { id, title, updatedAt };
    });
}

/** Deletes a conversation and, by cascade, its messages. False when it does not exist. */
export function deleteConversation(id: string): boolean {
  return db.delete(chatConversation).where(eq(chatConversation.id, id)).returning({ id: chatConversation.id }).all().length > 0;
}

/** Inserts messages, or overwrites those whose id is already stored (keeping their position). */
export function appendMessages(conversationId: string, messages: UIMessage[]): void {
  if (!messages.length) return;
  db.update(chatConversation).set({ updatedAt: new Date().toISOString() }).where(eq(chatConversation.id, conversationId)).run();
  db.insert(chatMessage)
    .values(messages.map((m) => ({ id: m.id, conversationId, message: m })))
    .onConflictDoUpdate({ target: [chatMessage.conversationId, chatMessage.id], set: { message: sql`excluded.message` } })
    .run();
}
