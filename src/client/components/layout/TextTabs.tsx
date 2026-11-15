import { cn } from "@/lib/formatting/utils";

interface TextTabsProps<T extends string> {
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Text tabs; the active one gets the highlighter. */
export function TextTabs<T extends string>({ items, value, onChange, className }: TextTabsProps<T>) {
  return (
    <div role="tablist" className={cn("flex gap-4 overflow-x-auto", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          type="button"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cn(
            "shrink-0 whitespace-nowrap pb-2 text-sm font-bold outline-none focus-visible:text-foreground max-md:min-h-11 max-md:pt-2 max-md:text-[15px]",
            item.value === value ? "text-foreground" : "text-dim hover:text-foreground",
          )}
        >
          <span className={cn("px-0.5", item.value === value && "hl")}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
