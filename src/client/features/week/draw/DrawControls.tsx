import { SlidersHorizontal } from "lucide-react";
import { MOMENTS, MOMENT_LABELS, type Moment } from "@shared/constants";
import type { DrawStatus } from "@shared/schemas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { cn } from "@/lib/formatting/utils";
import type { DrawOptions } from "./use-draw-session";

const STATUS_LABELS: Record<DrawStatus, string> = { all: "Tous", regular: "Habituels", to_try: "À essayer" };
const MAX_DAYS = 7;
const chip = "rounded-lg px-4 py-2 text-sm font-bold focus-visible:outline-2";

function DaysSlider({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm font-bold">
        <label htmlFor="draw-days">Durée</label>
        <span>
          {days} {days === 1 ? "jour" : "jours"}
        </span>
      </div>
      <input
        id="draw-days"
        type="range"
        min={1}
        max={MAX_DAYS}
        step={1}
        value={days}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--tomato)]"
      />
      <div className="flex justify-between px-1 text-xs font-bold text-dim" aria-hidden="true">
        {Array.from({ length: MAX_DAYS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "grid size-6 place-items-center rounded-full",
              days === i + 1 && "bg-[var(--sun)] text-foreground",
            )}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

function MomentToggles({ moments, onChange }: { moments: Moment[]; onChange: (moments: Moment[]) => void }) {
  const toggle = (moment: Moment) =>
    onChange(moments.includes(moment) ? moments.filter((m) => m !== moment) : [...moments, moment]);
  return (
    <div className="flex gap-1 rounded-xl bg-subtle p-1" aria-label="Moments">
      {MOMENTS.map((moment) => (
        <button
          key={moment}
          type="button"
          aria-pressed={moments.includes(moment)}
          onClick={() => toggle(moment)}
          className={cn(chip, moments.includes(moment) ? "bg-[var(--sun)] text-foreground" : "text-dim")}
        >
          {MOMENT_LABELS[moment]}
        </button>
      ))}
    </div>
  );
}

function StatusFilter({ status, onChange }: { status: DrawStatus; onChange: (status: DrawStatus) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filtres"
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold focus-visible:outline-2",
            status === "all" ? "bg-subtle" : "bg-[var(--sun)]",
          )}
        >
          <SlidersHorizontal className="size-4" />
          {STATUS_LABELS[status]}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 gap-1 p-2">
        {(Object.keys(STATUS_LABELS) as DrawStatus[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={status === item}
            onClick={() => onChange(item)}
            className={cn(
              "rounded-md px-3 py-2 text-left font-bold hover:bg-subtle",
              status === item && "bg-[var(--sun)]",
            )}
          >
            {STATUS_LABELS[item]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

interface DrawControlsProps {
  options: DrawOptions;
  /** one day is drawn: its length is not a choice */
  oneDay: boolean;
  onChange: (change: Partial<DrawOptions>) => void;
}

/** What to draw: for how many days, which moments, from which meals. */
export function DrawControls({ options, oneDay, onChange }: DrawControlsProps) {
  return (
    <div className="space-y-4">
      {!oneDay && <DaysSlider days={options.days} onChange={(days) => onChange({ days })} />}
      <div className="flex items-center justify-between gap-3">
        <MomentToggles moments={options.moments} onChange={(moments) => onChange({ moments })} />
        <StatusFilter status={options.status} onChange={(status) => onChange({ status })} />
      </div>
    </div>
  );
}
