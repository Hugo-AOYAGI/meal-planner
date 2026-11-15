import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src/client"),
      "@shared": path.resolve(import.meta.dirname, "src/shared"),
    },
  },
  server: {
    host: "127.0.0.1",
    proxy: { "/api": `http://127.0.0.1:${process.env.PORT ?? 4173}` },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
