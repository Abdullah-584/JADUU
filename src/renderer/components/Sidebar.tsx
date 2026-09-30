import { useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useChatStore } from "../stores/chatStore";
import { OllamaStatusBadge } from "./OllamaStatusBadge";
import {
  IconChat,
  IconFiles,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTrash,
} from "./icons";

interface Group {
  label: string;
  items: { id: string; title: string }[];
}

function groupConversations(conversations: { id: string; title: string; updatedAt: string }[]): Group[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOf7Days = startOfToday - 7 * 86_400_000;

  const groups: Group[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const convo of conversations) {
    const t = new Date(convo.updatedAt).getTime();
    if (t >= startOfToday) groups[0]!.items.push(convo);
    else if (t >= startOfYesterday) groups[1]!.items.push(convo);
    else if (t >= startOf7Days) groups[2]!.items.push(convo);
    else groups[3]!.items.push(convo);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function Sidebar() {
  const navigate = useNavigate();
  const params = useParams();
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId) ?? params.conversationId ?? null;
  const newConversation = useChatStore((s) => s.newConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const selectedModel = useChatStore((s) => s.selectedModel);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  const onNewChat = async () => {
    const convo = await newConversation(selectedModel || undefined);
    navigate(`/chat/${convo.id}`);
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-surface">
      <div className="p-3">
        <button
          type="button"
          onClick={() => void onNewChat()}
          className="flex w-full items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-ink transition-transform hover:brightness-110 active:scale-[0.99]"
        >
          <IconPlus size={15} />
          New Chat
        </button>
      </div>

      <nav className="flex items-center gap-1 px-3 pb-2 text-xs">
        <NavLink
          to="/files"
          className={({ isActive }) =>
            `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${
              isActive ? "bg-surface-3 text-txt-1" : "text-txt-2 hover:bg-surface-2"
            }`
          }
        >
          <IconFiles size={13} /> Files
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${
              isActive ? "bg-surface-3 text-txt-1" : "text-txt-2 hover:bg-surface-2"
            }`
          }
        >
          <IconSearch size={13} /> Search
        </NavLink>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-txt-3">
          Chats
        </div>
        {groups.length === 0 ? (
          <div className="px-2 py-3 text-xs text-txt-3">No conversations yet</div>
        ) : null}
        {groups.map((group) => (
          <div key={group.label} className="mb-2">
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-txt-3">
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <div
                  key={item.id}
                  className={`group flex items-center rounded-lg transition-colors ${
                    isActive ? "bg-surface-3" : "hover:bg-surface-2"
                  }`}
                >
                  {editingId === item.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => {
                        const title = editTitle.trim();
                        if (title) void renameConversation(item.id, title);
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full bg-transparent px-3 py-2 text-sm text-txt-1 outline-none"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`/chat/${item.id}`)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                      >
                        <IconChat size={13} className="shrink-0 text-txt-3" />
                        <span className="truncate text-sm text-txt-1">{item.title}</span>
                      </button>
                      <div className="hidden shrink-0 items-center gap-0.5 pr-1.5 group-hover:flex">
                        <button
                          type="button"
                          title="Rename"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditTitle(item.title);
                          }}
                          className="rounded-md p-1 text-txt-3 hover:bg-surface-3 hover:text-txt-1"
                        >
                          <IconPencil size={12} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => void deleteConversation(item.id)}
                          className="rounded-md p-1 text-txt-3 hover:bg-surface-3 hover:text-danger"
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive ? "bg-surface-3 text-txt-1" : "text-txt-2 hover:bg-surface-2"
            }`
          }
        >
          <IconSettings size={15} /> Settings
        </NavLink>
        <OllamaStatusBadge />
      </div>
    </aside>
  );
}
