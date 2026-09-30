import { useState } from "react";
import type { ChatMessage } from "@shared/types";
import { useChatStore } from "../stores/chatStore";
import { IconCheck, IconCopy, IconRefresh } from "./icons";

export function MessageActions({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const regenerate = useChatStore((s) => s.regenerate);
  const streamingMap = useChatStore((s) => s.streaming);
  const isBusy = Object.values(streamingMap).some(Boolean);

  const copy = () => {
    try {
      void navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 [div:hover>&]:opacity-100">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-txt-3 transition-colors hover:bg-surface-3 hover:text-txt-1"
        title="Copy"
      >
        {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
      </button>
      <button
        type="button"
        onClick={() => void regenerate()}
        disabled={isBusy}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-txt-3 transition-colors hover:bg-surface-3 hover:text-txt-1 disabled:opacity-40"
        title="Regenerate"
      >
        <IconRefresh size={11} />
      </button>
    </div>
  );
}
