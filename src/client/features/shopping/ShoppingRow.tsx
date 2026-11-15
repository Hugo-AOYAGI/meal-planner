import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/actions/checkbox";
import { cn } from "@/lib/formatting/utils";

interface ShoppingRowProps {
  label: string;
  /** source meals, in small dim text */
  detail?: string;
  quantity?: string;
  /** what the quantity weighs, under it ("≈ 250 g") */
  approx?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  action?: ReactNode;
}

/** One tickable line of the list; ticked lines are dimmed and struck. */
export function ShoppingRow({ label, detail, quantity, approx, checked, onCheckedChange, action }: ShoppingRowProps) {
  return (
    <li className="flex min-h-12 items-center gap-3 px-3.5 md:min-h-11">
      <label className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-1.5">
        <Checkbox checked={checked} onCheckedChange={(on) => onCheckedChange(on === true)} />
        <span className={cn("min-w-0 flex-1", checked && "text-dim")}>
          <span className={cn("block truncate text-[15px] font-medium", checked && "line-through")}>{label}</span>
          {detail && <small className="block truncate text-xs text-dim">{detail}</small>}
        </span>
      </label>
      {quantity && (
        <span className={cn("shrink-0 text-right text-[13px] leading-snug font-bold tabular-nums", checked && "text-dim")}>
          {quantity}
          {approx && <span className="block text-xs font-normal text-dim">{approx}</span>}
        </span>
      )}
      {action}
    </li>
  );
}
