import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChatStore } from "../stores/chatStore";
import { useFileStore } from "../stores/fileStore";
import { Markdown } from "../components/Markdown";
import { Composer } from "../components/Composer";
import { MessageActions } from "../components/MessageActions";
import {
  IconChat,
  IconFiles,
  IconRefresh,
  IconSparkle,
  IconX,
} from "../components/icons";
import type { ChatMessage } from "@shared/types";

function EmptyState() {
  const navigate = useNavigate();
  const suggestions = [
    { icon: <IconChat size={13} />, text: "Kuch poochna hai?" },
    { icon: <IconFiles size={13} />, text: "File samjhani hai?" },
    { icon: <IconSparkle size={13} />, text: "Code check karna hai?" },
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="animate-fade-up text-2xl">Assalam-o-Alaikum 👋</div>
      <div className="animate-fade-up text-txt-2">
        Main <span className="font-semibold text-txt-1">JADUU</span> hoon. Aaj kya soch rahe ho?
      </div>
      <div className="animate-fade-up flex flex-wrap items-center justify-center gap-2 pt-1">
        {suggestions.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => navigate("/files")}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-txt-2 transition-colors hover:border-line-strong hover:text-txt-1"
          >
            {s.icon} {s.text}
          </button>
        ))}
      </div>
      <div className="pt-2 text-[11px] text-txt-3">
        Private AI · Runs on your computer · Powered by Ollama
      </div>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={`animate-fade-up flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isUser ? "bg-accent-soft" : "bg-surface-2"}`}>
        {!isUser ? (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-txt-3">
            <IconSparkle size={12} className="text-accent" />
            JADUU {message.model ? <span className="text-txt-3">· {message.model}</span> : null}
          </div>
        ) : null}
        {isUser ? (
          <div className="selectable whitespace-pre-wrap text-sm text-txt-1">{message.content}</div>
        ) : (
          <>
            <Markdown content={message.content} />
            {isStreaming ? <span className="stream-caret" /> : null}
          </>
        )}
        {!isUser && !isStreaming ? <MessageActions message={message} /> : null}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const params = useParams();
  const navigate = useNavigate();
  const activeId = useChatStore((s) => s.activeId) ?? params.conversationId ?? null;
  const messagesMap = useChatStore((s) => s.messages);
  const streamingMap = useChatStore((s) => s.streaming);
  const openConversation = useChatStore((s) => s.openConversation);
  const conversations = useChatStore((s) => s.conversations);
  const regenerate = useChatStore((s) => s.regenerate);
  const clearConversation = useChatStore((s) => s.clearConversation);
  const files = useFileStore((s) => s.files);
  const loadFiles = useFileStore((s) => s.load);
  const attachedIds = useFileStore((s) => s.attachedIds);

  const [showDropOverlay, setShowDropOverlay] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => (activeId ? messagesMap[activeId] ?? [] : []),
    [activeId, messagesMap],
  );
  const streamingId = activeId ? streamingMap[activeId] ?? null : null;
  const conversation = conversations.find((c) => c.id === activeId);

  useEffect(() => {
    if (params.conversationId && params.conversationId !== activeId) {
      void openConversation(params.conversationId);
    } else if (!params.conversationId && activeId) {
      navigate(`/chat/${activeId}`, { replace: true });
    }
  }, [params.conversationId, activeId, openConversation, navigate]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  // Auto-scroll while streaming (unless the user scrolled up).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages, streamingId]);

  const attachedFiles = useMemo(
    () => files.filter((f) => attachedIds.includes(f.id)),
    [files, attachedIds],
  );

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setShowDropOverlay(false);
    const dropped = Array.from(e.dataTransfer.files).map((f) => (f as { path?: string }).path).filter(Boolean) as string[];
    if (dropped.length > 0) {
      try {
        await useFileStore.getState().addPaths(dropped);
      } catch {
        /* file cards surface failures */
      }
    }
  };

  return (
    <div
      className="relative flex h-full min-w-0 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setShowDropOverlay(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setShowDropOverlay(false);
      }}
      onDrop={(e) => void onDrop(e)}
    >
      {conversation ? (
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-4">
          <div className="truncate text-sm font-medium text-txt-1">{conversation.title}</div>
          <button
            type="button"
            onClick={() => {
              void clearConversation(conversation.id);
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-txt-3 transition-colors hover:bg-surface-2 hover:text-txt-1"
          >
            <IconRefresh size={12} /> Clear
          </button>
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} isStreaming={message.id === streamingId} />
            ))}
            {streamingId && !(messagesMap[activeId ?? ""] ?? []).some((m) => m.id === streamingId) ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-surface-2 px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm text-txt-3">
                    <IconSparkle size={13} className="text-accent" /> JADUU soch raha hai…
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl shrink-0 px-6 pb-5">
        {attachedFiles.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <span
                key={file.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-txt-2"
              >
                📄 {file.name}
                <span className="text-txt-3">
                  {file.chunkCount > 0 ? `· ✓ ${file.chunkCount} chunks` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => useFileStore.getState().toggleAttached(file.id)}
                  className="rounded p-0.5 hover:text-danger"
                  title="Detach"
                >
                  <IconX size={11} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <Composer conversationId={activeId} />
      </div>

      {showDropOverlay ? (
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft/60 animate-fade-in">
          <div className="rounded-xl bg-surface px-4 py-2 text-sm text-txt-1">Drop files to add to your workspace</div>
        </div>
      ) : null}

      {conversation && messages.length > 0 ? (
        <button
          type="button"
          onClick={() => void regenerate()}
          className="absolute right-6 top-12 z-0 hidden"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
