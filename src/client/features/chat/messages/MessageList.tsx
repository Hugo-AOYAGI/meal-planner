import type { ChatStatus, DynamicToolUIPart, FileUIPart, UIMessage } from "ai";
import { ImageIcon } from "lucide-react";
import { Attachment, AttachmentContent, AttachmentMedia, AttachmentTitle } from "@/components/ui/chat/attachment";
import { Bubble, BubbleContent } from "@/components/ui/chat/bubble";
import { Message, MessageContent } from "@/components/ui/chat/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/chat/message-scroller";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceLine, TraceTitle } from "@/components/ui/chat/trace";
import { Markdown, type OpenReference } from "@/features/chat/messages/Markdown";
import { MealCard } from "@/features/chat/messages/MealCard";
import { mealIdOf, toolLabel } from "@/features/chat/messages/tool-label";

type Part = UIMessage["parts"][number];

function ToolRow({ part, live }: { part: DynamicToolUIPart; live: boolean }) {
  const state = part.state === "output-available" ? "done" : part.state === "output-error" ? "error" : "running";
  const status = state === "error" ? "error" : state === "running" ? (live ? "running" : "pending") : undefined;
  const text = toolLabel(part.toolName, part.input, state, part.state === "output-error" ? part.errorText : undefined);
  return (
    <TraceLine status={status}>
      <TraceTitle title={text}>{text}</TraceTitle>
    </TraceLine>
  );
}

const toolRows = (parts: DynamicToolUIPart[], live: boolean) => parts.map((p) => <ToolRow key={p.toolCallId} part={p} live={live} />);

/** Long tool runs show the latest action and keep the full list expandable. */
function ToolGroup({ parts, live }: { parts: DynamicToolUIPart[]; live: boolean }) {
  if (parts.length <= 3) return <Trace>{toolRows(parts, live)}</Trace>;
  const current = parts.at(-1)!;
  return (
    <Trace>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <ToolRow part={current} live={live} />
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="flex flex-col gap-1">{toolRows(parts, live)}</TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}

function Photo({ part }: { part: FileUIPart }) {
  // images are not stored: after a reload only the file name remains
  return (
    <Attachment size="xs" className="w-fit min-w-0">
      <AttachmentMedia variant={part.url ? "image" : "icon"}>{part.url ? <img src={part.url} alt="" /> : <ImageIcon />}</AttachmentMedia>
      {!part.url && (
        <AttachmentContent>
          <AttachmentTitle>{part.filename ?? "Photo"}</AttachmentTitle>
        </AttachmentContent>
      )}
    </Attachment>
  );
}

/** Consecutive tool parts form one Trace; text parts and photos stand alone. */
function groupParts(parts: Part[]) {
  const groups: (Part | DynamicToolUIPart[])[] = [];
  for (const p of parts) {
    const last = groups.at(-1);
    if (p.type === "dynamic-tool") {
      if (Array.isArray(last)) last.push(p);
      else groups.push([p]);
    } else if (p.type === "text" || p.type === "file") groups.push(p);
  }
  return groups;
}

/** Meals the assistant created or changed in this message, each once, in order. */
const touchedMeals = (parts: Part[]) => [
  ...new Set(parts.flatMap((p) => (p.type === "dynamic-tool" && p.state === "output-available" ? (mealIdOf(p.toolName, p.output) ?? []) : []))),
];

function ChatMessage({ message, live, onReference }: { message: UIMessage; live: boolean; onReference: OpenReference }) {
  const mine = message.role === "user";
  return (
    <Message align={mine ? "end" : "start"}>
      <MessageContent>
        {groupParts(message.parts).map((g, i) =>
          Array.isArray(g) ? (
            <ToolGroup key={i} parts={g} live={live} />
          ) : g.type === "file" ? (
            <Photo key={i} part={g} />
          ) : (
            g.type === "text" &&
            g.text && (
              <Bubble key={i} variant={mine ? "muted" : "ghost"}>
                <BubbleContent className={mine ? "rounded-lg bg-sun! px-3.5 py-2 text-[15px] font-medium text-foreground" : "text-[15px]"}>
                  {mine ? <span className="whitespace-pre-wrap">{g.text}</span> : <Markdown onReference={onReference}>{g.text}</Markdown>}
                </BubbleContent>
              </Bubble>
            )
          ),
        )}
        {touchedMeals(message.parts).map((id) => (
          <MealCard key={id} mealId={id} />
        ))}
      </MessageContent>
    </Message>
  );
}

/** `queued`: the message sent waits for a turn of another conversation (or device) to end. */
export function MessageList({ messages, status, queued = false, onReference }: {
  messages: UIMessage[]; status: ChatStatus; queued?: boolean; onReference: OpenReference;
}) {
  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const waiting = busy && (last?.role === "user" || last?.parts.length === 0);
  if (messages.length === 0)
    return (
      <div className="flex flex-1 flex-col justify-end gap-2 px-3.5 pb-5">
        <p className="display text-[32px]">Qu’est-ce qu’on mange ?</p>
        <p className="text-[15px] text-dim">Demandez une recette, des idées pour la semaine, ou envoyez la photo d’un plat.</p>
      </div>
    );
  return (
    <MessageScrollerProvider defaultScrollPosition="end" autoScroll>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport className="px-3.5">
          <MessageScrollerContent className="gap-4 py-3">
            {messages.map((m) => (
              <MessageScrollerItem key={m.id} messageId={m.id}>
                <ChatMessage message={m} live={busy && m === last} onReference={onReference} />
                {m === last && waiting && (
                  <Trace className="mt-4">
                    <TraceLine status="running">
                      <TraceTitle>{queued ? "En attente" : "Réflexion"}</TraceTitle>
                    </TraceLine>
                  </Trace>
                )}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
