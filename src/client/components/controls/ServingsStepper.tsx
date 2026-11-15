import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/formatting/utils";

interface ServingsStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

const stepButton =
  "inline-flex size-7 items-center justify-center text-muted-foreground outline-none hover:bg-subtle focus-visible:bg-active disabled:opacity-40 max-md:size-11";

export function ServingsStepper({ value, onChange, min = 1, max = 50, className }: ServingsStepperProps) {
  return (
    <span className={cn("inline-flex items-center overflow-hidden rounded-sm border border-border bg-surface", className)}>
      <button type="button" aria-label="Moins" className={stepButton} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-3.5" />
      </button>
      <b className="w-8 border-x border-border text-center text-xs font-semibold leading-7 max-md:leading-11">{value}</b>
      <button type="button" aria-label="Plus" className={stepButton} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-3.5" />
      </button>
    </span>
  );
}
