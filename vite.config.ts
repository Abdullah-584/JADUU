import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(root, "src/renderer"),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.join(root, "src/renderer"),
      "@shared": path.join(root, "src/shared"),
    },
  },
  build: {
    outDir: path.join(root, "dist/renderer"),
    emptyOutDir: true,
    target: "chrome126",
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5183,
    strictPort: true,
  },
  clearScreen: false,
});
