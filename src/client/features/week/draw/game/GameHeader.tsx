import { Ellipsis } from "lucide-react";
import type { GameView } from "@shared/schemas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { DrawControls } from "../DrawControls";
import type { GameSession } from "../use-game-session";
import { memberColor } from "./IdentityPicker";

/** What a player is doing, as far as the others may know. */
function statusOf(view: GameView, player: GameView["players"][number]): string {
  if (view.phase === "picking") return player.ready ? "a fini ✓" : "choisit…";
  if (view.phase === "catchup") return "répond…";
  return "";
}

const menuItem = "min-h-11 rounded-md px-3 text-left font-bold hover:bg-subtle focus-visible:outline-2";

/** Players and their status, the options chip and the menu (abandon, change player). */
export function GameHeader({ session, view }: { session: GameSession; view: GameView }) {
  const { memberOf } = session.identity;
  const { days, moments, status } = view.options;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 pr-10">
        <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5" aria-label="Joueurs">
          {view.players.map((player) => {
            const member = memberOf(player.id);
            const doing = statusOf(view, player);
            return (
              <li
                key={player.id}
                className="flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold"
                style={{ backgroundColor: memberColor(member) }}
              >
                {member.name}
                {player.id === view.me && view.players.length > 1 && <span className="text-dim">(toi)</span>}
                {doing && <span className="font-semibold text-dim">{doing}</span>}
              </li>
            );
          })}
        </ul>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Plus d’actions"
              className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-subtle focus-visible:outline-2"
            >
              <Ellipsis className="size-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 gap-1 p-2">
            <button type="button" className={`${menuItem} text-destructive`} onClick={() => session.act({ type: "abandon" })}>
              Abandonner le tirage
            </button>
            {!session.identity.noMembers && (
              <button type="button" className={menuItem} onClick={session.forget}>
                Je ne suis pas {memberOf(view.me).name}
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      {view.mode === "plan" && view.phase !== "done" && (
        <div>
          <DrawControls options={{ days, moments, status }} disabled={session.busy} onChange={(change) => session.act({ type: "options", options: change })} />
        </div>
      )}
    </div>
  );
}
