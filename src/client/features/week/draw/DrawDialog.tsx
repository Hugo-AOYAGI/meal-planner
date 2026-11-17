import { Button } from "@/components/ui/actions/button";
import { Skeleton } from "@/components/ui/feedback/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays/dialog";
import { GameHeader } from "./game/GameHeader";
import { IdentityPicker } from "./game/IdentityPicker";
import { PassScreen } from "./game/PassScreen";
import { CatchupScreen } from "./screens/CatchupScreen";
import { HandScreen } from "./screens/HandScreen";
import { MatchBurst } from "./screens/MatchBurst";
import { PlacingScreen } from "./screens/PlacingScreen";
import type { GameSession } from "./use-game-session";

function Closing({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="font-bold">{text}</p>
      <Button variant="outline" className="h-11" onClick={onClose}>
        Fermer
      </Button>
    </div>
  );
}

function GameBody({ session }: { session: GameSession }) {
  const { view, identity } = session;
  const close = () => session.setOpen(false);
  if (session.asking) return <IdentityPicker members={identity.members} onPick={session.choose} />;
  if (session.starting) return <Skeleton className="h-72 w-full" />;
  if (!view) return <Closing text="Le tirage est terminé." onClose={close} />;
  if (session.passing) return <PassScreen next={identity.memberOf(view.me)} onContinue={session.handOver} />;
  if (view.phase === "done") return <Closing text="C’est dans le planning ✓" onClose={close} />;
  return (
    <>
      <GameHeader session={session} view={view} />
      {view.phase === "picking" && <HandScreen session={session} view={view} />}
      {view.phase === "catchup" && <CatchupScreen session={session} view={view} />}
      {view.phase === "placing" && <PlacingScreen session={session} view={view} />}
      <MatchBurst view={view} />
    </>
  );
}

/**
 * The draw game's sheet, opened by the planning's "Tirer" and "Ce soir": the hand at once, then the reveal,
 * the catch-up and the result. Closing only hides it: "Tirer" again resumes the game running.
 */
export function DrawDialog({ session }: { session: GameSession }) {
  const quick = (session.view ?? session.running)?.mode === "quick";
  return (
    <Dialog open={session.open} onOpenChange={session.setOpen}>
      <DialogContent className="gap-3 sm:max-w-xl" aria-describedby={undefined}>
        <DialogTitle className="display text-2xl">{quick ? "🌙 Un repas pour ce soir" : "Tirage"}</DialogTitle>
        <GameBody session={session} />
      </DialogContent>
    </Dialog>
  );
}
