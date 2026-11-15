import { Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/actions/button";
import { Input } from "@/components/ui/inputs/input";
import { useAddPreference, usePreferences, useRemovePreference } from "@/lib/api/queries";

/** The household's standing notes ("Léo n'aime pas les champignons"): the assistant reads them at every turn. */
export function PreferencesList() {
  const [text, setText] = useState("");
  const preferences = usePreferences().data ?? [];
  const add = useAddPreference();
  const remove = useRemovePreference();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) add.mutate({ text }, { onSuccess: () => setText("") });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <span className="micro-label">Préférences du foyer</span>
      {preferences.length === 0 && (
        <p className="text-xs text-dim">Aucune. L'assistant les retient quand tu les lui dis.</p>
      )}
      <ul className="flex flex-col gap-1">
        {preferences.map((p) => (
          <li key={p.id} className="flex items-start gap-1 text-xs max-md:text-sm">
            <span className="min-w-0 flex-1 py-1 break-words">{p.text}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Oublier « ${p.text} »`}
              onClick={() => remove.mutate(p.id)}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-1">
        <Input
          aria-label="Nouvelle préférence"
          placeholder="Ex. pas de porc"
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="md:h-8 md:text-xs"
        />
        <Button
          type="submit"
          variant="outline"
          size="icon-sm"
          aria-label="Ajouter"
          disabled={!text.trim() || add.isPending}
        >
          <Plus />
        </Button>
      </form>
    </div>
  );
}
