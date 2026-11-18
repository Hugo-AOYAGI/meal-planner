import { useQuery } from "@tanstack/react-query";
import type { RefObject } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays/dialog";
import { Markdown } from "./Markdown";

export function FoodLabReader({ id, onClose, returnFocus }: {
  id: string | null; onClose: () => void; returnFocus: RefObject<HTMLAnchorElement | null>;
}) {
  const section = useQuery({
    queryKey: ["food-lab-section", id],
    enabled: id !== null,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/chat/food-lab/${encodeURIComponent(id ?? "")}`, { signal });
      if (response.status === 404) throw new Error("Cette section est introuvable.");
      if (!response.ok) throw new Error("La section n’a pas pu être chargée.");
      return response.text();
    },
  });

  return (
    <Dialog open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          if (!returnFocus.current?.isConnected) return;
          event.preventDefault();
          returnFocus.current.focus({ preventScroll: true });
        }}
        className="flex max-h-[90dvh] flex-col gap-3 overflow-hidden p-0 max-md:overflow-hidden sm:max-w-2xl"
      >
        <DialogTitle className="display px-5 pt-4 pr-14 text-xl">The Food Lab</DialogTitle>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {section.isPending && <p role="status" className="pb-3 text-dim">Chargement de la section…</p>}
          {section.isError && <p role="alert" className="pb-3">{section.error.message}</p>}
          {section.data && <Markdown>{section.data}</Markdown>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
