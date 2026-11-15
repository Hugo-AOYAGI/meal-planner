import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "@shared/dates";
import { Button } from "@/components/ui/actions/button";
import { rangeLabel } from "@/lib/formatting/format";

interface WeekNavProps {
  week: string;
  onShift: (weeks: number) => void;
}

export function WeekNav({ week, onShift }: WeekNavProps) {
  return (
    <div className="flex items-center">
      <Button variant="ghost" size="icon-sm" aria-label="Semaine précédente" onClick={() => onShift(-1)}>
        <ChevronLeft />
      </Button>
      <span className="min-w-28 text-center text-[15px] font-bold whitespace-nowrap tabular-nums">{rangeLabel(week, addDays(week, 6))}</span>
      <Button variant="ghost" size="icon-sm" aria-label="Semaine suivante" onClick={() => onShift(1)}>
        <ChevronRight />
      </Button>
    </div>
  );
}
