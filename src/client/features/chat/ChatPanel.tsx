import { HistoryIcon, MessageSquareIcon, Undo2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useBackLayer } from "@/lib/hooks/use-back";
import { Button } from "@/components/ui/actions/button";
import { AssistantPicker } from "@/features/chat/composer/AssistantPicker";
import { ChatInput } from "@/features/chat/composer/ChatInput";
import { HistoryList } from "@/features/chat/session/HistoryList";
import { MessageList } from "@/features/chat/messages/MessageList";
import type { ReferenceTarget } from "@shared/references/links";
import { ReferenceReader } from "@/features/chat/messages/ReferenceReader";
import { useChatSession } from "@/features/chat/session/use-chat-session";

/** The assistant. Fills its container: header, scrolling messages (or the history list), input pinned at the bottom. */
export function ChatPanel({ onClose }: { onClose?: () => void }) {
  const { messages, status, busy, queued, error, conversationId, resumable, send, stop, reset, open } = useChatSession();
  const [history, setHistory] = useState(false);
  const [reference, setReference] = useState<ReferenceTarget | null>(null);
  const referenceLink = useRef<HTMLAnchorElement>(null);
  useBackLayer(history, () => setHistory(false)); // back from the history list: to the conversation
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="flex h-13 shrink-0 items-center justify-between pr-1 pl-3.5">
        <h2 className="display text-2xl">{history ? "Historique" : "Assistant"}</h2>
        <div className="flex items-center">
          <AssistantPicker />
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-11 md:size-8"
            aria-label={history ? "Retour à la conversation" : "Historique des conversations"}
            aria-pressed={history}
            onClick={() => setHistory((h) => !h)}
          >
            {history ? <MessageSquareIcon /> : <HistoryIcon />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 md:h-8"
            disabled={!messages.length && !history}
            onClick={() => {
              reset();
              setHistory(false);
            }}
          >
            Nouveau
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon-sm" className="size-11 md:size-8" aria-label="Fermer" onClick={onClose}>
              <XIcon />
            </Button>
          )}
        </div>
      </header>
      {history && (
        <HistoryList
          currentId={conversationId}
          onOpen={(id) => {
            setHistory(false);
            void open(id);
          }}
          onDeleted={(id) => id === conversationId && reset()}
        />
      )}
      {/* kept mounted behind the history so a half-typed message survives */}
      <div className={history ? "hidden" : "flex min-h-0 flex-1 flex-col"}>
        <MessageList messages={messages} status={status} queued={queued} onReference={(target, link) => {
          referenceLink.current = link;
          setReference(target);
        }} />
        {resumable && (
          <button
            type="button"
            onClick={() => void open(resumable.id)}
            className="mx-3 mb-2 flex min-h-11 items-center gap-2 rounded-md px-2 text-left text-xs text-dim outline-none hover:bg-subtle hover:text-foreground focus-visible:bg-subtle"
          >
            <Undo2Icon className="size-4 shrink-0" />
            <span className="min-w-0 truncate">
              Reprendre : <span className="font-semibold text-foreground">{resumable.title}</span>
            </span>
          </button>
        )}
        {error && (
          <p role="alert" className="px-3 pb-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <ChatInput busy={busy} onSend={send} onStop={stop} />
      </div>
      <ReferenceReader target={reference} onClose={() => setReference(null)} returnFocus={referenceLink} />
    </div>
  );
}
