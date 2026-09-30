// Minimal leveled logger for the JADUU main process.
// Writes to console + a log file in userData. Never logs message content.
import path from "node:path";
import fs from "node:fs";

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level = process.env.JADUU_DEBUG ? "debug" : "info";
let stream: fs.WriteStream | null = null;
let logFilePath = "";

export function initFileLogging(logsDir: string): void {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    logFilePath = path.join(logsDir, `jaduu-${stamp}.log`);
    stream = fs.createWriteStream(logFilePath, { flags: "a" });
    stream.on("error", () => { stream = null; });
  } catch {
    stream = null;
  }
}

export function getLogFilePath(): string {
  return logFilePath;
}

function write(level: Level, scope: string, message: string): void {
  if (LEVELS[level] < LEVELS[minLevel]) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${scope}] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  try {
    stream?.write(line + "\n");
  } catch {
    /* logging must never crash the app */
  }
}

export function logger(scope: string) {
  return {
    debug: (msg: string) => write("debug", scope, msg),
    info: (msg: string) => write("info", scope, msg),
    warn: (msg: string) => write("warn", scope, msg),
    error: (msg: string) => write("error", scope, msg),
  };
}

/** Strips anything that could contain user content from an error before logging. */
export function safeError(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 300);
  return String(err).slice(0, 300);
}
