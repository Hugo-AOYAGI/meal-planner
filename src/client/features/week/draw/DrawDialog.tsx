import { Dices } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Moment } from "@shared/constants";
import { today } from "@shared/dates";
import { Button } from "@/components/ui/actions/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/overlays/dialog";
import { DrawControls } from "./DrawControls";
import { SuggestionCards } from "./SuggestionCards";
import { useDrawSession } from "./use-draw-session";

interface DrawProps {
  /** first day drawn */
  date: string;
  /** draw this one day and redraw what it holds, instead of filling the empty slots of the next days */
  oneDay?: boolean;
  /** the moment enabled at first, instead of those of the settings */
  moment?: Moment;
}

function DrawPanel({ date, oneDay = false, moment, onApplied }: DrawProps & { onApplied: () => void }) {
  const draw = useDrawSession({ date, oneDay, moment, onApplied });
  const { options, suggestions } = draw;
  return (
    <fieldset disabled={draw.proposing || draw.applying} className="flex min-w-0 flex-col gap-4">
      <DrawControls options={options} oneDay={oneDay} onChange={draw.changeOptions} />
      {suggestions?.length ? (
        <SuggestionCards
          date={date}
          days={options.days}
          moments={options.moments}
          suggestions={suggestions}
          locked={draw.locked}
          onToggleLock={draw.toggleLock}
          onSwap={draw.swap}
        />
      ) : (
        suggestions && <p className="text-sm text-dim">Aucun repas disponible pour ces jours et ces filtres.</p>
      )}
      {draw.error && (
        <p role="alert" className="text-sm text-red-700">
          {draw.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant={suggestions ? "outline" : "default"} disabled={!options.moments.length} onClick={draw.propose}>
          <Dices />
          {draw.proposing ? "Tirage…" : suggestions ? "Relancer" : "Proposer"}
        </Button>
        {!!suggestions?.length && (
          <Button onClick={draw.apply}>{draw.applying ? "Ajout…" : "Ajouter au planning"}</Button>
        )}
      </div>
    </fieldset>
  );
}

/**
 * The "Tirer" flow, opened by `children` (the button): choose what to draw, look at the proposals, keep or move some,
 * add them to the planning. Nothing is drawn for a day that is over. Each opening starts from scratch.
 */
export function DrawDialog({ children, ...draw }: DrawProps & { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (draw.date < today()) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-4 sm:max-w-xl" aria-describedby={undefined}>
        <DialogTitle className="display text-2xl">Tirer des repas</DialogTitle>
        <DrawPanel {...draw} onApplied={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
