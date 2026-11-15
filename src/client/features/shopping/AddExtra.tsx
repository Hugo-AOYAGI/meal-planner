import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/actions/button";
import { Input } from "@/components/ui/inputs/input";

/** Last row of the extras: a button that turns into an input for a free line. */
export function AddExtra({ onAdd }: { onAdd: (label: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const close = () => {
    setAdding(false);
    setLabel("");
  };

  if (!adding) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-xs text-dim outline-none hover:bg-subtle hover:text-foreground focus-visible:bg-subtle md:min-h-11"
        >
          <Plus className="size-4" />
          Ajouter une ligne
        </button>
      </li>
    );
  }
  return (
    <li>
      <form
        className="flex gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) onAdd(label.trim());
          close();
        }}
      >
        <Input autoFocus aria-label="Nouvelle ligne" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Escape" && close()} />
        <Button type="submit" size="sm">
          Ajouter
        </Button>
      </form>
    </li>
  );
}
