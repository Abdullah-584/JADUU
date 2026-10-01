// JADUU production launcher: verifies build artifacts exist, then starts the app
// detached (no console, no dev server). Used by `npm start` and the desktop shortcut.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const electronBin =
  process.platform === "win32"
    ? path.join(projectRoot, "node_modules", "electron", "dist", "electron.exe")
    : path.join(projectRoot, "node_modules", ".bin", "electron");
const mainEntry = path.join(projectRoot, "dist", "main", "index.js");

const missing = [];
if (!existsSync(electronBin)) missing.push("node_modules/electron — run: npm install");
if (!existsSync(mainEntry)) missing.push("dist/main — run: npm run build");
if (missing.length > 0) {
  console.error(`[jaduu] cannot start — missing artifacts:\n  - ${missing.join("\n  - ")}`);
  process.exit(1);
}

// Pass the project root (not the JS file) so Electron resolves package.json →
// productName "JADUU" → userData %APPDATA%/JADUU (same profile as dev mode).
const child = spawn(electronBin, [projectRoot], {
  cwd: projectRoot,
  detached: true,
  stdio: "ignore",
});
child.unref();
console.log("[jaduu] launched (production build)");
