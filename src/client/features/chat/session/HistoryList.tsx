import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatConversationSummary } from "@shared/schemas";
import { today } from "@shared/dates";
import { ConfirmDelete } from "@/components/overlays/ConfirmDelete";
import { Skeleton } from "@/components/ui/feedback/skeleton";
import { agoLabel } from "@/lib/formatting/format";
import { keys } from "@/lib/api/query";
import { cn } from "@/lib/formatting/utils";

/** Local calendar day (YYYY-MM-DD) of an ISO timestamp. */
const localDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE");

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok)
    throw new Error(
      ((await res.json().catch(() => null)) as { error?: string } | null)
        ?.error ?? `Erreur ${res.status}`,
    );
  return (res.status === 204 ? undefined : await res.json()) as T;
}

type Props = {
  currentId: string | null;
  onOpen: (id: string) => void;
  onDeleted: (id: string) => void;
};

/** Past conversations, newest first. Tapping a row reopens it. History is shared by all devices. */
export function HistoryList({ currentId, onOpen, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: keys.chat.list,
    queryFn: () => request<ChatConversationSummary[]>("/api/chat"),
    staleTime: 0, // other devices add conversations: always check when the list opens
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      request<void>(`/api/chat/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      onDeleted(id);
      return queryClient.invalidateQueries({ queryKey: keys.chat.all });
    },
  });

  if (isPending)
    return (
      <div className="flex-1 space-y-px p-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  if (!data?.length)
    return (
      <p className="flex-1 px-3 py-6 text-center text-sm text-dim">
        Aucune conversation
      </p>
    );

  const day = today();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
      <ul className="block-list">
        {data.map((c) => (
          <li
            key={c.id}
            className={cn("flex items-center", c.id === currentId && "bg-sun")}
          >
            <button
              type="button"
              aria-current={c.id === currentId ? "true" : undefined}
              onClick={() => onOpen(c.id)}
              className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-2 pl-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="truncate text-[15px] font-bold">{c.title}</span>
              <span className="text-xs text-dim">
                {agoLabel(localDay(c.updatedAt), day)}
              </span>
            </button>
            {/* ConfirmDelete always shows its label: hide it visually (text-[0px]) but keep it as the accessible name */}
            <ConfirmDelete
              label="Supprimer la conversation"
              className="size-11 shrink-0 gap-0 px-0 text-[0px] md:size-9 [&_svg]:size-4"
              title="Supprimer la conversation"
              description="Elle sera supprimée pour tous les appareils."
              onConfirm={() => remove.mutate(c.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
