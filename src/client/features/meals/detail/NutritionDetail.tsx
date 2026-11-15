import { ChevronDown } from "lucide-react";
import { NUTRIENTS, NUTRIENT_UNITS } from "@shared/constants";
import { DAILY_TARGETS, REFERENCE_SOURCES, shareOfTarget, type DailyTarget } from "@shared/nutrition-targets";
import { EXTRA_NUTRIENTS, EXTRA_NUTRIENT_GROUPS, type ExtraNutrientGroup } from "@shared/nutrients";
import type { Nutrition } from "@shared/schemas";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/feedback/collapsible";
import { formatNumber } from "@/lib/formatting/format";

const GROUPS = Object.keys(EXTRA_NUTRIENT_GROUPS) as ExtraNutrientGroup[];

const KIND_WORDS: Record<DailyTarget["kind"], string> = { min: "au moins", goal: "viser", max: "maximum" };
/** "au moins 380 mg", "maximum 6 g" */
const targetText = (target: DailyTarget, unit: string) =>
  `${KIND_WORDS[target.kind]} ${formatNumber(target.value)} ${unit}`;
const NUTRIENT_TARGETS = NUTRIENTS.map(
  (n) => `${formatNumber(DAILY_TARGETS[n].value)} ${n === "kcal" ? "kcal" : NUTRIENT_UNITS[n]}`,
);

/**
 * The extra values per person behind a "Détail" toggle, closed by default. A star marks the
 * values some ingredient lacks. Renders `children` (the strip's own note) beside the toggle.
 */
export function NutritionDetail({ extras, children }: { extras: Nutrition["extras"]; children?: React.ReactNode }) {
  if (EXTRA_NUTRIENTS.every((n) => extras.perPerson[n.key] === null)) return children;
  const partial = new Set(extras.partial);
  const starred = EXTRA_NUTRIENTS.some((n) => extras.perPerson[n.key] !== null && partial.has(n.key));
  return (
    <Collapsible className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <span>{children}</span>
        <CollapsibleTrigger className="micro-label group -my-1 inline-flex items-center gap-0.5 py-1 hover:text-foreground">
          Détail
          <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="pt-2">
        <div className="columns-2 gap-x-5 text-[13px] leading-tight">
          {GROUPS.map((group) => (
            <dl key={group} className="mb-2.5 break-inside-avoid">
              <dt className="micro-label mb-0.5">{EXTRA_NUTRIENT_GROUPS[group]}</dt>
              {EXTRA_NUTRIENTS.filter((n) => n.group === group).map((n) => {
                const value = extras.perPerson[n.key];
                return (
                  <dd key={n.key} className="border-t border-foreground/15 py-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">{n.label}</span>
                      <b className="whitespace-nowrap tabular-nums">
                        {value === null ? "—" : `${formatNumber(value)} ${n.unit}${partial.has(n.key) ? "*" : ""}`}
                      </b>
                    </div>
                    <span className="block text-[11px] text-dim tabular-nums">
                      {value !== null && `${Math.round(shareOfTarget(n.key, value) * 100)} % · `}
                      {targetText(DAILY_TARGETS[n.key], n.unit)}
                    </span>
                  </dd>
                );
              })}
            </dl>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-dim">
          Par personne, d'après la table Ciqual.
          {starred && " * Valeur partielle : un ingrédient au moins n'a pas cette donnée."}
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-dim">
          Apports du jour visés : {NUTRIENT_TARGETS.join(" · ")} (énergie, protéines, glucides, lipides, fibres).{" "}
          {REFERENCE_SOURCES}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
