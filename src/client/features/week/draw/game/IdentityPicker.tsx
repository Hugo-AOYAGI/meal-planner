import { useState, type FormEvent } from "react";
import type { Member } from "@shared/schemas";
import { Button } from "@/components/ui/actions/button";
import { Input } from "@/components/ui/inputs/input";
import { useUpdateSettings } from "@/lib/api/queries";

const COLORS: Member["color"][] = ["sun", "tomato", "leaf", "sky", "lilac", "rose"];
const MAX_MEMBERS = 6;

/** A member's colour token as a CSS colour. */
export const memberColor = (member: Member) => `var(--${member.color})`;

/**
 * "C'est moi": asked once per device, before its first game. A player who is not listed yet adds
 * their first name here, which makes them a member of the household (editable later in Foyer).
 */
export function IdentityPicker({ members, onPick }: { members: Member[]; onPick: (id: string) => void }) {
  const update = useUpdateSettings();
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const color = COLORS.find((c) => !members.some((m) => m.color === c)) ?? "sun";
    const member = { id: crypto.randomUUID().slice(0, 8), name: name.trim(), color };
    update.mutate({ members: [...members, member] }, { onSuccess: () => onPick(member.id) });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base font-bold">{members.length ? "Qui joue sur ce téléphone ?" : "Qui joue ? Ton prénom :"}</p>
      {members.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onPick(member.id)}
              className="flex min-h-14 items-center gap-2 rounded-xl px-4 text-left text-base font-extrabold focus-visible:outline-2"
              style={{ backgroundColor: memberColor(member) }}
            >
              C’est moi, {member.name}
            </button>
          ))}
        </div>
      )}
      {members.length < MAX_MEMBERS && (
        <form onSubmit={submit} className="flex flex-col gap-1.5">
          {members.length > 0 && <span className="text-sm font-bold text-dim">Pas dans la liste ?</span>}
          <div className="flex gap-2">
            <Input
              aria-label="Ton prénom"
              placeholder="Prénom"
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 text-base"
            />
            <Button type="submit" className="h-11" disabled={!name.trim() || update.isPending}>
              C’est moi
            </Button>
          </div>
        </form>
      )}
      <p className="text-xs text-dim">Ce choix est gardé sur cet appareil.</p>
    </div>
  );
}
