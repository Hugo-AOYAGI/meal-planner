import { useState } from "react";
import type { Member } from "@shared/schemas";
import { useSettings } from "@/lib/api/queries";

const KEY = "draw-player";

/** Who plays when the household has declared no members: one player, alone. */
export const SOLO_MEMBER: Member = { id: "moi", name: "Moi", color: "sun" };

function load(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function save(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // private window: the choice lasts until the page is reloaded
  }
}

/**
 * "C'est moi": which member this device plays as, remembered in localStorage.
 * `me` is null while it has not been chosen (or names a member who was removed); without members, everyone is `SOLO_MEMBER`.
 */
export function useIdentity() {
  const declared = useSettings().data?.members;
  const [id, setId] = useState(load);
  const members = declared ?? [];
  const noMembers = declared !== undefined && members.length === 0;
  const me = noMembers ? SOLO_MEMBER : (members.find((m) => m.id === id) ?? null);
  const memberOf = (player: string): Member =>
    members.find((m) => m.id === player) ?? (player === SOLO_MEMBER.id ? SOLO_MEMBER : { id: player, name: player, color: "sun" });

  return {
    /** settings are loaded: `me` can be trusted */
    ready: declared !== undefined,
    members,
    noMembers,
    me,
    memberOf,
    choose(member: string | null) {
      save(member);
      setId(member);
    },
  };
}

export type Identity = ReturnType<typeof useIdentity>;
