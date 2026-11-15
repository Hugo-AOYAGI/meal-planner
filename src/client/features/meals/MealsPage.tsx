import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { setHash, useHash } from "@/lib/formatting/hash";
import type { MealListQuery } from "@shared/schemas";
import { Toolbar } from "@/components/layout/Toolbar";
import { TextTabs } from "@/components/layout/TextTabs";
import { Button } from "@/components/ui/actions/button";
import { Input } from "@/components/ui/inputs/input";
import { Skeleton } from "@/components/ui/feedback/skeleton";
import { useMeals } from "@/lib/api/queries";
import { useIsWide } from "@/lib/hooks/use-media-query";
import { MealList } from "@/features/meals/panels/MealList";
import { MealPanel } from "@/features/meals/panels/MealPanel";
import { MealSheet } from "@/features/meals/panels/MealSheet";

const FILTERS = [
  { value: "all", label: "Tous", query: {} },
  { value: "plat", label: "Plats", query: { kind: "plat" } },
  { value: "proteine", label: "Protéines", query: { kind: "proteine" } },
  { value: "feculent", label: "Féculents", query: { kind: "feculent" } },
  { value: "legume", label: "Légumes", query: { kind: "legume" } },
  { value: "entree", label: "Entrées", query: { kind: "entree" } },
  { value: "dessert", label: "Desserts", query: { kind: "dessert" } },
  { value: "to_try", label: "À essayer", query: { status: "to_try" } },
] as const satisfies readonly { value: string; label: string; query: MealListQuery }[];
type FilterId = (typeof FILTERS)[number]["value"];

export function MealsPage() {
  const wide = useIsWide();
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const query = FILTERS.find((f) => f.value === filter)!.query;
  const meals = useMeals({ ...query, q: search.trim() || undefined });
  // #repas/12 (a link from the chat) opens that meal
  const linked = useHash().id;
  useEffect(() => {
    if (linked !== null) setSelected(linked);
  }, [linked]);
  const close = () => {
    setSelected(null);
    if (linked !== null) setHash("repas");
  };
  const panel = selected !== null && <MealPanel selected={selected} onSelect={setSelected} onClose={close} />;

  return (
    <div className="mx-auto flex max-w-[68rem] items-start gap-4">
      <div className="min-w-0 flex-1 lg:max-w-2xl">
        <Toolbar
          actions={
            <Button size="sm" aria-label="Nouveau repas" onClick={() => setSelected("new")}>
              <Plus />
              Repas
            </Button>
          }
        >
          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-dim" />
            <Input
              type="search"
              aria-label="Rechercher"
              placeholder="Repas ou ingrédient"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 md:h-8 md:text-xs"
            />
          </div>
        </Toolbar>
        <TextTabs items={FILTERS} value={filter} onChange={setFilter} className="-mx-3.5 mb-3 px-3.5 md:mx-0 md:px-0" />
        {meals.data ? (
          meals.data.length > 0 ? (
            <MealList meals={meals.data} selectedId={typeof selected === "number" ? selected : null} onSelect={setSelected} />
          ) : (
            <p className="py-8 text-center text-xs text-dim">Aucun repas</p>
          )
        ) : (
          <Skeleton className="h-80 w-full" />
        )}
      </div>
      {wide && panel && (
        <aside className="sticky top-17 max-h-[calc(100dvh-84px)] w-[26rem] shrink-0 overflow-y-auto rounded-xl border-2 border-foreground bg-surface">
          {panel}
        </aside>
      )}
      {!wide && <MealSheet selected={selected} onSelect={setSelected} onClose={close} />}
    </div>
  );
}
