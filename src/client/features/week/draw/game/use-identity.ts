import { useState } from "react";
import type { Member } from "@shared/schemas";
import { useSettings } from "@/lib/api/queries";

const KEY = "draw-player";

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
 * `me` is null while it has not been chosen (or names a member who was removed): the device is asked who plays,
 * and can add itself as a member from there.
 */
export function useIdentity() {
  const declared = useSettings().data?.members;
  const [id, setId] = useState(load);
  const members = declared ?? [];
  const me = members.find((m) => m.id === id) ?? null;
  const memberOf = (player: string): Member => members.find((m) => m.id === player) ?? { id: player, name: player, color: "sun" };

  return {
    /** settings are loaded: `me` can be trusted */
    ready: declared !== undefined,
    members,
    me,
    memberOf,
    choose(member: string | null) {
      save(member);
      setId(member);
    },
  };
}

export type Identity = ReturnType<typeof useIdentity>;
