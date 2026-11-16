import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { MOMENTS, MOMENT_LABELS, type Moment } from "@shared/constants";
import type { DrawStatus, GameOptions } from "@shared/schemas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { useDebounced } from "@/lib/hooks/use-debounced";
import { cn } from "@/lib/formatting/utils";

/** What the hand is dealt for; `from` is the server's. */
export type DrawOptions = Omit<GameOptions, "from">;

const STATUS_LABELS: Record<DrawStatus, string> = { all: "Tous", regular: "Habituels", to_try: "À essayer" };
const MAX_DAYS = 7;
const chip = "min-h-11 rounded-lg px-4 text-sm font-bold focus-visible:outline-2";

/** The slider sends its value once the thumb rests, not at every step. */
function DaysSlider({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  const [value, setValue] = useState(days);
  const settled = useDebounced(value, 400);
  useEffect(() => {
    if (settled !== days) onChange(settled);
  }, [settled]); // only a settled move is sent
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm font-bold">
        <label htmlFor="draw-days">Durée</label>
        <span>
          {value} {value === 1 ? "jour" : "jours"}
        </span>
      </div>
      <input
        id="draw-days"
        type="range"
        min={1}
        max={MAX_DAYS}
        step={1}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="h-8 w-full accent-[var(--tomato)]"
      />
    </div>
  );
}

function MomentToggles({ moments, onChange }: { moments: Moment[]; onChange: (moments: Moment[]) => void }) {
  const toggle = (moment: Moment) =>
    onChange(moments.includes(moment) ? moments.filter((m) => m !== moment) : MOMENTS.filter((m) => m === moment || moments.includes(m)));
  return (
    <div className="flex gap-1 rounded-xl bg-subtle p-1" role="group" aria-label="Moments">
      {MOMENTS.map((moment) => {
        const on = moments.includes(moment);
        return (
          <button
            key={moment}
            type="button"
            aria-pressed={on}
            // at least one moment: the last one cannot be turned off
            disabled={on && moments.length === 1}
            onClick={() => toggle(moment)}
            className={cn(chip, "flex-1", on ? "bg-[var(--sun)] text-foreground" : "text-dim")}
          >
            {MOMENT_LABELS[moment]}
          </button>
        );
      })}
    </div>
  );
}

function StatusChoice({ status, onChange }: { status: DrawStatus; onChange: (status: DrawStatus) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-subtle p-1" role="group" aria-label="Quels plats">
      {(Object.keys(STATUS_LABELS) as DrawStatus[]).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={status === item}
          onClick={() => onChange(item)}
          className={cn(chip, "flex-1 px-2", status === item ? "bg-[var(--sun)] text-foreground" : "text-dim")}
        >
          {STATUS_LABELS[item]}
        </button>
      ))}
    </div>
  );
}

/** "7 jours · Soir · Tous" */
const summary = ({ days, moments, status }: DrawOptions) =>
  [`${days} ${days === 1 ? "jour" : "jours"}`, moments.map((m) => MOMENT_LABELS[m]).join(" + "), STATUS_LABELS[status]].join(" · ");

interface DrawControlsProps {
  options: DrawOptions;
  disabled?: boolean;
  /** one change at a time; the hand adapts on the server */
  onChange: (change: Partial<DrawOptions>) => void;
}

/** What the hand is for, as a chip that opens the duration, moments and filter. */
export function DrawControls({ options, disabled, onChange }: DrawControlsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-subtle px-4 text-sm font-bold focus-visible:outline-2 disabled:opacity-50"
        >
          {summary(options)}
          <ChevronDown className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        <DaysSlider days={options.days} onChange={(days) => onChange({ days })} />
        <MomentToggles moments={options.moments} onChange={(moments) => onChange({ moments })} />
        <StatusChoice status={options.status} onChange={(status) => onChange({ status })} />
      </PopoverContent>
    </Popover>
  );
}
