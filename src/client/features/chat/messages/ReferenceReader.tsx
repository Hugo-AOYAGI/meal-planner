import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays/dialog";
import { Button } from "@/components/ui/actions/button";
import { clientId, unwrap } from "@/lib/api/api";
import { invalidate } from "@/lib/api/query";
import type { ReferenceTarget } from "@shared/references/links";
import { Markdown } from "./Markdown";

export function ReferenceReader({ target, onClose, returnFocus, canSave = true }: {
  target: ReferenceTarget | null; onClose: () => void; returnFocus: RefObject<HTMLAnchorElement | null>; canSave?: boolean;
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: ({ source, id }: ReferenceTarget) => unwrap(fetch(`/api/chat/${source}/${encodeURIComponent(id)}/save`, {
      method: "POST", headers: { "x-client-id": clientId },
    })),
    onSuccess: () => invalidate.meals(qc),
  });
  const saved = save.isSuccess && save.variables === target;
  const section = useQuery({
    queryKey: ["reference-section", target?.source, target?.id],
    enabled: target !== null,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!target) throw new Error("Cette section est introuvable.");
      const response = await fetch(`/api/chat/${target.source}/${encodeURIComponent(target.id)}`, { signal });
      if (response.status === 404) throw new Error("Cette section est introuvable.");
      if (!response.ok) throw new Error("La section n’a pas pu être chargée.");
      return response.text();
    },
  });

  return (
    <Dialog open={target !== null} onOpenChange={(open) => {
      if (!open) {
        save.reset();
        onClose();
      }
    }}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          if (!returnFocus.current?.isConnected) return;
          event.preventDefault();
          returnFocus.current.focus({ preventScroll: true });
        }}
        className="flex max-h-[90dvh] flex-col gap-3 overflow-hidden p-0 max-md:overflow-hidden sm:max-w-2xl"
      >
        <DialogTitle className="display px-5 pt-4 pr-14 text-xl">Référence</DialogTitle>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {section.isPending && <p role="status" className="pb-3 text-dim">Chargement de la section…</p>}
          {section.isError && <p role="alert" className="pb-3">{section.error.message}</p>}
          {section.data && <Markdown>{section.data}</Markdown>}
        </div>
        {canSave && target && section.data && (
          <div className="shrink-0 border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button disabled={save.isPending || saved} onClick={() => save.mutate(target)}>
              {saved ? "Ajouté à « À essayer »" : save.isPending ? "Ajout en cours…" : "Ajouter à « À essayer »"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
