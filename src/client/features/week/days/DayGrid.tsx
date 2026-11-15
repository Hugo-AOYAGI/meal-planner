import { MOMENTS, MOMENT_LABELS, type Moment } from "@shared/constants";
import { isoWeekday, today } from "@shared/dates";
import type { Slot } from "@shared/schemas";
import { dayParts, monthLabel } from "@/lib/formatting/format";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/formatting/utils";
import type { Day } from "@/features/week/days/DayEditor";
import { SlotCard } from "@/features/week/slots/SlotCard";

/** Day header. Today's number is inked in; `month` names the month beside it. */
function DayLabel({ date, month, className }: { date: string; month?: boolean; className?: string }) {
  const { name, day } = dayParts(date);
  const isToday = date === today();
  return (
    <div
      data-date={date}
      className={cn("micro-label flex flex-col gap-0.5 text-foreground", className)}
      aria-current={isToday ? "date" : undefined}
    >
      {name}
      <span className="flex items-center gap-1.5">
        <b
          className={cn(
            "display flex h-8 items-center text-[22px] tabular-nums",
            isToday && "-ml-1 w-8 justify-center rounded-full bg-foreground text-base text-background",
          )}
        >
          {day}
        </b>
        {month && <span className="text-dim">{monthLabel(date, true)}</span>}
      </span>
    </div>
  );
}

/** A day's block colour follows its weekday, exposed to its slots as `--day`: it stays the same as days roll. */
const dayColor = (date: string) => ({ "--day": `var(--day-${isoWeekday(date)})` }) as React.CSSProperties;

const dateOf = (day: Day) => day.soir.date;
const hasLunch = (day: Day) => day.midi.entries.length > 0;
const isFirstOfMonth = (day: Day) => dateOf(day).endsWith("-01");

interface DayGridProps {
  /** consecutive days, 2 slots each (midi, soir), in date order */
  slots: Slot[];
}

/**
 * Dinners are the planning; a lunch shows only once it has a meal. Any card of a day opens both of its meals.
 * Grid: 7 days per row, with a lunch row as soon as one day of the row has a lunch. Phones: one block per day.
 */
export function DayGrid({ slots }: DayGridProps) {
  const mobile = useIsMobile();
  const days: Day[] = [];
  for (let i = 0; i + 1 < slots.length; i += 2) days.push({ midi: slots[i]!, soir: slots[i + 1]! });
  const card = (day: Day, moment: Moment, variant: "row" | "cell", named?: boolean) => (
    <SlotCard key={moment} slot={day[moment]} day={day} variant={variant} named={named} />
  );

  if (mobile) {
    return (
      <div className="flex flex-col gap-1.5">
        {days.map((day) => {
          const date = dateOf(day);
          const planned = hasLunch(day) || day.soir.entries.length > 0;
          return (
            <section
              key={date}
              style={dayColor(date)}
              className={cn(
                "grid grid-cols-[4.25rem_1fr] overflow-hidden rounded-lg",
                planned ? "bg-[var(--day)]" : "bg-subtle",
              )}
            >
              <DayLabel date={date} className="px-3 py-2.5" />
              <div className="min-w-0 divide-y-2 divide-foreground/10">
                {hasLunch(day) && card(day, "midi", "row", true)}
                {card(day, "soir", "row", hasLunch(day))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }
  const rows = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7));
  // the moment column only appears once there are two rows to tell apart; every row of days keeps the same columns
  const labelled = days.some(hasLunch);
  return (
    <div className="flex flex-col gap-5 [--slot-h:clamp(8.75rem,21dvh,12.5rem)]">
      {rows.map((row) => {
        const moments = MOMENTS.filter((m) => m === "soir" || row.some(hasLunch));
        return (
          <div
            key={dateOf(row[0]!)}
            className={cn("grid gap-1.5", labelled ? "grid-cols-[2.5rem_repeat(7,minmax(0,1fr))]" : "grid-cols-7")}
            style={{ gridTemplateRows: `auto repeat(${moments.length}, var(--slot-h))` }}
          >
            {labelled && <span />}
            {row.map((day, i) => (
              <DayLabel
                key={dateOf(day)}
                date={dateOf(day)}
                month={i === 0 || isFirstOfMonth(day)}
                className="px-1 pb-1"
              />
            ))}
            {moments.map((moment) => (
              <div key={moment} className="contents">
                {labelled && <span className="micro-label pt-3">{MOMENT_LABELS[moment]}</span>}
                {row.map((day) => (
                  <div key={dateOf(day)} style={dayColor(dateOf(day))}>
                    {card(day, moment, "cell")}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
