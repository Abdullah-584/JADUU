// Runs vitest under Electron's Node runtime (ELECTRON_RUN_AS_NODE=1) so that
// native modules built for Electron's ABI (e.g. better-sqlite3) load correctly.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const electronCmd = process.platform === "win32" ? "electron.cmd" : "electron";

// Spawn the Electron binary directly (`.cmd` shims require shell:true on Windows).
const electronNode = process.platform === "win32"
  ? path.join(projectRoot, "node_modules", "electron", "dist", "electron.exe")
  : path.join(projectRoot, "node_modules", ".bin", electronCmd);

const child = spawn(electronNode, ["node_modules/vitest/vitest.mjs", "run", ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: "inherit",
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
});

child.on("exit", (code) => process.exit(code ?? 1));
