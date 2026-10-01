// Finds cloud models the current Ollama plan can actually run (tiny test per candidate).
// Run with: ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe scripts/find-free-model.mjs [profile]
// profile = subdirectory under %APPDATA% that holds database/jaduu.db (default: Electron)
import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";

const profile = process.argv[2] || "Electron";
const dbPath = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  profile,
  "database",
  "jaduu.db",
);
const db = new Database(dbPath, { readonly: true });
const s = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'app.settings'").get().value);
db.close();

const key = (s.ollamaApiKey || "").trim();
if (!key) {
  console.error("No API key saved in that profile.");
  process.exit(1);
}
const base = s.ollamaUrl.replace(/\/+$/, "");
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const tags = await fetch(`${base}/api/tags`, { headers }).then((r) => r.json());
const names = (tags.models || []).map((m) => m.name);
console.log(`catalog (${names.length}):`, names.join(", "));

// Try smaller models first — they are the likely free-tier ones.
const candidates = names.filter((n) => /(^|:)\S*?(20b|8b|7b|4b|27b|30b)/i.test(n)).slice(0, 5);
console.log("testing:", candidates.join(", "));

for (const model of candidates) {
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: "Say OK" }],
        options: { num_predict: 8, temperature: 0 },
      }),
      signal: AbortSignal.timeout(120000),
    });
    const text = await res.text();
    if (res.ok) {
      const reply = JSON.parse(text).message?.content ?? "";
      console.log(`  ${model} -> ${res.status} OK, reply: ${JSON.stringify(reply.slice(0, 60))}`);
    } else {
      console.log(`  ${model} -> ${res.status} ${text.slice(0, 110)}`);
    }
  } catch (err) {
    console.log(`  ${model} -> ERROR ${err.message}`);
  }
}
