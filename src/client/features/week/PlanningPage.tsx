import { ArrowDown, ArrowUp, Dices } from "lucide-react";
import { useRef } from "react";
import { today } from "@shared/dates";
import { Toolbar } from "@/components/layout/Toolbar";
import { Button } from "@/components/ui/actions/button";
import { Skeleton } from "@/components/ui/feedback/skeleton";
import { fullDayLabel } from "@/lib/formatting/format";
import { DayGrid } from "@/features/week/days/DayGrid";
import { PreviousDays } from "@/features/week/days/PreviousDays";
import { usePlanScroll } from "@/features/week/days/use-plan-days";
import { useToday } from "@/features/week/days/use-today";
import { DrawDialog } from "@/features/week/draw/DrawDialog";
import { SettingsPopover } from "@/features/week/settings/SettingsPopover";

/** The planning from today on: one list that loads further days as it is scrolled, and older ones when scrolled back. */
export function PlanningPage() {
  const from = today();
  const plan = usePlanScroll(from);
  const page = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const jump = useToday(from, Boolean(plan.slots), page, toolbar);

  return (
    <div ref={page}>
      <div ref={toolbar} className="sticky top-0 z-10 bg-background md:top-14">
        <Toolbar
          actions={
            <>
              <SettingsPopover />
              <DrawDialog date={from}>
                <Button size="sm">
                  <Dices />
                  Tirer
                </Button>
              </DrawDialog>
            </>
          }
        >
          <span className="truncate text-[15px] font-bold first-letter:uppercase">{fullDayLabel(from)}</span>
        </Toolbar>
      </div>
      {plan.hasPreviousPage && <PreviousDays load={plan.fetchPreviousPage} disabled={plan.isFetchingPreviousPage} />}
      {plan.slots ? <DayGrid slots={plan.slots} /> : <Skeleton className="h-[32rem] w-full md:h-80" />}
      {plan.hasNextPage && <Skeleton ref={plan.sentinel} className="mt-5 h-40 w-full" />}
      {/* last child, so that it sticks to the bottom of the scroll area while the list is above it */}
      <div className="pointer-events-none sticky bottom-4 z-20 h-0">
        {jump.place !== "here" && (
          <button
            type="button"
            onClick={jump.goToToday}
            className="pointer-events-auto absolute bottom-0 left-0 flex h-11 items-center gap-2 rounded-full bg-[var(--sun)] px-4 text-sm font-bold shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {jump.place === "above" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            Aujourd’hui
          </button>
        )}
      </div>
    </div>
  );
}
