import { Plus, X } from "lucide-react";
import { useState } from "react";
import { LabeledField } from "@/components/controls/LabeledField";
import { Button } from "@/components/ui/actions/button";
import { Input } from "@/components/ui/inputs/input";
import { Textarea } from "@/components/ui/inputs/textarea";
import { blankLine, type LineDraft, type RecipeDraft } from "@/features/meals/editor/draft";
import { IngredientDialog } from "@/features/meals/ingredients/IngredientDialog";
import { IngredientPicker } from "@/features/meals/ingredients/IngredientPicker";

function LineFields({ line, onChange, onRemove }: { line: LineDraft; onChange: (patch: Partial<LineDraft>) => void; onRemove: () => void }) {
  const [creating, setCreating] = useState<string | null>(null);
  return (
    <li className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0">
      <div className="flex gap-1.5">
        <IngredientPicker value={line.ingredient} onChange={(ingredient) => onChange({ ingredient })} onCreate={setCreating} />
        <Button type="button" variant="ghost" size="icon" aria-label="Retirer la ligne" onClick={onRemove}>
          <X />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <LabeledField label="Quantité">
          <Input inputMode="decimal" value={line.quantity} onChange={(e) => onChange({ quantity: e.target.value })} />
        </LabeledField>
        <LabeledField label="Unité">
          <Input value={line.unit} onChange={(e) => onChange({ unit: e.target.value })} />
        </LabeledField>
        <LabeledField label={line.gramsEstimated ? "g · estimé" : "Grammes"}>
          <Input inputMode="decimal" value={line.grams} onChange={(e) => onChange({ grams: e.target.value, gramsEstimated: false })} />
        </LabeledField>
      </div>
      <IngredientDialog
        open={creating !== null}
        onOpenChange={(open) => !open && setCreating(null)}
        ingredient={null}
        initialName={creating ?? ""}
        onSaved={(ingredient) => onChange({ ingredient })}
      />
    </li>
  );
}

/** Recipe part of the edit form: details, steps, ingredient lines. */
export function RecipeFields({ draft, onChange }: { draft: RecipeDraft; onChange: (draft: RecipeDraft) => void }) {
  const setLine = (key: string, patch: Partial<LineDraft>) =>
    onChange({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });

  return (
    <div className="flex flex-col gap-3">
      <LabeledField label="Recette">
        <Input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} required />
      </LabeledField>
      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="Personnes">
          <Input inputMode="numeric" value={draft.servings} onChange={(e) => onChange({ ...draft, servings: e.target.value })} />
        </LabeledField>
        <LabeledField label="Durée (min)">
          <Input inputMode="numeric" value={draft.duration} onChange={(e) => onChange({ ...draft, duration: e.target.value })} />
        </LabeledField>
      </div>
      <LabeledField label="Source">
        <Input type="url" placeholder="https://" value={draft.sourceUrl} onChange={(e) => onChange({ ...draft, sourceUrl: e.target.value })} />
      </LabeledField>
      <LabeledField label="Étapes">
        <Textarea rows={5} value={draft.steps} onChange={(e) => onChange({ ...draft, steps: e.target.value })} />
      </LabeledField>
      <div className="flex flex-col gap-2">
        <span className="micro-label">Ingrédients</span>
        <ul className="flex flex-col gap-3">
          {draft.lines.map((line) => (
            <LineFields
              key={line.key}
              line={line}
              onChange={(patch) => setLine(line.key, patch)}
              onRemove={() => onChange({ ...draft, lines: draft.lines.filter((l) => l.key !== line.key) })}
            />
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange({ ...draft, lines: [...draft.lines, blankLine()] })}>
          <Plus />
          Ligne
        </Button>
      </div>
    </div>
  );
}
