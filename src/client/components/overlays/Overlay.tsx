import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/overlays/sheet";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/formatting/utils";

interface OverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}

/** Popover on desktop, bottom sheet on phones. `trigger` must be a single element. */
export function Overlay({ open, onOpenChange, trigger, title, align = "start", className, children }: OverlayProps) {
  if (useIsMobile()) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        {/* no auto-focus: it would show a focus ring on the first control and raise the keyboard */}
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-h-[85dvh] gap-3 overflow-y-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={cn("max-h-(--radix-popover-content-available-height) gap-3 overflow-y-auto rounded-md p-3", className)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
