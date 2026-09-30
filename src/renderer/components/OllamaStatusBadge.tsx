import { useOllamaStore } from "../stores/ollamaStore";

export function OllamaStatusBadge({ compact = false }: { compact?: boolean }) {
  const status = useOllamaStore((s) => s.status);
  const models = useOllamaStore((s) => s.models);
  const online = status?.online ?? false;
  const defaultModel = models[0]?.name;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5" title={online ? "Ollama connected" : "Ollama offline"}>
        <span
          className={`inline-block h-2 w-2 rounded-full ${online ? "bg-ok animate-pulse-dot" : "bg-danger"}`}
        />
        <span className="text-xs text-txt-3">{online ? "Online" : "Offline"}</span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${online ? "bg-ok animate-pulse-dot" : "bg-danger"}`}
      />
      <div className="min-w-0 leading-tight">
        <div className="text-xs font-medium text-txt-1">
          {online ? "Ollama Connected" : "Ollama Offline"}
        </div>
        {online && defaultModel ? (
          <div className="truncate text-[11px] text-txt-3">{defaultModel}</div>
        ) : !online ? (
          <div className="truncate text-[11px] text-txt-3">Start Ollama to begin</div>
        ) : null}
      </div>
    </div>
  );
}
