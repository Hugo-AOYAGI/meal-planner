import { daysBetween } from "@shared/dates";

const WEIGHT_UNITS = new Set(["g", "kg"]);

const frNumber = (max: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: max });
const NUMBERS = [frNumber(0), frNumber(1), frNumber(2)] as const;

/** French number: comma decimals, fewer decimals the larger the value. */
export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  return NUMBERS[abs >= 100 ? 0 : abs >= 1 ? 1 : 2].format(n);
}

/** "1,4 kg", "250 g" */
export function formatGrams(grams: number): string {
  return grams >= 1000 ? `${formatNumber(grams / 1000)} kg` : `${formatNumber(grams)} g`;
}

/** "1,5 kg", "250 g", "2 gousses", "3" (pieces). Empty when there is no quantity. */
export function formatQuantity(quantity: number | null, unit: string): string {
  if (quantity === null) return "";
  if (unit === "g") return formatGrams(quantity);
  if (unit === "ml" && quantity >= 1000) return `${formatNumber(quantity / 1000)} l`;
  return unit ? `${formatNumber(quantity)} ${unit}` : formatNumber(quantity);
}

/** Sums quantities whose units differ only by a plural s ("2,5 gousses" + "0,25 gousse" is "2,75 gousses"). */
export function mergeQuantities(quantities: { unit: string; quantity: number }[]): { unit: string; quantity: number }[] {
  const groups = new Map<string, { quantity: number; forms: Set<string> }>();
  for (const { unit, quantity } of quantities) {
    const key = unit.replace(/s$/, "");
    const group = groups.get(key) ?? { quantity: 0, forms: new Set<string>() };
    group.quantity += quantity;
    group.forms.add(unit);
    groups.set(key, group);
  }
  return [...groups].map(([key, { quantity, forms }]) => ({
    quantity,
    unit: forms.size === 1 ? [...forms][0]! : quantity >= 2 ? `${key}s` : key,
  }));
}

export const isWeightUnit = (unit: string) => WEIGHT_UNITS.has(unit);

/** Accepts "1,5" or "1.5"; empty or invalid gives null. */
export function parseNumber(text: string): number | null {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() === "" || Number.isNaN(n) ? null : n;
}

/** Numeric value as editable text ("" for null). */
export const numberText = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const dateFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options });

const dayMonth = dateFormat({ day: "numeric", month: "long" });
const dayShortMonth = dateFormat({ day: "numeric", month: "short" });
const weekday = dateFormat({ weekday: "short" });
const weekdayLong = dateFormat({ weekday: "long", day: "numeric", month: "long" });

/** "16 – 22 novembre", "28 déc. – 3 janv." */
export function rangeLabel(from: string, to: string): string {
  const a = utc(from);
  const b = utc(to);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()} – ${dayMonth.format(b)}`;
  return `${dayShortMonth.format(a)} – ${dayShortMonth.format(b)}`;
}

/** { name: "Lun", day: 16 } */
export function dayParts(date: string): { name: string; day: number } {
  const d = utc(date);
  const name = weekday.format(d).replace(".", "");
  return { name: name.charAt(0).toUpperCase() + name.slice(1), day: d.getUTCDate() };
}

const month = dateFormat({ month: "long" });
const monthShort = dateFormat({ month: "short" });

/** "décembre", or "déc." when `short` */
export const monthLabel = (date: string, short = false) => (short ? monthShort : month).format(utc(date));

/** "lundi 16 novembre" */
export const fullDayLabel = (date: string) => weekdayLong.format(utc(date));

/** "jamais", "il y a 3 sem.", "il y a 4 mois" */
export function agoLabel(date: string | null, today: string): string {
  if (date === null) return "jamais";
  const days = daysBetween(date, today);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  if (days < 14) return "la semaine dernière";
  if (days < 60) return `il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `il y a ${Math.floor(days / 30.4)} mois`;
  const years = Math.floor(days / 365);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}
