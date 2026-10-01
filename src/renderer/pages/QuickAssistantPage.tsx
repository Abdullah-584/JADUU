import { useEffect, useRef, useState } from "react";
import { JaduuMark } from "../components/Logo";
import { Markdown } from "../components/Markdown";
import { useChatStore } from "../stores/chatStore";
import { useOllamaStore } from "../stores/ollamaStore";
import { IconSend, IconSparkle, IconStop, IconX } from "../components/icons";

type Mode = "idle" | "clipboard" | "streaming";

const CLIPBOARD_ACTIONS = [
  { label: "Explain", prefix: "Explain this clearly:\n\n" },
  { label: "Fix", prefix: "Find and fix the problems in this:\n\n" },
  { label: "Summarize", prefix: "Summarize this concisely:\n\n" },
  { label: "Translate", prefix: "Translate this to English (reply in English and Roman Urdu):\n\n" },
  { label: "Improve", prefix: "Improve the quality of this while keeping its meaning:\n\n" },
];

export default function QuickAssistantPage() {
  const models = useOllamaStore((s) => s.models);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const online = useOllamaStore((s) => s.status?.online ?? false);

  const [clipboardText, setClipboardText] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  // Main process pushes the clipboard payload every time the window is shown.
  useEffect(() => {
    const off = window.jaduu.quick.onShow((payload) => {
      setClipboardText(payload.clipboardText?.trim() || null);
      setInput("");
      setAnswer("");
      setError(null);
      setMode(payload.clipboardText ? "clipboard" : "idle");
      const input = document.querySelector<HTMLInputElement>("#quick-input");
      input?.focus();
    });
    return off;
  }, []);

  useEffect(() => {
    if (answerRef.current) answerRef.current.scrollTop = answerRef.current.scrollHeight;
  }, [answer]);

  useEffect(() => {
    if (models.length > 0 && !selectedModel) setSelectedModel(models[0]!.name);
  }, [models, selectedModel, setSelectedModel]);

  const runPrompt = async (prompt: string) => {
    const model = selectedModel || models[0]?.name;
    if (!model) {
      setError("No model installed. Run: ollama pull llama3.2");
      return;
    }
    setMode("streaming");
    setAnswer("");
    setError(null);
    try {
      const off = window.jaduu.generate.onStreamEvent((event) => {
        if (event.type === "chunk" && event.text) setAnswer((prev) => prev + event.text);
        if (event.type === "done") setMode((m) => (m === "streaming" ? "idle" : m));
        if (event.type === "error") {
          setError(event.message ?? "Something went wrong.");
          setMode("idle");
        }
      });
      await window.jaduu.generate.send(prompt, model);
      off();
      setMode((m) => (m === "streaming" ? "idle" : m));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMode("idle");
    }
  };

  const submit = () => {
    const text = input.trim();
    if (!text || !online) return;
    void runPrompt(text);
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5" data-tauri-drag-region="">
        <div className="flex items-center gap-2">
          <JaduuMark size={20} />
          <span className="text-xs font-semibold tracking-[0.18em] text-txt-1">JADUU</span>
          <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${online ? "bg-ok" : "bg-danger"}`} />
        </div>
        <button
          type="button"
          onClick={() => void window.jaduu.window.close()}
          className="rounded-md p-1 text-txt-3 hover:bg-surface-2 hover:text-txt-1"
          title="Close (Esc)"
        >
          <IconX size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" ref={answerRef}>
        {mode === "idle" && !answer ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <IconSparkle size={20} className="text-accent" />
            <div className="text-sm text-txt-2">Ask anything…</div>
            <div className="text-[11px] text-txt-3">Esc to dismiss</div>
          </div>
        ) : null}

        {mode === "clipboard" && !answer ? (
          <div>
            <div className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-xs leading-relaxed text-txt-1">
              I found text in your clipboard. What would you like me to do?
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {CLIPBOARD_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => void runPrompt(action.prefix + (clipboardText ?? ""))}
                  className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-txt-2 transition-colors hover:border-accent hover:text-txt-1"
                >
                  {action.label}
                </button>
              ))}
            </div>
            <details className="mt-2.5">
              <summary className="cursor-pointer text-[11px] text-txt-3">Show clipboard content</summary>
              <pre className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-2.5 text-[11px] text-txt-2 selectable">
                {clipboardText}
              </pre>
            </details>
          </div>
        ) : null}

        {answer || mode === "streaming" ? (
          <div className="selectable">
            {error ? <div className="mb-2 rounded-xl bg-[rgba(248,113,113,0.12)] px-3.5 py-2 text-xs text-danger">⚠️ {error}</div> : null}
            <Markdown content={answer} />
            {mode === "streaming" ? <span className="stream-caret" /> : null}
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 focus-within:border-line-strong">
          <input
            id="quick-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") void window.jaduu.window.close();
            }}
            placeholder={online ? "Ask JADUU…" : "Ollama offline…"}
            className="min-w-0 flex-1 bg-transparent text-sm text-txt-1 outline-none placeholder:text-txt-3"
          />
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="max-w-[110px] shrink-0 cursor-pointer truncate rounded-md bg-transparent text-[11px] text-txt-3 outline-none"
            title="Model"
          >
            {models.map((m) => (
              <option key={m.name} value={m.name} className="bg-surface text-txt-1">
                {m.name}
              </option>
            ))}
          </select>
          {mode === "streaming" ? (
            <button
              type="button"
              onClick={() => void window.jaduu.generate.stop()}
              className="shrink-0 rounded-lg bg-surface-3 p-1.5 text-txt-1 hover:bg-line-strong"
              title="Stop"
            >
              <IconStop size={12} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim() || !online}
              className="shrink-0 rounded-lg bg-accent p-1.5 text-accent-ink transition-transform hover:brightness-110 active:scale-95 disabled:opacity-40"
              title="Send"
            >
              <IconSend size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
