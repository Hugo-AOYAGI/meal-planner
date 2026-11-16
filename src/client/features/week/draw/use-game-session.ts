import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { GameAction, GameMode, GameView } from "@shared/schemas";
import { api, unwrap } from "@/lib/api/api";
import { invalidate, keys } from "@/lib/api/query";
import { useIdentity } from "./game/use-identity";

/** Reads the game for a device that has not said who it is yet: enough to see that a game runs and who plays. */
const GUEST = "invite";

const fetchView = (player: string) => unwrap(api.game.$get({ query: { player } }));

/** Whether the player of `view` still has something to do before the game moves on. */
export function hasTurn(view: GameView): boolean {
  if (view.phase === "picking") return !view.players.find((p) => p.id === view.me)?.ready;
  if (view.phase === "catchup") return view.toAnswer.some((card) => !(card.id in view.myAnswers));
  return false;
}

/**
 * The draw game on this device: who plays here, the running game (polled through the `draw` live event),
 * the sheet's open state and the moves. With a same-phone partner, the device plays both players in turn:
 * `view` is the one whose turn it is, and `passing` asks to hand the phone over first.
 */
export function useGameSession() {
  const qc = useQueryClient();
  const identity = useIdentity();
  const me = identity.me?.id ?? null;
  const [open, setOpen] = useState(false);
  /** the mode to start once this device has said who it is */
  const [pending, setPending] = useState<GameMode | null>(null);
  /** same-phone duo: the other player, played from this device for one game */
  const [partner, setPartner] = useState<{ game: string; id: string } | null>(null);
  /** the local player whose screen was last shown */
  const [shown, setShown] = useState<string | null>(null);

  const viewer = me ?? GUEST;
  const mine = useQuery({ queryKey: keys.game.view(viewer), queryFn: () => fetchView(viewer), enabled: identity.ready });
  const running = mine.data ?? null;
  const partnerId =
    partner && running && partner.game === running.id && running.players.some((p) => p.id === partner.id)
      ? partner.id
      : null;
  const theirs = useQuery({
    queryKey: keys.game.view(partnerId ?? ""),
    queryFn: () => fetchView(partnerId!),
    enabled: !!partnerId,
  });

  /** Keeps the answer for `player` and refreshes the other local views. */
  const store = (player: string, next: GameView | null) => {
    qc.setQueryData(keys.game.view(player), next);
    void qc.invalidateQueries({ queryKey: keys.game.all, predicate: (q) => q.queryKey[1] !== player });
  };
  const start = useMutation({
    scope: { id: "game" },
    mutationFn: ({ player, mode }: { player: string; mode: GameMode }) =>
      unwrap(api.game.start.$post({ json: { player, mode } })),
    onSuccess: (next, { player }) => store(player, next),
    onError: () => setOpen(false),
  });
  const act = useMutation({
    scope: { id: "game" },
    mutationFn: ({ player, action }: { player: string; action: GameAction }) =>
      unwrap(api.game.act.$post({ json: { player, action } })),
    onSuccess: (next, { player, action }) => {
      store(player, next);
      if (action.type === "validate") {
        void invalidate.plan(qc);
        setOpen(false);
        toast.success("Ajouté au planning");
      }
      if (action.type === "abandon") setOpen(false);
    },
  });

  const begin = (player: string, mode: GameMode) => {
    setShown(player);
    start.mutate({ player, mode });
  };

  // same phone: both views must be at the same step before choosing whose turn it is
  const views = [running, partnerId ? theirs.data : null].filter((v): v is GameView => !!v);
  const synced = views.every((v) => v.phase === views[0]!.phase && v.round === views[0]!.round);
  const view = (synced ? views.find(hasTurn) : undefined) ?? views[0] ?? null;
  const passing =
    views.length === 2 && !!view && view.me !== (shown ?? me) && (view.phase === "picking" || view.phase === "catchup");

  return {
    identity,
    open,
    setOpen,
    /** the running game as this device's member sees it (for the join banner) */
    running,
    /** the screen to show: the local player whose turn it is */
    view,
    /** same phone: the screen waits for the phone to be handed to `view.me` */
    passing,
    /** asking "c'est moi" before starting */
    asking: pending !== null && !identity.me,
    starting: start.isPending,
    busy: act.isPending || start.isPending,
    /** Opens the sheet and starts a game, or joins / resumes the one running. */
    launch(mode: GameMode) {
      setOpen(true);
      if (me) begin(me, mode);
      else setPending(mode);
    },
    choose(player: string) {
      identity.choose(player);
      if (pending) begin(player, pending);
      setPending(null);
    },
    /** "Ce n'est pas moi": forget this device's member and close. */
    forget() {
      identity.choose(null);
      setOpen(false);
    },
    act(action: GameAction) {
      if (view) act.mutate({ player: view.me, action });
    },
    /** Same phone: `player` joins and plays from this device after the current player. */
    playTogether(player: string) {
      if (!running) return;
      setPartner({ game: running.id, id: player });
      act.mutate({ player, action: { type: "join" } });
    },
    handOver() {
      if (view) setShown(view.me);
    },
    /** whether `player` plays from this device */
    isLocal: (player: string) => player === me || player === partnerId,
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
