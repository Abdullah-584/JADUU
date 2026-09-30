import { useEffect, useRef, useState } from "react";
import { useOllamaStore } from "../stores/ollamaStore";
import { useChatStore } from "../stores/chatStore";
import { IconChevronDown, IconRefresh } from "./icons";

export function ModelPicker() {
  const models = useOllamaStore((s) => s.models);
  const refreshModels = useOllamaStore((s) => s.refreshModels);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = models.find((m) => m.name === selectedModel);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-txt-2 transition-colors hover:text-txt-1"
        title={current ? `${current.name}${current.size ? ` · ${formatSize(current.size)}` : ""}` : "Select model"}
      >
        <span className="max-w-[140px] truncate">{current?.name ?? "Model"}</span>
        <IconChevronDown size={12} />
      </button>

      {open ? (
        <div className="animate-scale-in absolute bottom-10 right-0 z-20 w-64 rounded-xl border border-line bg-surface-2 p-1.5 shadow-pop">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-txt-3">Installed models</span>
            <button
              type="button"
              onClick={() => void refreshModels(true)}
              className="rounded p-1 text-txt-3 hover:text-txt-1"
              title="Refresh models"
            >
              <IconRefresh size={12} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {models.length === 0 ? (
              <div className="px-2 py-3 text-xs text-txt-3">
                No models found. Run <code className="text-txt-2">ollama pull llama3.2</code>
              </div>
            ) : (
              models.map((model) => (
                <button
                  key={model.name}
                  type="button"
                  onClick={() => {
                    setSelectedModel(model.name);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                    model.name === selectedModel ? "bg-accent-soft text-txt-1" : "text-txt-2 hover:bg-surface-3"
                  }`}
                >
                  <span className="truncate">{model.name}</span>
                  {model.size ? <span className="ml-2 shrink-0 text-txt-3">{formatSize(model.size)}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
