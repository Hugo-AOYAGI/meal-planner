import { Users } from "lucide-react";
import { useState } from "react";
import { MOMENT_LABELS, MOMENTS, type Moment } from "@shared/constants";
import { Overlay } from "@/components/overlays/Overlay";
import { ServingsStepper } from "@/components/controls/ServingsStepper";
import { Button } from "@/components/ui/actions/button";
import { Checkbox } from "@/components/ui/actions/checkbox";
import { Label } from "@/components/ui/inputs/label";
import { useSettings, useUpdateSettings } from "@/lib/api/queries";
import { MembersList } from "./MembersList";
import { PreferencesList } from "./PreferencesList";
import { ReminderSwitch } from "./ReminderSwitch";

/**
 * Household size (default servings of new slots), the moments a draw starts with, the draw game's players
 * and quick-meal limit, this device's leftover reminders, and the household preferences.
 */
export function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const settings = useSettings().data;
  const update = useUpdateSettings();
  if (!settings) return null;

  const toggleMoment = (moment: Moment, on: boolean) =>
    update.mutate({ drawMoments: MOMENTS.filter((m) => (m === moment ? on : settings.drawMoments.includes(m))) });

  return (
    <Overlay
      open={open}
      onOpenChange={setOpen}
      title="Foyer"
      align="end"
      className="w-72"
      trigger={
        <Button variant="outline" size="sm" aria-label="Foyer et préférences">
          <Users />
          {settings.householdSize}
        </Button>
      }
    >
      <div className="flex items-center gap-2">
        <ServingsStepper value={settings.householdSize} onChange={(n) => update.mutate({ householdSize: n })} />
        <span className="micro-label">personnes</span>
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <span className="micro-label">Tirage par défaut</span>
        {MOMENTS.map((moment) => (
          <Label key={moment} className="min-h-8 gap-2 text-xs font-normal max-md:min-h-11 max-md:text-sm">
            <Checkbox
              checked={settings.drawMoments.includes(moment)}
              onCheckedChange={(on) => toggleMoment(moment, on === true)}
            />
            {MOMENT_LABELS[moment]}
          </Label>
        ))}
      </div>
      <ReminderSwitch />
      <MembersList settings={settings} />
      <PreferencesList />
    </Overlay>
  );
}
