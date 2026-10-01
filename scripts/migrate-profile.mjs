// One-off: merge the working settings from the stray "Electron" profile into the
// real JADUU profile (userData differs because launch.mjs used to pass the JS file).
// Usage: ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe scripts/migrate-profile.mjs [sourceProfile] [targetProfile] [defaultModel]
import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";

const [source = "Electron", target = "JADUU", defaultModel] = process.argv.slice(2);
const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");

function openSettings(profile, readonly) {
  const db = new Database(path.join(base, profile, "database", "jaduu.db"), { readonly });
  return db;
}

const src = openSettings(source, true);
const s = JSON.parse(src.prepare("SELECT value FROM settings WHERE key = 'app.settings'").get().value);
src.close();
if (!s.ollamaApiKey) {
  console.error(`Source profile "${source}" has no API key — nothing to migrate.`);
  process.exit(1);
}

const dst = openSettings(target, false);
const row = dst.prepare("SELECT value FROM settings WHERE key = 'app.settings'").get();
const current = JSON.parse(row.value);
const next = {
  ...current,
  ollamaApiKey: s.ollamaApiKey,
  ollamaUrl: s.ollamaUrl || current.ollamaUrl,
};
if (defaultModel) next.defaultModel = defaultModel;
dst.prepare("UPDATE settings SET value = ? WHERE key = 'app.settings'").run(JSON.stringify(next));
const flag = dst.prepare("SELECT value FROM settings WHERE key = 'ui.onboarded'").get();
if (flag) dst.prepare("UPDATE settings SET value = 'true' WHERE key = 'ui.onboarded'").run();
dst.close();

console.log(`Migrated into ${target}: key ${s.ollamaApiKey.slice(0, 4)}…${s.ollamaApiKey.slice(-2)} (${s.ollamaApiKey.length} chars)${defaultModel ? `, defaultModel=${defaultModel}` : ""}`);
