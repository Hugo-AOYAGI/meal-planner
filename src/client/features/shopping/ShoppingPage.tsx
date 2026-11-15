import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AISLE_LABELS } from "@shared/constants";
import type { ShoppingItem } from "@shared/schemas";
import { TextTabs } from "@/components/layout/TextTabs";
import { Toolbar } from "@/components/layout/Toolbar";
import { Button } from "@/components/ui/actions/button";
import { Skeleton } from "@/components/ui/feedback/skeleton";
import { formatGrams, formatQuantity, isWeightUnit, mergeQuantities, rangeLabel } from "@/lib/formatting/format";
import { mealHref } from "@/lib/formatting/hash";
import { AddExtra } from "@/features/shopping/AddExtra";
import { ShoppingRow } from "@/features/shopping/ShoppingRow";
import { PERIODS, useShoppingActions, useShoppingList, useShoppingPeriod } from "@/features/shopping/use-shopping";

const PERIOD_TABS = PERIODS.map((days) => ({ value: `${days}` as const, label: `${days} jours` }));

/** "2 gousses + 1 c. à soupe", "1,4 kg"; `approx` is the weight of what is counted in pieces or spoons ("≈ 550 g"). */
function quantityParts({ quantities, totalGrams }: ShoppingItem): { quantity: string; approx?: string } {
  const merged = mergeQuantities(quantities);
  const onlyWeight = merged.every((q) => isWeightUnit(q.unit));
  return {
    quantity: merged.map((q) => formatQuantity(q.quantity, q.unit)).join(" + "),
    approx: totalGrams !== null && !onlyWeight ? `≈ ${formatGrams(totalGrams)}` : undefined,
  };
}

export function ShoppingPage() {
  const [days, setDays] = useShoppingPeriod();
  const list = useShoppingList(days).data;
  const actions = useShoppingActions(days);

  const items = list?.aisles.flatMap((a) => a.items) ?? [];
  const total = items.length + (list?.extras.length ?? 0);
  const done = items.filter((i) => i.checked).length + (list?.extras.filter((e) => e.checked).length ?? 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 md:gap-4">
      <Toolbar actions={list && total > 0 && <span className="micro-label tabular-nums">{done} / {total} cochés</span>}>
        <TextTabs items={PERIOD_TABS} value={`${days}`} onChange={(value) => setDays(PERIODS.find((p) => `${p}` === value)!)} className="[&>button]:md:pb-0" />
      </Toolbar>
      {!list && <Skeleton className="h-64 w-full" />}
      {list && (
        <p className="micro-label -mt-1 ml-0.5">
          {rangeLabel(list.from, list.to)}
          {total === 0 && " · rien à acheter"}
        </p>
      )}
      {list && list.uncounted.length > 0 && (
        <p className="ml-0.5 text-xs text-dim">
          Sans recette, non comptés :{" "}
          {list.uncounted.map((m, i) => (
            <span key={m.mealId}>
              {i > 0 && ", "}
              <a href={mealHref(m.mealId)} className="font-medium text-foreground underline underline-offset-2">
                {m.name}
              </a>
            </span>
          ))}
        </p>
      )}
      {list?.aisles.map(({ aisle, items }) => (
        <ListSection key={aisle} title={AISLE_LABELS[aisle]}>
          {items.map((item) => (
            <ShoppingRow
              key={item.ingredientId}
              label={item.name}
              detail={item.meals.join(", ")}
              {...quantityParts(item)}
              checked={item.checked}
              onCheckedChange={(checked) => actions.checkItem.mutate({ ingredientId: item.ingredientId, checked })}
            />
          ))}
        </ListSection>
      ))}
      {list && (
        <ListSection title="Ajouts">
          {list.extras.map((extra) => (
            <ShoppingRow
              key={extra.id}
              label={extra.label}
              checked={extra.checked}
              onCheckedChange={(checked) => actions.checkExtra.mutate({ id: extra.id, checked })}
              action={
                <Button variant="ghost" size="icon-sm" aria-label="Retirer" className="-mr-2" onClick={() => actions.removeExtra.mutate(extra.id)}>
                  <X />
                </Button>
              }
            />
          ))}
          <AddExtra onAdd={(label) => actions.addExtra.mutate(label)} />
        </ListSection>
      )}
    </div>
  );
}

function ListSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="display mb-2 ml-0.5 text-xl">{title}</h2>
      <ul className="block-list">{children}</ul>
    </section>
  );
}
