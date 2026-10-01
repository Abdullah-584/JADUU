// One-off diagnostic: read saved settings, validate the Ollama Cloud key, run a tiny chat.
// Run with: ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe scripts/check-cloud.mjs
import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "JADUU",
  "database",
  "jaduu.db",
);
if (!fs.existsSync(dbPath)) {
  console.error("DB not found:", dbPath);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
let settings = null;
for (const { name } of tables) {
  const cols = db.prepare(`PRAGMA table_info(${JSON.stringify(name)})`).all().map((c) => c.name);
  if (cols.includes("key") && cols.includes("value")) {
    const row = db.prepare(`SELECT value FROM ${JSON.stringify(name)} WHERE key = 'app.settings'`).get();
    if (row) {
      settings = JSON.parse(row.value);
      break;
    }
  }
}
db.close();

if (!settings) {
  console.error("app.settings row not found");
  process.exit(1);
}

const key = (settings.ollamaApiKey || "").trim();
console.log("ollamaUrl:   ", settings.ollamaUrl);
console.log("defaultModel:", settings.defaultModel);
console.log(
  "apiKey:      ",
  key ? `saved (${key.slice(0, 4)}…${key.slice(-2)}, ${key.length} chars)` : "EMPTY — nothing saved yet",
);
if (!key) process.exit(2);

const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const base = settings.ollamaUrl.replace(/\/+$/, "");

// 1) Credential check — same probe JADUU's connection check uses.
const me = await fetch(`${base}/api/me`, { method: "POST", headers, body: "{}", signal: AbortSignal.timeout(20000) });
console.log(`/api/me:      ${me.status} ${me.statusText}`);
if (me.ok) {
  const info = await me.json();
  const safe = { ...info };
  if (safe.api_key) safe.api_key = "***";
  console.log("account:     ", JSON.stringify(safe).slice(0, 300));
} else {
  console.log("body:        ", (await me.text()).slice(0, 200));
}

// 2) A real (tiny) chat — exactly the endpoint + auth JADUU's chat uses.
const model = settings.defaultModel || "deepseek-v4-pro:0813";
const t0 = Date.now();
let res;
try {
  res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      options: { num_predict: 64, temperature: 0 },
    }),
    signal: AbortSignal.timeout(120000),
  });
} catch (err) {
  console.log(`/api/chat (${model}): FAILED — ${err.message}`);
  process.exit(3);
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`/api/chat (${model}): ${res.status} ${res.statusText} (${secs}s)`);
const text = await res.text();
if (res.ok) {
  const data = JSON.parse(text);
  console.log("reply:       ", JSON.stringify(data.message?.content ?? data).slice(0, 400));
} else {
  console.log("body:        ", text.slice(0, 300));
}
