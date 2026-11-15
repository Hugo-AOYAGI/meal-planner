/** Dates are plain `YYYY-MM-DD` strings. Weeks are ISO weeks, identified by their Monday. */
const DAY_MS = 86_400_000;

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

/** Today in the server's local timezone. */
export function today(): string {
  const d = new Date();
  return fmt(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

export function addDays(date: string, n: number): string {
  return fmt(new Date(toUtc(date).getTime() + n * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

/** Monday of the ISO week containing `date`. */
export function mondayOf(date: string): string {
  const dow = (toUtc(date).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -dow);
}

/** `days` consecutive dates starting on `from`. */
export function daysFrom(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

/** The 7 dates of the week starting on `monday`. */
export const weekDays = (monday: string) => daysFrom(monday, 7);

/** ISO weekday: Monday = 1 … Sunday = 7. */
export const isoWeekday = (date: string) => ((toUtc(date).getUTCDay() + 6) % 7) + 1;
