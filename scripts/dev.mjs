// JADUU dev orchestrator: esbuild (main+preload, watch) + vite (renderer) + electron
import { context } from "esbuild";
import { createServer } from "vite";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");

let electronProcess = null;
let viteServer = null;
let shuttingDown = false;
let initialBuildDone = false;

const nodeExternals = ["electron", "better-sqlite3", "pdf-parse", "mammoth", "electron-updater"];

async function buildMain(watch) {
  const ctx = await context({
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
    plugins: [
      {
        name: "jaduu-rebuild",
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length > 0) {
              console.error("[jaduu:main] rebuild failed:", result.errors[0]?.text ?? "unknown");
              return;
            }
            if (!watch) return;
            // The first onEnd is the initial build — Electron is started explicitly
            // after Vite is up. Only subsequent builds restart the app.
            if (!initialBuildDone) {
              initialBuildDone = true;
              console.log("[jaduu:main] initial build done");
              return;
            }
            restartElectron();
          });
        },
      },
    ],
  });

  if (watch) {
    await ctx.watch();
    console.log("[jaduu:main] watching for changes…");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

function startElectron() {
  if (shuttingDown || electronProcess) return;
  const electronBin = process.platform === "win32"
    ? path.join(projectRoot, "node_modules", "electron", "dist", "electron.exe")
    : path.join(projectRoot, "node_modules", ".bin", "electron");
  electronProcess = spawn(
    electronBin,
    ["."],
    {
      cwd: projectRoot,
      stdio: ["inherit", "inherit", "inherit"],
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" },
    },
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
  if (shuttingDown) return;
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
  configFile: path.join(projectRoot, "vite.config.ts"),
  root: path.join(projectRoot, "src/renderer"),
  server: { port: 5183, strictPort: true },
  mode: "development",
  resolve: {
    alias: {
      "@": path.join(projectRoot, "src/renderer"),
      "@shared": path.join(projectRoot, "src/shared"),
    },
  },
});
await viteServer.listen();
console.log("[jaduu:vite] renderer dev server on http://localhost:5183");

process.env.VITE_DEV_SERVER_URL = "http://localhost:5183";
startElectron();
