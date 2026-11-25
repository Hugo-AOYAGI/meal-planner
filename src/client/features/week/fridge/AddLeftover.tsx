import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { today } from "@shared/dates";
import { normalize } from "@shared/text";
import { ServingsStepper } from "@/components/controls/ServingsStepper";
import { Overlay } from "@/components/overlays/Overlay";
import { Button } from "@/components/ui/actions/button";
import { Input } from "@/components/ui/inputs/input";
import { useMeals, useSettings } from "@/lib/api/queries";
import { useAddLeftover } from "./use-fridge";

/** A leftover that did not come from the planning: a name (a meal of the library when it matches one), portions, a day. */
export function AddLeftover({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const household = useSettings().data?.householdSize ?? 2;
  const meals = useMeals().data ?? [];
  const add = useAddLeftover();
  const [name, setName] = useState("");
  const [portions, setPortions] = useState(household);
  const [day, setDay] = useState(today());

  const reset = (next: boolean) => {
    setOpen(next);
    if (next) {
      setName("");
      setPortions(household);
      setDay(today());
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const label = name.trim();
    if (!label) return;
    const meal = meals.find((m) => normalize(m.name) === normalize(label));
    add.mutate({ ...(meal ? { mealId: meal.id } : { name: label }), portions, createdOn: day || today() });
    setOpen(false);
  };

  return (
    <Overlay
      open={open}
      onOpenChange={reset}
      title="Ajouter un reste"
      align="end"
      className="w-72"
      trigger={
        <Button variant="ghost" size="sm" className={className}>
          <Plus />
          Reste
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ce qu’il reste"
          aria-label="Nom"
          list="leftover-meals"
          enterKeyHint="done"
        />
        <datalist id="leftover-meals">
          {meals.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>
        <div className="flex items-center gap-2">
          <ServingsStepper value={portions} max={30} onChange={setPortions} />
          <span className="micro-label">parts</span>
        </div>
        <label className="flex items-center gap-2">
          <span className="micro-label w-20">Cuisiné le</span>
          <Input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} className="w-auto" />
        </label>
        <Button type="submit" size="sm" disabled={!name.trim()}>
          Ajouter
        </Button>
      </form>
    </Overlay>
  );
}
