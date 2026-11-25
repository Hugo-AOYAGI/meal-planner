import { Ellipsis } from "lucide-react";
import { useState } from "react";
import type { Leftover } from "@shared/schemas";
import { ServingsStepper } from "@/components/controls/ServingsStepper";
import { Overlay } from "@/components/overlays/Overlay";
import { Button } from "@/components/ui/actions/button";
import { useUpdateLeftover } from "./use-fridge";

/** What was eaten without being noted is corrected here; a leftover leaves the fridge finished or thrown away. */
export function LeftoverActions({ leftover }: { leftover: Leftover }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateLeftover();
  const done = (reason: "eaten" | "thrown") => {
    update.mutate({ id: leftover.id, done: reason });
    setOpen(false);
  };
  return (
    <Overlay
      open={open}
      onOpenChange={setOpen}
      title={leftover.name}
      align="end"
      className="w-64"
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`${leftover.name} : modifier`}>
          <Ellipsis />
        </Button>
      }
    >
      <span className="truncate text-[15px] font-bold">{leftover.name}</span>
      <div className="flex items-center gap-2">
        <ServingsStepper
          value={leftover.remaining}
          min={0}
          max={30}
          onChange={(remaining) => update.mutate({ id: leftover.id, remaining })}
        />
        <span className="micro-label">parts restantes</span>
      </div>
      <div className="flex gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => done("eaten")}>
          Fini
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => done("thrown")}>
          Jeté
        </Button>
      </div>
    </Overlay>
  );
}
