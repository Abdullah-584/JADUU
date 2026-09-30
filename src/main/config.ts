import path from "node:path";
import fs from "node:fs";

/**
 * Folders JADUU owns inside the OS app-data directory:
 *   Windows: %APPDATA%/JADUU
 *   macOS:   ~/Library/Application Support/JADUU
 * This module must stay Electron-free so tests can use it with an explicit base.
 */
export function ensureAppDirectories(userDataDir: string): { dbPath: string; logsDir: string } {
  const dbDir = path.join(userDataDir, "database");
  const logsDir = path.join(userDataDir, "logs");
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
  return { dbPath: path.join(dbDir, "jaduu.db"), logsDir };
}
