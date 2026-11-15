import { NUTRIENTS, NUTRIENT_LABELS, NUTRIENT_UNITS } from "@shared/constants";
import { DAILY_TARGETS, REFERENCE_PROFILE, shareOfTarget } from "@shared/nutrition-targets";
import type { Nutrition } from "@shared/schemas";
import { formatNumber } from "@/lib/formatting/format";
import { NutritionDetail } from "@/features/meals/detail/NutritionDetail";

/** Labels that fit five columns on a phone. */
const SHORT: Record<(typeof NUTRIENTS)[number], string> = {
  kcal: "kcal",
  protein: "Prot.",
  carbs: "Gluc.",
  fat: "Lip.",
  fibre: "Fibres",
};

const TILES = ["bg-[var(--tomato)]", "bg-[var(--sun)]", "bg-[var(--leaf)]", "bg-[var(--sky)]", "bg-subtle"];

const percent = (amount: number, n: (typeof NUTRIENTS)[number]) => `${Math.round(shareOfTarget(n, amount) * 100)} %`;

/** Nutrition per person; "partiel" when some ingredient lines could not be counted. */
export function NutritionStrip({ nutrition }: { nutrition: Nutrition }) {
  const known = nutrition.linesCounted > 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-5 gap-1.5">
        {NUTRIENTS.map((n, i) => (
          <div key={n} className={`min-w-0 rounded-md px-2 py-1.5 ${TILES[i]}`}>
            <b className="block text-[17px] leading-tight font-extrabold tracking-tight whitespace-nowrap tabular-nums">
              {known ? formatNumber(nutrition.perPerson[n]) : "—"}
              {known && n !== "kcal" && <span className="text-xs font-bold"> g</span>}
            </b>
            <span
              className="block truncate text-[11px] font-bold text-dim"
              title={`${NUTRIENT_LABELS[n]} (${NUTRIENT_UNITS[n]})`}
            >
              <span className="md:hidden">{SHORT[n]}</span>
              <span className="max-md:hidden">{n === "kcal" ? "kcal" : NUTRIENT_LABELS[n]}</span>
            </span>
            {known && (
              <span
                className="block text-[11px] font-bold tabular-nums"
                title={`${percent(nutrition.perPerson[n], n)} de l'apport du jour recommandé (${DAILY_TARGETS[n].value} ${NUTRIENT_UNITS[n]})`}
              >
                {percent(nutrition.perPerson[n], n)}
              </span>
            )}
          </div>
        ))}
      </div>
      <NutritionDetail extras={nutrition.extras}>
        <span className="text-[11px] text-dim">
          % de l'apport du jour · {REFERENCE_PROFILE}
          {known && nutrition.partial && <b className="micro-label ml-2">partiel</b>}
        </span>
      </NutritionDetail>
    </div>
  );
}
