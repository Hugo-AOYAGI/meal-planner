import { Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Member, Settings } from "@shared/schemas";
import { ServingsStepper } from "@/components/controls/ServingsStepper";
import { Button } from "@/components/ui/actions/button";
import { Input } from "@/components/ui/inputs/input";
import { useUpdateSettings } from "@/lib/api/queries";
import { cn } from "@/lib/formatting/utils";

type Color = Member["color"];
const COLORS: Color[] = ["sun", "tomato", "leaf", "sky", "lilac", "rose"];
const COLOR_NAMES: Record<Color, string> = { sun: "Jaune", tomato: "Tomate", leaf: "Vert", sky: "Bleu", lilac: "Lilas", rose: "Rose" };
const MAX_MEMBERS = 6;
const swatch = "size-7 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand max-md:size-11";

/** The six colours, one to pick. */
function Swatches({ value, onPick }: { value: Color; onPick: (color: Color) => void }) {
  return (
    <div role="radiogroup" aria-label="Couleur" className="flex flex-wrap gap-1.5">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={COLOR_NAMES[color]}
          onClick={() => onPick(color)}
          style={{ backgroundColor: `var(--${color})` }}
          className={cn(swatch, color === value && "ring-2 ring-foreground ring-offset-2 ring-offset-surface")}
        />
      ))}
    </div>
  );
}

/** The players of the draw game (first name and colour), and how quick a "repas rapide" must be. */
export function MembersList({ settings }: { settings: Settings }) {
  const update = useUpdateSettings();
  const members = settings.members;
  const free = COLORS.find((c) => !members.some((m) => m.color === c)) ?? "sun";
  const [name, setName] = useState("");
  const [color, setColor] = useState<Color | null>(null);
  // the member whose colour is being changed
  const [painting, setPainting] = useState<string | null>(null);

  const save = (next: Member[]) => update.mutate({ members: next });
  const change = (id: string, patch: Partial<Member>) => save(members.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || members.length >= MAX_MEMBERS) return;
    const member = { id: crypto.randomUUID().slice(0, 8), name: name.trim(), color: color ?? free };
    update.mutate({ members: [...members, member] }, { onSuccess: () => (setName(""), setColor(null)) });
  };
  const quick = settings.quickMaxMinutes;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <span className="micro-label">Joueurs du tirage</span>
      {members.length === 0 && <p className="text-xs text-dim">Personne encore. Ajoute chaque joueur du foyer.</p>}
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={`Couleur de ${m.name}`}
                aria-expanded={painting === m.id}
                onClick={() => setPainting(painting === m.id ? null : m.id)}
                style={{ backgroundColor: `var(--${m.color})` }}
                className={swatch}
              />
              <Input
                // remounted when the saved name changes, so it shows it
                key={m.name}
                aria-label={`Prénom de ${m.name}`}
                defaultValue={m.name}
                maxLength={30}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== m.name) change(m.id, { name: next });
                  else e.target.value = m.name;
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="md:h-8 md:text-xs"
              />
              <Button variant="ghost" size="icon-sm" aria-label={`Retirer ${m.name}`} onClick={() => save(members.filter((x) => x.id !== m.id))}>
                <X />
              </Button>
            </div>
            {painting === m.id && (
              <Swatches
                value={m.color}
                onPick={(c) => {
                  change(m.id, { color: c });
                  setPainting(null);
                }}
              />
            )}
          </li>
        ))}
      </ul>
      {members.length < MAX_MEMBERS && (
        <form onSubmit={submit} className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            <Input
              aria-label="Prénom du nouveau joueur"
              placeholder="Prénom"
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="md:h-8 md:text-xs"
            />
            <Button type="submit" variant="outline" size="icon-sm" aria-label="Ajouter le joueur" disabled={!name.trim() || update.isPending}>
              <Plus />
            </Button>
          </div>
          {name.trim() && <Swatches value={color ?? free} onPick={setColor} />}
        </form>
      )}
      <div className="flex items-center gap-2 pt-1">
        <span className="micro-label">Repas rapide ≤</span>
        <ServingsStepper
          value={quick}
          min={5}
          max={120}
          // in steps of 5 minutes
          onChange={(n) => update.mutate({ quickMaxMinutes: n > quick ? Math.floor(quick / 5) * 5 + 5 : Math.ceil(quick / 5) * 5 - 5 })}
        />
        <span className="micro-label">min</span>
      </div>
    </div>
  );
}
