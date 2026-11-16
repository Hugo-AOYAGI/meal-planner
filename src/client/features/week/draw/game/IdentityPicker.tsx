import type { Member } from "@shared/schemas";

/** A member's colour token as a CSS colour. */
export const memberColor = (member: Member) => `var(--${member.color})`;

/** "C'est moi": asked once per device, before its first game. */
export function IdentityPicker({ members, onPick }: { members: Member[]; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base font-bold">Qui joue sur ce téléphone ?</p>
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
      <p className="text-xs text-dim">Ce choix est gardé sur cet appareil.</p>
    </div>
  );
}
