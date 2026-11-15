import type { ReactNode } from "react";
import { cn } from "@/lib/formatting/utils";

/** A form control under a micro-label. */
export function LabeledField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="micro-label">{label}</span>
      {children}
    </label>
  );
}
