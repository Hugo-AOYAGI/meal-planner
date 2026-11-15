import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AISLES, AISLE_LABELS, NUTRIENTS, NUTRIENT_LABELS, type Aisle, type IngredientSource, type Nutrient } from "@shared/constants";
import type { CiqualFood, Ingredient } from "@shared/schemas";
import { LabeledField } from "@/components/controls/LabeledField";
import { Button } from "@/components/ui/actions/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays/dialog";
import { Input } from "@/components/ui/inputs/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/actions/select";
import { api, unwrap } from "@/lib/api/api";
import { numberText, parseNumber } from "@/lib/formatting/format";
import { invalidate, keys } from "@/lib/api/query";
import { useDebounced } from "@/lib/hooks/use-debounced";

interface IngredientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create */
  ingredient: Ingredient | null;
  /** name proposed when creating */
  initialName?: string;
  onSaved?: (ingredient: Ingredient) => void;
}

export function IngredientDialog({ open, onOpenChange, ingredient, initialName = "", onSaved }: IngredientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4" onOpenAutoFocus={(e) => ingredient && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{ingredient ? ingredient.name : "Nouvel ingrédient"}</DialogTitle>
        </DialogHeader>
        <IngredientForm
          ingredient={ingredient}
          initialName={initialName}
          onCancel={() => onOpenChange(false)}
          onSaved={(saved) => {
            onOpenChange(false);
            onSaved?.(saved);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

const valueLabel = (n: Nutrient) => (n === "kcal" ? "kcal" : NUTRIENT_LABELS[n]);

function IngredientForm({
  ingredient,
  initialName,
  onCancel,
  onSaved,
}: {
  ingredient: Ingredient | null;
  initialName: string;
  onCancel: () => void;
  onSaved: (ingredient: Ingredient) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(ingredient?.name ?? initialName);
  const [aisle, setAisle] = useState<Aisle>(ingredient?.aisle ?? "autre");
  const [values, setValues] = useState(() =>
    Object.fromEntries(NUTRIENTS.map((n) => [n, numberText(ingredient?.[n] ?? null)])) as Record<Nutrient, string>,
  );
  const [ciqualCode, setCiqualCode] = useState(ingredient?.ciqualCode ?? null);
  const [source, setSource] = useState<IngredientSource>(ingredient?.source ?? "manual");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 200);
  const foods = useQuery({
    queryKey: keys.ciqual.search(q),
    queryFn: () => unwrap(api.ciqual.$get({ query: { q, limit: "6" } })),
    enabled: q.length >= 2,
  });

  const fromCiqual = (food: CiqualFood) => {
    setValues(Object.fromEntries(NUTRIENTS.map((n) => [n, numberText(food[n])])) as Record<Nutrient, string>);
    setCiqualCode(food.code);
    setSource("ciqual");
    setSearch("");
  };

  const save = useMutation({
    mutationFn: () => {
      const json = {
        name: name.trim(),
        aisle,
        kcal: parseNumber(values.kcal),
        protein: parseNumber(values.protein),
        carbs: parseNumber(values.carbs),
        fat: parseNumber(values.fat),
        fibre: parseNumber(values.fibre),
        ciqualCode,
        source,
      };
      return ingredient
        ? unwrap(api.ingredients[":id"].$patch({ param: { id: String(ingredient.id) }, json }))
        : unwrap(api.ingredients.$post({ json }));
    },
    onSuccess: async (saved) => {
      await invalidate.ingredients(qc);
      onSaved(saved);
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation(); // React bubbles portal events: don't submit the recipe form this dialog sits in
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <LabeledField label="Nom">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!ingredient} />
        </LabeledField>
        <LabeledField label="Rayon">
          <Select value={aisle} onValueChange={(v) => setAisle(v as Aisle)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AISLES.map((a) => (
                <SelectItem key={a} value={a}>
                  {AISLE_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="micro-label">Pour 100 g{source === "ciqual" && " · Ciqual"}{source === "estimated" && " · estimé"}</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {NUTRIENTS.map((n) => (
            <LabeledField key={n} label={valueLabel(n)}>
              <Input
                inputMode="decimal"
                value={values[n]}
                onChange={(e) => {
                  setValues({ ...values, [n]: e.target.value });
                  setSource("manual");
                }}
              />
            </LabeledField>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input placeholder="Chercher dans Ciqual" value={search} onChange={(e) => setSearch(e.target.value)} />
        {foods.data && foods.data.length > 0 && (
          <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
            {foods.data.map((food) => (
              <li key={food.code}>
                <button
                  type="button"
                  onClick={() => fromCiqual(food)}
                  className="flex w-full items-baseline justify-between gap-3 border-b border-border px-2.5 py-2 text-left text-xs last:border-b-0 hover:bg-subtle max-md:min-h-11"
                >
                  <span className="min-w-0 truncate">{food.name}</span>
                  <span className="micro-label shrink-0">{food.kcal ?? "—"} kcal</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={save.isPending || !name.trim()}>
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}
