import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { MealsPage } from "@/features/meals/MealsPage";
import { ShoppingPage } from "@/features/shopping/ShoppingPage";
import { PlanningPage } from "@/features/week/PlanningPage";
import { Button } from "@/components/ui/actions/button";
import { goToTab, useHash } from "@/lib/formatting/hash";
import { useBackLayer } from "@/lib/hooks/use-back";
import { useLiveUpdates } from "@/lib/hooks/use-live-updates";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { useTabSwipe } from "@/lib/hooks/use-tab-swipe";
import { cn } from "@/lib/formatting/utils";
import { FLOATING_ROW } from "@/components/layout/floating";

const TABS = [
  { id: "planning", label: "Planning", page: PlanningPage },
  { id: "repas", label: "Repas", page: MealsPage },
  { id: "courses", label: "Courses", page: ShoppingPage },
] satisfies { id: string; label: string; page: () => React.ReactNode }[];
type TabId = (typeof TABS)[number]["id"];

function useTab(): [(typeof TABS)[number], (id: TabId) => void] {
  const hash = useHash();
  return [TABS.find((t) => t.id === hash.tab) ?? TABS[0]!, (id) => goToTab(id, TABS[0]!.id)];
}

/** The three tabs as words; the active one gets the highlighter. */
function TabNav({
  current,
  onSelect,
  className,
}: {
  current: TabId;
  onSelect: (id: TabId) => void;
  className?: string;
}) {
  return (
    <nav className={className}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-current={t.id === current ? "page" : undefined}
          onClick={() => onSelect(t.id)}
          className={cn(
            "flex h-full flex-1 items-center justify-center rounded-md px-3 text-[15px] font-bold outline-none focus-visible:bg-subtle max-md:active:bg-subtle",
            t.id === current ? "text-foreground" : "text-dim hover:text-foreground",
          )}
        >
          <span className={cn("px-0.5", t.id === current && "hl")}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/**
 * The app's main call to action: the one button in tomato, floating in the bottom corner of the page, on the line the
 * Planning's "Aujourd'hui" button shares (see `FLOATING_ROW`). Too narrow for both: only its icon.
 */
function AssistantButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      aria-label="Assistant"
      className={cn(
        FLOATING_ROW,
        "right-4 z-30 h-13 max-md:h-13 gap-2 rounded-full bg-[var(--tomato)] px-5 text-base text-foreground shadow-panel hover:bg-[var(--tomato)] hover:brightness-95 max-[359px]:w-13 max-[359px]:px-0 md:right-6",
      )}
      onClick={onClick}
    >
      <MessageCircle className="size-[18px]" />
      <span className="max-[359px]:sr-only">Assistant</span>
    </Button>
  );
}

export function App() {
  useLiveUpdates();
  const [tab, setTab] = useTab();
  const [chatOpen, setChatOpen] = useState(false);
  const mobile = useIsMobile();
  const Page = tab.page;
  const swipe = useTabSwipe(mobile, (direction) => {
    const next = TABS[TABS.findIndex((item) => item.id === tab.id) + direction];
    if (next) setTab(next.id);
  });
  const toggleChat = () => setChatOpen((open) => !open);
  // on phones the chat covers the page: the back action closes it (on a wide screen it is a side panel, left alone)
  useBackLayer(mobile && chatOpen, () => setChatOpen(false));
  // on phones the chat covers the page: following one of its links hides it (it stays as it was) while the linked
  // meal is open, and closing the meal brings it back
  const { id: hashId } = useHash();
  const [chatHidden, setChatHidden] = useState(false);
  useEffect(() => setChatHidden(mobile && chatOpen && hashId !== null), [mobile, chatOpen, hashId]);

  return (
    <div className="flex h-dvh bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col">
        {mobile ? (
          <header className="box-content flex h-13 shrink-0 items-center gap-2 px-3.5 pt-[env(safe-area-inset-top)]">
            <h1 className="display text-[28px]">{tab.label}</h1>
          </header>
        ) : (
          <header className="absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-4 bg-background/90 px-4 backdrop-blur">
            <span className="display text-2xl">Repas</span>
            <TabNav current={tab.id} onSelect={setTab} className="flex h-9" />
          </header>
        )}
        {/* one scroller per tab: a tab opens at its top (Planning then places itself on today), not where the last one was */}
        <main
          key={tab.id}
          {...swipe}
          className={cn("min-h-0 flex-1 overflow-y-auto px-3.5 pb-24", mobile ? "pt-0" : "px-4 pt-[68px]")}
        >
          <Page />
        </main>
        <AssistantButton onClick={toggleChat} />
        {mobile && (
          <TabNav
            current={tab.id}
            onSelect={setTab}
            className="box-content flex h-14 shrink-0 pb-[env(safe-area-inset-bottom)]"
          />
        )}
      </div>
      {chatOpen && (
        <aside
          className={cn(
            "flex flex-col bg-background",
            mobile
              ? cn("fixed inset-0 z-50 pt-[env(safe-area-inset-top)]", chatHidden && "hidden")
              : "w-[380px] shrink-0 border-l-2 border-foreground",
          )}
        >
          <div className="min-h-0 flex-1">
            <ChatPanel onClose={mobile ? toggleChat : undefined} />
          </div>
        </aside>
      )}
    </div>
  );
}
