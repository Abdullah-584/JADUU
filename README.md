# JADUU

> **Apki soch ka digital saathi.** — *Your private AI companion.*

JADUU is a local-first, privacy-obsessed AI desktop assistant for **Windows** and **macOS**.
It chats, reads your documents, indexes your files and answers questions — entirely on your
machine, powered by [Ollama](https://ollama.com). No cloud AI. No API keys. No telemetry.

```
User → JADUU → Local Ollama → Local Model → JADUU → User
```

No mandatory server exists between you and your AI.

---

## Features

- **Chat with local AI** — streaming responses, stop/regenerate, markdown, tables and
  syntax-highlighted code blocks with copy buttons.
- **Model management** — auto-detects installed Ollama models, switch any time, set a default.
- **Persistent history** — conversations grouped by Today / Yesterday / Previous 7 Days,
  rename, delete, clear.
- **Private file workspace** — add PDF, DOCX, TXT, MD, CSV, JSON, XML, YAML, code files
  (JS/TS/JSX/TSX/HTML/CSS/SQL/PY/JAVA/C/CPP) via picker or drag-and-drop.
- **Local RAG** — text is extracted *on your machine*, chunked and indexed into SQLite FTS5.
  Questions retrieve the relevant sections — no giant document dumps.
- **Global search** — across file names, document contents, conversations and messages.
- **Quick Assistant** — floating always-on-top window (`Ctrl+Shift+Space` /
  `Cmd+Shift+Space`) with clipboard assistance: Explain / Fix / Summarize / Translate / Improve.
- **Tray / menu bar** — runs in the background with Ollama status and quick actions.
- **Dark & light themes**, font-size control, reduced animations, configurable shortcuts.

## Requirements

- [Node.js](https://nodejs.org) 20+
- [Ollama](https://ollama.com/download) installed and running (default `http://localhost:11434`)
- At least one model, e.g. `ollama pull qwen3` or `ollama pull llama3.2`

## Getting started

```bash
npm install
npm run dev
```

On first launch JADUU walks you through a three-step onboarding: welcome → Ollama check →
model selection. If Ollama isn't running, it shows exactly how to start it (it never
installs anything for you).

## Scripts

| Command                | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Dev mode: esbuild watch + Vite + Electron               |
| `npm run build`        | Generate assets + build main/preload/renderer bundles   |
| `npm test`             | Full test suite (46 tests, runs under Electron's Node)  |
| `npm run typecheck`    | Strict TypeScript check                                 |
| `npm run lint`         | ESLint                                                  |
| `npm run smoke`        | Build + launch the real app in self-check mode          |
| `npm run build:windows`| Produce `JADUU Setup <version> <arch>.exe` (NSIS)       |
| `npm run build:mac`    | Produce `JADUU <version> <arch>.dmg`                    |

## Architecture

```
src/
├── main/            # Electron main process
│   ├── index.ts         # app lifecycle, tray, shortcuts, smoke check
│   ├── windows/         # main window + floating quick assistant
│   ├── ipc/             # every channel zod-validated
│   ├── ollama/          # AIProvider interface + OllamaProvider + service
│   ├── database/        # better-sqlite3, migrations, repositories
│   ├── files/           # parser → chunker → indexer → FTS5 search
│   ├── services/        # chat orchestration (RAG context, streaming)
│   ├── shortcuts/       # global accelerator registration
│   └── tray/            # system tray / macOS menu bar
├── preload/         # contextBridge — the only React↔Electron path
├── renderer/        # React + Zustand + Tailwind (design-token driven)
└── shared/          # types, constants, zod schemas shared by all layers
```

Key decisions:

- **Provider interface** (`AIProvider`) — Ollama today; other backends possible without
  touching the UI.
- **contextIsolation: true, nodeIntegration: false** — the renderer never sees Node;
  all IPC inputs are validated with shared zod schemas.
- **SQLite (WAL) with versioned migrations** — conversations, messages, files, chunks,
  settings, plus FTS5 with sync triggers for local retrieval.
- **Streaming end-to-end** — Ollama NDJSON → main process → `chat:stream-event` → Zustand,
  with abort support from the Stop button.

## Privacy

- Chats, files, indexes and settings live in
  `%APPDATA%/JADUU/` (Windows) or `~/Library/Application Support/JADUU/` (macOS).
- File text extraction is local (`pdf-parse`, `mammoth`, plain reads) — nothing uploads.
- Local-only mode is on by default; there is no telemetry, ever.
- Logs contain diagnostics only — never message content.

## Build outputs

- Windows: `release/<version>/JADUU Setup <version> x64.exe` (and `arm64`)
- macOS: `release/<version>/JADUU <version> arm64.dmg` / `x64.dmg`

Auto-updates (production only) use GitHub Releases via `electron-updater`.

## Branding

The spark-and-orbit mark, tray icons and installer artwork are generated procedurally by
`scripts/gen-assets.mjs` — 100% original, no third-party assets.
