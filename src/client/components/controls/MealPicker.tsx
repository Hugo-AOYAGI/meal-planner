import { Dices } from "lucide-react";
import { useState } from "react";
import type { MealSummary } from "@shared/schemas";
import { COURSES, COURSE_LABELS, type Course, MEAL_KIND_LABELS, courseOf } from "@shared/constants";
import { normalize } from "@shared/text";
import { TextTabs } from "@/components/layout/TextTabs";
import { Button } from "@/components/ui/actions/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/menus/command";
import { useMeals } from "@/lib/api/queries";

const COURSE_TABS = COURSES.map((value) => ({ value, label: COURSE_LABELS[value] }));
const PLACEHOLDERS: Record<Course, string> = {
  entree: "Rechercher une entrée",
  plat: "Rechercher un plat",
  dessert: "Rechercher un dessert",
};

const accentInsensitive = (_value: string, search: string, keywords?: string[]) =>
  normalize((keywords ?? []).join(" ")).includes(normalize(search)) ? 1 : 0;

interface MealPickerProps {
  onPick: (meal: MealSummary) => void;
  /** names what is being filled, e.g. "Midi · samedi 14 novembre" */
  title?: string;
  /** adds a dice that lets the draw choose the main instead */
  onDraw?: () => void;
}

/** Searchable list of the meal library, one course at a time: starters, mains (the default) or desserts. */
export function MealPicker({ onPick, title, onDraw }: MealPickerProps) {
  const meals = useMeals();
  const [course, setCourse] = useState<Course>("plat");
  const draw = course === "plat" ? onDraw : undefined;
  return (
    <Command filter={accentInsensitive} className="p-0" data-keyboard-reveal>
      {/* the input comes first in the DOM so it, not the dice, takes the initial focus */}
      <div className="flex flex-col-reverse">
        <CommandInput placeholder={PLACEHOLDERS[course]} />
        <TextTabs items={COURSE_TABS} value={course} onChange={setCourse} className="px-3 pt-1 md:pt-2" />
        {(title || onDraw) && (
          <div className="flex min-h-9 items-center justify-between gap-2 pr-1 pl-3">
            <span className="micro-label truncate">{title}</span>
            {draw && (
              <Button variant="ghost" size="sm" onClick={draw}>
                <Dices />
                Tirer
              </Button>
            )}
          </div>
        )}
      </div>
      <CommandList className="pt-2 max-md:max-h-[50dvh] keyboard:max-h-[calc(100dvh-8rem)]">
        <CommandEmpty>{meals.isPending ? "…" : "Aucun repas"}</CommandEmpty>
        {meals.data
          ?.filter((m) => courseOf(m.kind) === course)
          .map((m) => (
            <CommandItem key={m.id} value={String(m.id)} keywords={[m.name]} onSelect={() => onPick(m)} className="max-md:min-h-11">
              <span className="flex-1 truncate">{m.name}</span>
              {course === "plat" && <span className="text-xs text-dim">{MEAL_KIND_LABELS[m.kind]}</span>}
            </CommandItem>
          ))}
      </CommandList>
    </Command>
  );
}
