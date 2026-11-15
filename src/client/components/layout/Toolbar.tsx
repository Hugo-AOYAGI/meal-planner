import type { ReactNode } from "react";

interface ToolbarProps {
  /** left side: navigation, filters */
  children: ReactNode;
  /** right side: the page's actions */
  actions?: ReactNode;
}

/** The row under the top bar shared by the three tabs; pinned to the top of the scroll area on phones. */
export function Toolbar({ children, actions }: ToolbarProps) {
  return (
    <div className="sticky top-0 z-10 -mx-3.5 flex items-center gap-2 bg-background px-3.5 py-2 md:static md:mx-0 md:mb-3 md:gap-3 md:px-0 md:py-0">
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
