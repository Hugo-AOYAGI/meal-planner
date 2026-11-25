import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { Toaster } from "@/components/ui/feedback/sonner";
import { TooltipProvider } from "@/components/ui/overlays/tooltip";
import { persistOffline } from "@/lib/api/persist";
import { queryClient } from "@/lib/api/query";
import { watchKeyboard } from "@/lib/keyboard";
import "@/index.css";

// the shopping list and its pending ticks survive a reload without network (see use-shopping)
persistOffline(queryClient, ["shopping"]);
// opens the app without network; not in dev, where Vite serves changing files
if (import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");

watchKeyboard();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <App />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
