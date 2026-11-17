import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AISLE_LABELS } from "@shared/constants";
import type { ShoppingExtra, ShoppingItem } from "@shared/schemas";
import { TextTabs } from "@/components/layout/TextTabs";
import { Toolbar } from "@/components/layout/Toolbar";
import { Button } from "@/components/ui/actions/button";
import { Skeleton } from "@/components/ui/feedback/skeleton";
import { formatGrams, formatQuantity, isWeightUnit, mergeQuantities, rangeLabel } from "@/lib/formatting/format";
import { AddExtra } from "@/features/shopping/AddExtra";
import { MealsSection } from "@/features/shopping/MealsSection";
import { ShoppingRow } from "@/features/shopping/ShoppingRow";
import { PERIODS, useShoppingActions, useShoppingList, useShoppingPending, useShoppingPeriod } from "@/features/shopping/use-shopping";

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
  const query = useShoppingList(days);
  const list = query.data;
  const pending = useShoppingPending();
  const actions = useShoppingActions(days);

  const items = list?.aisles.flatMap((a) => a.items) ?? [];
  const extras = list?.extras ?? [];
  const total = items.length + extras.length;
  const doneItems = items.filter((i) => i.checked);
  const doneExtras = extras.filter((e) => e.checked);
  const done = doneItems.length + doneExtras.length;

  const itemRow = (item: ShoppingItem, detail: string) => (
    <ShoppingRow
      key={item.ingredientId}
      label={item.name}
      detail={detail}
      {...quantityParts(item)}
      checked={item.checked}
      onCheckedChange={(checked) => actions.checkItem.mutate({ ingredientId: item.ingredientId, checked })}
    />
  );
  const extraRow = (extra: ShoppingExtra) => (
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
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 md:gap-4">
      <Toolbar actions={list && total > 0 && <span className="micro-label tabular-nums">{done} / {total} cochés</span>}>
        <TextTabs items={PERIOD_TABS} value={`${days}`} onChange={(value) => setDays(PERIODS.find((p) => `${p}` === value)!)} className="[&>button]:md:pb-0" />
      </Toolbar>
      {!list && !query.isError && <Skeleton className="h-64 w-full" />}
      {!list && query.isError && <p className="ml-0.5 text-sm text-dim">Liste indisponible : {query.error.message}</p>}
      {list && (
        <p className="micro-label -mt-1 ml-0.5">
          {rangeLabel(list.from, list.to)}
          {total === 0 && " · rien à acheter"}
          {query.isError && ` · hors ligne${pending > 0 ? `, ${pending} en attente` : ""}`}
        </p>
      )}
      {list && <MealsSection meals={list.meals} onToggle={(m, excluded) => actions.excludeMeal.mutate({ entryId: m.entryId, excluded })} />}
      {list?.aisles.map(({ aisle, items }) => {
        const open = items.filter((i) => !i.checked);
        return open.length > 0 && (
          <ListSection key={aisle} title={AISLE_LABELS[aisle]}>
            {open.map((item) => itemRow(item, item.meals.join(", ")))}
          </ListSection>
        );
      })}
      {list && (
        <ListSection title="Ajouts">
          {extras.filter((e) => !e.checked).map(extraRow)}
          <AddExtra onAdd={(label) => actions.addExtra.mutate(label)} />
        </ListSection>
      )}
      {done > 0 && (
        <ListSection title={`Cochés (${done})`}>
          {doneItems.map((item) => itemRow(item, AISLE_LABELS[item.aisle]))}
          {doneExtras.map(extraRow)}
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
