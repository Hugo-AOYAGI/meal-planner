import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import type { Ingredient } from "@shared/schemas";
import { normalize } from "@shared/text";
import { Button } from "@/components/ui/actions/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/menus/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { api, unwrap } from "@/lib/api/api";
import { keys } from "@/lib/api/query";
import { useDebounced } from "@/lib/hooks/use-debounced";

interface IngredientPickerProps {
  value: Ingredient | null;
  onChange: (ingredient: Ingredient) => void;
  /** asked to create an ingredient with this name; the parent opens the ingredient dialog */
  onCreate: (name: string) => void;
}

/** Combobox over the household's ingredients, with "create" for unknown names. */
export function IngredientPicker({ value, onChange, onCreate }: IngredientPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 150);
  const list = useQuery({
    queryKey: keys.ingredients.search(q),
    queryFn: () => unwrap(api.ingredients.$get({ query: { q } })),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const name = search.trim();
  const exists = list.data?.some((i) => normalize(i.name) === normalize(name));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="min-w-0 flex-1 justify-between font-normal">
          <span className={value ? "truncate" : "text-muted-foreground"}>{value?.name ?? "Ingrédient"}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      {/* fits the room left by the keyboard: the list scrolls instead of going under it */}
      <PopoverContent align="start" className="max-h-(--radix-popover-content-available-height) w-72 gap-0 p-0">
        <Command shouldFilter={false} className="min-h-0 p-0">
          <CommandInput placeholder="Rechercher" value={search} onValueChange={setSearch} />
          <CommandList className="min-h-0">
            <CommandEmpty>Aucun ingrédient</CommandEmpty>
            {list.data?.map((i) => (
              <CommandItem
                key={i.id}
                value={String(i.id)}
                className="max-md:min-h-11"
                onSelect={() => {
                  onChange(i);
                  setOpen(false);
                }}
              >
                {i.name}
              </CommandItem>
            ))}
            {name && !exists && (
              <CommandItem
                value="create"
                className="max-md:min-h-11"
                onSelect={() => {
                  setOpen(false);
                  onCreate(name);
                }}
              >
                <Plus />
                Créer « {name} »
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
