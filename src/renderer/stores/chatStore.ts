import { create } from "zustand";
import type { ChatMessage, Conversation, StreamEvent } from "@shared/types";

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, ChatMessage[]>;
  /** messageIds currently streaming, keyed by conversationId */
  streaming: Record<string, string | null>;
  draft: string;
  selectedModel: string;
  loadConversations: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  newConversation: (model?: string) => Promise<Conversation>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearConversation: (id: string) => Promise<void>;
  setDraft: (draft: string) => void;
  setSelectedModel: (model: string) => void;
  sendMessage: (content: string, attachmentFileIds: string[]) => Promise<void>;
  stopStreaming: () => Promise<void>;
  regenerate: () => Promise<void>;
  handleStreamEvent: (event: StreamEvent) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: {},
  streaming: {},
  draft: "",
  selectedModel: "",

  loadConversations: async () => {
    const conversations = await window.jaduu.conversations.list();
    set({ conversations });
  },

  openConversation: async (id) => {
    set({ activeId: id });
    if (!get().messages[id]) {
      const messages = await window.jaduu.messages.list(id);
      set((s) => ({ messages: { ...s.messages, [id]: messages } }));
    }
  },

  newConversation: async (model) => {
    const conversation = await window.jaduu.conversations.create(undefined, model || undefined);
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      activeId: conversation.id,
      messages: { ...s.messages, [conversation.id]: [] },
      streaming: { ...s.streaming, [conversation.id]: null },
    }));
    return conversation;
  },

  renameConversation: async (id, title) => {
    await window.jaduu.conversations.rename(id, title);
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
  },

  deleteConversation: async (id) => {
    await window.jaduu.conversations.delete(id);
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      const messages = { ...s.messages };
      delete messages[id];
      const streaming = { ...s.streaming };
      delete streaming[id];
      return {
        conversations,
        messages,
        streaming,
        activeId: s.activeId === id ? conversations[0]?.id ?? null : s.activeId,
      };
    });
  },

  clearConversation: async (id) => {
    await window.jaduu.conversations.clear(id);
    set((s) => ({ messages: { ...s.messages, [id]: [] } }));
  },

  setDraft: (draft) => set({ draft }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  sendMessage: async (content, attachmentFileIds) => {
    const { activeId, selectedModel } = get();
    if (!activeId || !content.trim()) return;
    const conversation = get().conversations.find((c) => c.id === activeId);
    const model = selectedModel || conversation?.model || "";
    if (!model) throw new Error("Choose a model first");

    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      conversationId: activeId,
      role: "user",
      content,
      model: null,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      messages: { ...s.messages, [activeId]: [...(s.messages[activeId] ?? []), optimistic] },
      draft: "",
    }));

    try {
      const { userMessage, assistantMessageId } = await window.jaduu.chat.send({
        conversationId: activeId,
        content,
        model,
        attachmentFileIds,
      });
      set((s) => {
        const list = (s.messages[activeId] ?? []).map((m) => (m.id === optimistic.id ? userMessage : m));
        return {
          messages: { ...s.messages, [activeId]: list },
          streaming: { ...s.streaming, [activeId]: assistantMessageId },
        };
      });
    } catch (err) {
      // Roll back the optimistic message and surface the error inline.
      const message = err instanceof Error ? err.message : "Something went wrong.";
      set((s) => ({
        messages: {
          ...s.messages,
          [activeId]: [
            ...(s.messages[activeId] ?? []).filter((m) => m.id !== optimistic.id),
            {
              id: `error-${Date.now()}`,
              conversationId: activeId!,
              role: "assistant",
              content: `⚠️ ${message}`,
              model: null,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      }));
    }
    void get().loadConversations();
  },

  stopStreaming: async () => {
    const { activeId } = get();
    if (activeId) await window.jaduu.chat.stop(activeId);
  },

  regenerate: async () => {
    const { activeId, selectedModel } = get();
    if (!activeId) return;
    const conversation = get().conversations.find((c) => c.id === activeId);
    const model = selectedModel || conversation?.model || "";
    if (!model) return;
    try {
      const result = await window.jaduu.chat.regenerate(activeId, model);
      if (result) {
        // Refresh messages after regeneration rewrites history.
        const messages = await window.jaduu.messages.list(activeId);
        set((s) => ({
          messages: { ...s.messages, [activeId]: messages },
          streaming: { ...s.streaming, [activeId]: result.assistantMessageId },
        }));
      }
    } catch {
      /* surfaced via stream error event */
    }
  },

  handleStreamEvent: (event) => {
    set((s) => {
      const list = s.messages[event.conversationId] ?? [];
      switch (event.type) {
        case "chunk": {
          const idx = list.findIndex((m) => m.id === event.messageId);
          if (idx >= 0) {
            const next = [...list];
            next[idx] = { ...next[idx]!, content: next[idx]!.content + event.text };
            return { messages: { ...s.messages, [event.conversationId]: next } };
          }
          // streaming message not in list yet (regenerate case)
          return {
            messages: {
              ...s.messages,
              [event.conversationId]: [
                ...list,
                {
                  id: event.messageId,
                  conversationId: event.conversationId,
                  role: "assistant",
                  content: event.text,
                  model: null,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          };
        }
        case "done":
        case "error":
        case "cancelled":
          return { streaming: { ...s.streaming, [event.conversationId]: null } };
        default:
          return s;
      }
    });
  },
}));
