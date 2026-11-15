import { Check, Settings2 } from "lucide-react";
import { useState } from "react";
import { ASSISTANT_LABELS, ASSISTANTS } from "@shared/constants";
import { Overlay } from "@/components/overlays/Overlay";
import { Button } from "@/components/ui/actions/button";
import { useSettings, useUpdateSettings } from "@/lib/api/queries";
import { cn } from "@/lib/formatting/utils";

/** Chat settings: which agent answers. The choice is shared by all devices and applies from the next message. */
export function AssistantPicker() {
  const [open, setOpen] = useState(false);
  const current = useSettings().data?.assistant;
  const update = useUpdateSettings();
  return (
    <Overlay
      open={open}
      onOpenChange={setOpen}
      title="Réglages de l'assistant"
      align="end"
      className="w-60 gap-1 p-1.5"
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-11 md:size-8"
          aria-label="Réglages de l'assistant"
        >
          <Settings2 />
        </Button>
      }
    >
      <span className="micro-label px-2.5 pt-1.5">Assistant</span>
      {ASSISTANTS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={id === current}
          onClick={() => {
            update.mutate({ assistant: id });
            setOpen(false);
          }}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-left outline-none hover:bg-subtle focus-visible:bg-subtle active:bg-active",
            id === current && "bg-sun hover:bg-sun focus-visible:bg-sun",
          )}
        >
          <span className="flex-1">
            <span className="block text-[15px] leading-tight font-bold">
              {ASSISTANT_LABELS[id].name}
            </span>
            <span className="block text-xs text-dim">
              {ASSISTANT_LABELS[id].model}
            </span>
          </span>
          {id === current && <Check className="size-4" />}
        </button>
      ))}
    </Overlay>
  );
}
