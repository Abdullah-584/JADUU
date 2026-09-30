import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../stores/chatStore";
import { useOllamaStore } from "../stores/ollamaStore";
import { useFileStore } from "../stores/fileStore";
import { ModelPicker } from "./ModelPicker";
import { IconPaperclip, IconSend, IconStop } from "./icons";

export function Composer({ conversationId }: { conversationId: string | null }) {
  const draft = useChatStore((s) => s.draft);
  const setDraft = useChatStore((s) => s.setDraft);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);
  const streamingMap = useChatStore((s) => s.streaming);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const models = useOllamaStore((s) => s.models);
  const online = useOllamaStore((s) => (s.status?.online ?? false));
  const addFromDialog = useFileStore((s) => s.addFromDialog);
  const attachedIds = useFileStore((s) => s.attachedIds);

  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = conversationId ? Boolean(streamingMap[conversationId]) : false;

  // Auto-grow the textarea up to a max height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  // Focus on conversation switch.
  useEffect(() => {
    textareaRef.current?.focus();
  }, [conversationId]);

  const submit = async () => {
    if (busy || isStreaming) return;
    if (!draft.trim() || !conversationId) return;
    if (!selectedModel) {
      setDraft(draft);
      textareaRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await sendMessage(draft, attachedIds);
      useFileStore.getState().clearAttached();
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-soft transition-colors focus-within:border-line-strong">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={1}
        placeholder={online ? "Ask JADUU anything…" : "Ollama is offline — start it and try again"}
        className="block max-h-[180px] w-full resize-none bg-transparent px-4 pt-3.5 text-sm text-txt-1 outline-none placeholder:text-txt-3"
      />
      <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Attach files"
            onClick={() => void addFromDialog()}
            className="rounded-lg p-2 text-txt-3 transition-colors hover:bg-surface-2 hover:text-txt-1"
          >
            <IconPaperclip size={15} />
          </button>
          {attachedIds.length > 0 ? (
            <span className="text-[11px] text-txt-3">{attachedIds.length} attached</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ModelPicker />
          {isStreaming ? (
            <button
              type="button"
              onClick={() => void stopStreaming()}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-3 text-txt-1 transition-colors hover:bg-line-strong"
              title="Stop"
            >
              <IconStop size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!draft.trim() || busy || !online || !selectedModel}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-ink transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              title="Send (Enter)"
            >
              <IconSend size={15} />
            </button>
          )}
        </div>
      </div>
      {models.length === 0 && online ? (
        <div className="px-4 pb-2 text-[11px] text-warn">No models installed — run `ollama pull llama3.2` then refresh.</div>
      ) : null}
    </div>
  );
}
