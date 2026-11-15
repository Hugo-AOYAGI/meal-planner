import { HistoryIcon, MessageSquareIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/actions/button";
import { AssistantPicker } from "@/features/chat/composer/AssistantPicker";
import { ChatInput } from "@/features/chat/composer/ChatInput";
import { HistoryList } from "@/features/chat/session/HistoryList";
import { MessageList } from "@/features/chat/messages/MessageList";
import { useChatSession } from "@/features/chat/session/use-chat-session";

/** The assistant. Fills its container: header, scrolling messages (or the history list), input pinned at the bottom. */
export function ChatPanel({ onClose }: { onClose?: () => void }) {
  const { messages, status, busy, error, conversationId, send, stop, reset, open } = useChatSession();
  const [history, setHistory] = useState(false);
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
        <MessageList messages={messages} status={status} />
        {error && (
          <p role="alert" className="px-3 pb-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <ChatInput busy={busy} onSend={send} onStop={stop} />
      </div>
    </div>
  );
}
