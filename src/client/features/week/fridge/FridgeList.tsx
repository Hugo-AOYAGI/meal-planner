import { TriangleAlert } from "lucide-react";
import { today } from "@shared/dates";
import type { Leftover } from "@shared/schemas";
import { Button } from "@/components/ui/actions/button";
import { cn } from "@/lib/formatting/utils";
import { AddLeftover } from "./AddLeftover";
import { LeftoverActions } from "./LeftoverActions";
import { nextMoment, useEatLeftover, useFridge } from "./use-fridge";

/** From this age (days) a cooked dish is better eaten soon: the row shows a warning. */
const WARN_AFTER_DAYS = 3;

export const portionsLabel = (n: number) => `${n} part${n > 1 ? "s" : ""}`;
const ageLabel = (age: number) => (age === 0 ? "auj." : `${age} j`);

function LeftoverRow({ leftover }: { leftover: Leftover }) {
  const eat = useEatLeftover();
  const moment = nextMoment();
  const old = leftover.age >= WARN_AFTER_DAYS;
  return (
    <li className="flex min-h-11 items-center gap-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{leftover.name}</span>
        <span className={cn("flex items-center gap-1 text-xs tabular-nums", old ? "font-bold text-brand-text" : "text-dim")}>
          {portionsLabel(leftover.remaining)} · {ageLabel(leftover.age)}
          {old && <TriangleAlert className="size-3.5" aria-label="à finir vite" />}
        </span>
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={eat.isPending}
        onClick={() => eat.mutate({ id: leftover.id, date: today(), moment })}
      >
        {moment === "midi" ? "Ce midi" : "Ce soir"}
      </Button>
      <LeftoverActions leftover={leftover} />
    </li>
  );
}

/** "Au frigo", above the planning while it holds something: the oldest first, each a tap away from tonight's meal. */
export function FridgeList() {
  const fridge = useFridge().data ?? [];
  return (
    <section aria-label="Au frigo" className={cn("mb-4 rounded-lg px-3 pt-2 pb-1", fridge.length ? "bg-subtle md:max-w-xl" : "-mt-2 mb-1 px-0 pt-0 pb-0")}>
      <div className="flex items-center justify-between">
        {fridge.length > 0 && <h2 className="micro-label text-foreground">Au frigo</h2>}
        <AddLeftover className={cn(!fridge.length && "ml-auto")} />
      </div>
      {fridge.length > 0 && (
        <ul className="flex flex-col">
          {fridge.map((l) => (
            <LeftoverRow key={l.id} leftover={l} />
          ))}
        </ul>
      )}
    </section>
  );
}
