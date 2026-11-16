import { useState, type ReactElement } from "react";
import { MOMENT_LABELS, type Moment } from "@shared/constants";
import { Overlay } from "@/components/overlays/Overlay";
import { fullDayLabel } from "@/lib/formatting/format";
import { DiceFan } from "./DiceFan";

interface SlotDiceProps {
  date: string;
  moment: Moment;
  /** the dice button: a single element */
  children: ReactElement;
}

/** The dice on one slot: a small fan of 3 cards in a popover (a bottom sheet on phones). */
export function SlotDice({ date, moment, children }: SlotDiceProps) {
  const [open, setOpen] = useState(false);
  const title = `${MOMENT_LABELS[moment]} · ${fullDayLabel(date)}`;
  return (
    <Overlay open={open} onOpenChange={setOpen} trigger={children} title={`Tirage ${title}`} align="end" className="w-80">
      <span className="micro-label">🎲 {title}</span>
      {open && <DiceFan date={date} moment={moment} onApplied={() => setOpen(false)} />}
    </Overlay>
  );
}
