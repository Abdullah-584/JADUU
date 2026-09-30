// JADUU smoke test: launches the built app in self-check mode and verifies
// that main, database, Ollama status probe and IPC init all succeed.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const electronBin = process.platform === "win32"
  ? path.join(projectRoot, "node_modules", "electron", "dist", "electron.exe")
  : path.join(projectRoot, "node_modules", ".bin", "electron");

const child = spawn(
  electronBin,
  [path.join(projectRoot, "dist", "main", "index.js")],
  {
    cwd: projectRoot,
    env: { ...process.env, JADUU_SMOKE: "1", ELECTRON_ENABLE_LOGGING: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let output = "";
const timeout = setTimeout(() => {
  console.error("[smoke] TIMEOUT — app did not report readiness in 60s");
  child.kill();
  console.error(output);
  process.exit(1);
}, 60000);

child.stdout.on("data", (d) => { output += d.toString(); });
child.stderr.on("data", (d) => { output += d.toString(); });

child.on("exit", (code) => {
  clearTimeout(timeout);
  const ok = output.includes("JADUU_SMOKE_OK");
  if (ok) {
    const line = output.split("\n").find((l) => l.includes("JADUU_SMOKE_OK"));
    console.log("[smoke] PASSED:", line?.trim());
    process.exit(0);
  } else {
    console.error("[smoke] FAILED (exit code", code + "):");
    console.error(output);
    process.exit(1);
  }
});
