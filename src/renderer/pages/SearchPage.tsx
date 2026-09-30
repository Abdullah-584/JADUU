import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../stores/chatStore";
import { IconSearch } from "../components/icons";
import type { SearchHit } from "@shared/types";

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  file: "FILE",
  message: "MESSAGE",
  conversation: "CHAT",
};

export default function SearchPage() {
  const navigate = useNavigate();
  const openConversation = useChatStore((s) => s.openConversation);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void window.jaduu.search
        .all(q)
        .then(setHits)
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const openHit = async (hit: SearchHit) => {
    if (hit.conversationId) {
      await openConversation(hit.conversationId);
      navigate(`/chat/${hit.conversationId}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <h1 className="text-lg font-semibold text-txt-1">Search</h1>
        <p className="mt-0.5 text-xs text-txt-3">Files, document contents, conversations and messages — all local.</p>

        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-2.5 transition-colors focus-within:border-line-strong">
          <IconSearch size={16} className="text-txt-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search JADUU…"
            className="w-full bg-transparent text-sm text-txt-1 outline-none placeholder:text-txt-3"
          />
          {searching ? <span className="text-[11px] text-txt-3">…</span> : null}
        </div>

        {query.trim() ? (
          <div className="mt-4 space-y-2">
            {hits.length === 0 && !searching ? (
              <div className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-sm text-txt-3">
                No results for “{query}”
              </div>
            ) : null}
            {hits.map((hit) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                type="button"
                onClick={() => void openHit(hit)}
                className="block w-full rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-txt-3">
                    {KIND_LABEL[hit.kind]}
                  </span>
                  <span className="truncate text-sm font-medium text-txt-1">{hit.title}</span>
                </div>
                <div
                  className="mt-1 line-clamp-2 text-xs leading-relaxed text-txt-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeSnippet(hit.snippet) }}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Highlights are generated locally by FTS snippet(); escape everything else. */
function sanitizeSnippet(snippet: string): string {
  const escaped = snippet
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/『/g, '<mark class="bg-accent-soft text-txt-1 rounded px-0.5">')
    .replace(/』/g, "</mark>");
}
