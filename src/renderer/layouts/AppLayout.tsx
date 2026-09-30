import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useChatStore } from "../stores/chatStore";
import { useOllamaStore } from "../stores/ollamaStore";
import { useSettingsStore } from "../stores/settingsStore";
import { JaduuWordmark } from "../components/Logo";
import { OllamaStatusBadge } from "../components/OllamaStatusBadge";
import { Sidebar } from "../components/Sidebar";

export function AppLayout() {
  const navigate = useNavigate();
  const handleStreamEvent = useChatStore((s) => s.handleStreamEvent);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const newConversation = useChatStore((s) => s.newConversation);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const startPolling = useOllamaStore((s) => s.startPolling);
  const stopPolling = useOllamaStore((s) => s.stopPolling);
  const models = useOllamaStore((s) => s.models);
  const settings = useSettingsStore((s) => s.settings);

  // Global stream-event subscription + tray "New Chat" + status polling.
  useEffect(() => {
    const offStream = window.jaduu.chat.onStreamEvent(handleStreamEvent);
    const offNewChat = window.jaduu.chat.onNewChat(() => {
      void (async () => {
        const convo = await newConversation(selectedModel || undefined);
        navigate(`/chat/${convo.id}`);
      })();
    });
    startPolling();
    return () => {
      offStream();
      offNewChat();
      stopPolling();
    };
  }, [handleStreamEvent, newConversation, navigate, selectedModel, startPolling, stopPolling]);

  // Load conversations + pick a default model once models arrive.
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(settings.defaultModel && models.some((m) => m.name === settings.defaultModel)
        ? settings.defaultModel
        : models[0]!.name);
    }
  }, [models, selectedModel, settings.defaultModel, setSelectedModel]);

  return (
    <div className="flex h-full flex-col bg-paper">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <JaduuWordmark size={13} />
        <OllamaStatusBadge compact />
      </header>
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
