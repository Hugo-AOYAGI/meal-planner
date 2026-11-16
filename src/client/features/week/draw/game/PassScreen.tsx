import type { Member } from "@shared/schemas";
import { Button } from "@/components/ui/actions/button";
import { memberColor } from "./IdentityPicker";

/** Same phone: hides the previous player's choices until the next one holds the phone. */
export function PassScreen({ next, onContinue }: { next: Member; onContinue: () => void }) {
  return (
    <div
      className="flex min-h-72 flex-col items-center justify-center gap-5 rounded-2xl p-6 text-center"
      style={{ backgroundColor: memberColor(next) }}
    >
      <span className="text-5xl" aria-hidden="true">
        🙈
      </span>
      <p className="display text-3xl">Au tour de {next.name}</p>
      <p className="font-bold">Passe le téléphone, et ne regarde pas !</p>
      <Button size="lg" className="h-12 px-6 text-base" onClick={onContinue}>
        C’est moi, {next.name}
      </Button>
    </div>
  );
}
