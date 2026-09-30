// JADUU production build for main + preload bundles
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");

await build({
  entryPoints: [
    path.join(projectRoot, "src/main/index.ts"),
    path.join(projectRoot, "src/preload/index.ts"),
  ],
  outdir: path.join(projectRoot, "dist"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: false,
  minify: false,
  external: ["electron", "better-sqlite3", "pdf-parse", "mammoth", "electron-updater"],
  logLevel: "info",
});

console.log("[jaduu:build-main] main + preload bundles written to dist/");
