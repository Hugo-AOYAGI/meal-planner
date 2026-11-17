import { ArrowDown, ArrowUp } from "lucide-react";
import { useRef } from "react";
import { today } from "@shared/dates";
import { FLOATING_ROW } from "@/components/layout/floating";
import { Toolbar } from "@/components/layout/Toolbar";
import { Skeleton } from "@/components/ui/feedback/skeleton";
import { fullDayLabel } from "@/lib/formatting/format";
import { cn } from "@/lib/formatting/utils";
import { DayGrid } from "@/features/week/days/DayGrid";
import { PreviousDays } from "@/features/week/days/PreviousDays";
import { usePlanScroll } from "@/features/week/days/use-plan-days";
import { useToday } from "@/features/week/days/use-today";
import { DrawDialog } from "@/features/week/draw/DrawDialog";
import { DrawButtons, JoinBanner } from "@/features/week/draw/DrawEntry";
import { useGameSession } from "@/features/week/draw/use-game-session";
import { SettingsPopover } from "@/features/week/settings/SettingsPopover";

/** The planning from today on: one list that loads further days as it is scrolled, and older ones when scrolled back. */
export function PlanningPage() {
  const from = today();
  const plan = usePlanScroll(from);
  const page = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const jump = useToday(from, Boolean(plan.slots), page, toolbar);
  const game = useGameSession();

  return (
    <div ref={page}>
      <div ref={toolbar} className="sticky top-0 z-10 bg-background md:top-14">
        <Toolbar
          actions={
            <>
              <SettingsPopover />
              <DrawButtons session={game} />
            </>
          }
        >
          <span className="truncate text-[15px] font-bold first-letter:uppercase">{fullDayLabel(from)}</span>
        </Toolbar>
        <JoinBanner session={game} />
      </div>
      <DrawDialog session={game} />
      {plan.hasPreviousPage && <PreviousDays load={plan.fetchPreviousPage} disabled={plan.isFetchingPreviousPage} />}
      {plan.slots ? <DayGrid slots={plan.slots} /> : <Skeleton className="h-[32rem] w-full md:h-80" />}
      {plan.hasNextPage && <Skeleton ref={plan.sentinel} className="mt-5 h-40 w-full" />}
      {jump.place !== "here" && (
        <button
          type="button"
          onClick={jump.goToToday}
          className={cn(
            FLOATING_ROW,
            "left-4 z-30 flex h-13 items-center gap-2 rounded-full bg-[var(--sun)] px-5 text-base font-bold shadow-panel outline-none focus-visible:ring-2 focus-visible:ring-brand md:left-6",
          )}
        >
          {jump.place === "above" ? <ArrowUp className="size-[18px]" /> : <ArrowDown className="size-[18px]" />}
          Aujourd’hui
        </button>
      )}
    </div>
  );
}
