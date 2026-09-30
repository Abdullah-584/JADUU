// JADUU dev orchestrator: esbuild (main+preload, watch) + vite (renderer) + electron
import { build } from "esbuild";
import { createServer } from "vite";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");

let electronProcess = null;
let viteServer = null;
let shuttingDown = false;

const nodeExternals = ["electron", "better-sqlite3", "pdf-parse", "mammoth", "electron-updater"];

async function buildMain(watch) {
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
    sourcemap: watch ? "inline" : false,
    external: nodeExternals,
    logLevel: "info",
    watch: watch ? { onRebuild(error) {
      if (error) console.error("[jaduu:main] rebuild failed:", error.message);
      else restartElectron();
    } } : undefined,
  });
}

function startElectron() {
  if (shuttingDown) return;
  const electronBin = process.platform === "win32"
    ? path.join(projectRoot, "node_modules", "electron", "dist", "electron.exe")
    : path.join(projectRoot, "node_modules", ".bin", "electron");
  electronProcess = spawn(
    electronBin,
    ["."],
    { cwd: projectRoot, stdio: ["inherit", "inherit", "inherit"], env: process.env },
  );
  electronProcess.on("exit", (code) => {
    electronProcess = null;
    if (!shuttingDown && code !== 0 && code !== null) {
      console.log(`[jaduu:electron] exited with code ${code}`);
    }
    if (!shuttingDown) shutdown(0);
  });
}

function restartElectron() {
  if (electronProcess) {
    electronProcess.removeAllListeners("exit");
    electronProcess.kill();
    electronProcess = null;
  }
  startElectron();
}

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  try { electronProcess?.kill(); } catch {}
  try { await viteServer?.close(); } catch {}
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

await buildMain(true);

viteServer = await createServer({
  root: path.join(projectRoot, "src/renderer"),
  server: { port: 5183, strictPort: true },
  mode: "development",
});
await viteServer.listen();
console.log("[jaduu:vite] renderer dev server on http://localhost:5183");

process.env.VITE_DEV_SERVER_URL = "http://localhost:5183";
startElectron();
