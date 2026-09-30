import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useOllamaStore } from "../stores/ollamaStore";
import { useChatStore } from "../stores/chatStore";
import { IconCheck, IconRefresh } from "../components/icons";
import { DEFAULT_SHORTCUT, DEFAULT_OLLAMA_URL } from "@shared/constants";
import type { ThemeMode } from "@shared/types";

type Section = "ai" | "appearance" | "shortcut" | "privacy";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "ai", label: "AI" },
  { id: "appearance", label: "Appearance" },
  { id: "shortcut", label: "Shortcuts" },
  { id: "privacy", label: "Privacy" },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <div className="text-sm text-txt-1">{label}</div>
        {hint ? <div className="mt-0.5 text-xs text-txt-3">{hint}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const status = useOllamaStore((s) => s.status);
  const refresh = useOllamaStore((s) => s.refresh);
  const models = useOllamaStore((s) => s.models);
  const refreshModels = useOllamaStore((s) => s.refreshModels);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);

  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | boolean>(null);
  const [shortcutDraft, setShortcutDraft] = useState(settings.shortcutQuickAssistant);

  useEffect(() => setOllamaUrl(settings.ollamaUrl), [settings.ollamaUrl]);
  useEffect(() => setSystemPrompt(settings.systemPrompt), [settings.systemPrompt]);

  const online = status?.online ?? false;

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await update({ ollamaUrl });
      const result = await refresh(true);
      setTestResult(result?.online ?? false);
      await refreshModels(true);
    } finally {
      setTesting(false);
    }
  };

  const captureShortcut = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.metaKey) parts.push("Cmd");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    const key = e.key;
    if (!["Control", "Meta", "Alt", "Shift"].includes(key) && key.length === 1) {
      parts.push(key.toUpperCase());
      const accelerator = parts.join("+");
      setShortcutDraft(accelerator);
      void update({ shortcutQuickAssistant: accelerator });
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <h1 className="text-lg font-semibold text-txt-1">Settings</h1>

        <div className="mt-4 flex gap-2">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-txt-2 transition-colors hover:text-txt-1"
            >
              {section.label}
            </a>
          ))}
        </div>

        {/* ------------------------------- AI ------------------------------- */}
        <section id="ai" className="mt-6 rounded-2xl border border-line bg-surface px-5 py-2">
          <h2 className="py-2 text-sm font-semibold text-txt-1">AI — Ollama</h2>
          <div className="divide-y divide-line">
            <Row label="Ollama URL" hint={`Default: ${DEFAULT_OLLAMA_URL}`}>
              <input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-64 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-txt-1 outline-none focus:border-line-strong"
              />
            </Row>
            <Row label="Connection" hint={online ? `Connected ${status?.version ? `· v${status.version}` : ""}` : "Offline — start Ollama"}>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${online ? "bg-ok" : "bg-danger"}`} />
                <button
                  type="button"
                  onClick={() => void testConnection()}
                  disabled={testing}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-txt-2 transition-colors hover:text-txt-1 disabled:opacity-50"
                >
                  {testing ? "Testing…" : "Test Connection"}
                </button>
                {testResult != null ? (
                  <span className={`inline-flex items-center gap-1 text-xs ${testResult ? "text-ok" : "text-danger"}`}>
                    <IconCheck size={12} /> {testResult ? "OK" : "Failed"}
                  </span>
                ) : null}
              </div>
            </Row>
            <Row label="Model" hint="Default model for new chats">
              <div className="flex items-center gap-2">
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    void update({ defaultModel: e.target.value });
                  }}
                  className="w-56 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-txt-1 outline-none focus:border-line-strong"
                >
                  {models.length === 0 ? <option value="">No models installed</option> : null}
                  {models.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void refreshModels(true)}
                  className="rounded-lg border border-line p-1.5 text-txt-3 hover:text-txt-1"
                  title="Refresh models"
                >
                  <IconRefresh size={13} />
                </button>
              </div>
            </Row>
            <Row label="Temperature" hint={`${settings.temperature.toFixed(1)} — higher is more creative`}>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.1}
                value={settings.temperature}
                onChange={(e) => void update({ temperature: Number(e.target.value) })}
                className="w-48 accent-[var(--accent)]"
              />
            </Row>
            <div className="py-3">
              <div className="text-sm text-txt-1">System Prompt</div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                onBlur={() => void update({ systemPrompt })}
                rows={5}
                className="mt-2 w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-txt-1 outline-none focus:border-line-strong"
              />
            </div>
          </div>
        </section>

        {/* --------------------------- Appearance --------------------------- */}
        <section id="appearance" className="mt-4 rounded-2xl border border-line bg-surface px-5 py-2">
          <h2 className="py-2 text-sm font-semibold text-txt-1">Appearance</h2>
          <div className="divide-y divide-line">
            <Row label="Theme">
              <div className="flex rounded-lg border border-line p-0.5">
                {(["dark", "light", "system"] as ThemeMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => void update({ theme: mode })}
                    className={`rounded-md px-3 py-1 text-xs capitalize transition-colors ${
                      settings.theme === mode ? "bg-accent text-accent-ink" : "text-txt-2 hover:text-txt-1"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Font size">
              <div className="flex rounded-lg border border-line p-0.5">
                {(["sm", "md", "lg"] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => void update({ fontSize: size })}
                    className={`rounded-md px-3 py-1 text-xs uppercase transition-colors ${
                      settings.fontSize === size ? "bg-accent text-accent-ink" : "text-txt-2 hover:text-txt-1"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Animations" hint="Subtle motion throughout the app">
              <Toggle checked={settings.animations} onChange={(v) => void update({ animations: v })} />
            </Row>
            <Row label="Compact mode" hint="Tighter spacing, more on screen">
              <Toggle checked={settings.compactMode} onChange={(v) => void update({ compactMode: v })} />
            </Row>
          </div>
        </section>

        {/* ---------------------------- Shortcuts ---------------------------- */}
        <section id="shortcut" className="mt-4 rounded-2xl border border-line bg-surface px-5 py-2">
          <h2 className="py-2 text-sm font-semibold text-txt-1">Shortcuts</h2>
          <div className="divide-y divide-line">
            <Row label="Quick Assistant" hint="Global shortcut — works from any app. Click, then press keys.">
              <input
                value={shortcutDraft}
                readOnly
                onKeyDown={captureShortcut}
                onFocus={(e) => (e.target as HTMLInputElement).select()}
                className="w-56 cursor-pointer rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-center text-xs text-txt-1 outline-none focus:border-accent"
                title="Click and press the key combination"
              />
            </Row>
            <Row label="Reset to default" hint={DEFAULT_SHORTCUT}>
              <button
                type="button"
                onClick={() => {
                  setShortcutDraft(DEFAULT_SHORTCUT);
                  void update({ shortcutQuickAssistant: DEFAULT_SHORTCUT });
                }}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-txt-2 hover:text-txt-1"
              >
                Reset
              </button>
            </Row>
          </div>
          <div className="py-2 text-[11px] text-txt-3">
            Note: shortcut changes apply after restarting JADUU.
          </div>
        </section>

        {/* ----------------------------- Privacy ----------------------------- */}
        <section id="privacy" className="mt-4 mb-10 rounded-2xl border border-line bg-surface px-5 py-2">
          <h2 className="py-2 text-sm font-semibold text-txt-1">Privacy</h2>
          <div className="mb-3 rounded-xl bg-accent-soft px-4 py-3 text-xs leading-relaxed text-txt-1">
            Your data stays on this computer. JADUU does not require a cloud AI service — chats, files
            and documents never leave your machine.
          </div>
          <div className="divide-y divide-line">
            <Row label="Local-only mode" hint="All AI calls go to your local Ollama server">
              <div className="flex items-center gap-2 text-xs text-ok">
                <IconCheck size={13} /> Enabled
              </div>
            </Row>
            <Row label="Telemetry" hint="JADUU collects nothing, ever">
              <span className="text-xs text-txt-3">None</span>
            </Row>
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-accent" : "bg-line-strong"}`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
