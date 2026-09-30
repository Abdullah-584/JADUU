import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSettingsStore } from "./stores/settingsStore";
import { useUiStore } from "./stores/uiStore";
import OnboardingPage from "./pages/OnboardingPage";
import ChatPage from "./pages/ChatPage";
import FilesPage from "./pages/FilesPage";
import SearchPage from "./pages/SearchPage";
import SettingsPage from "./pages/SettingsPage";
import QuickAssistantPage from "./pages/QuickAssistantPage";
import { AppLayout } from "./layouts/AppLayout";

export default function App() {
  const location = useLocation();
  const theme = useSettingsStore((s) => s.settings.theme);
  const fontSize = useSettingsStore((s) => s.settings.fontSize);
  const animations = useSettingsStore((s) => s.settings.animations);
  const loadSettings = useSettingsStore((s) => s.load);
  const onboarded = useUiStore((s) => s.onboarded);
  const bootstrap = useUiStore((s) => s.bootstrap);

  const isQuick = location.pathname.startsWith("/quick");

  useEffect(() => {
    void loadSettings();
    void bootstrap();
  }, [loadSettings, bootstrap]);

  // Apply theme + accessibility settings to <html>
  useEffect(() => {
    const root = document.documentElement;
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : theme;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-font", fontSize);
    root.setAttribute("data-animations", animations ? "on" : "off");
  }, [theme, fontSize, animations]);

  if (isQuick) {
    return <QuickAssistantPage />;
  }

  if (!onboarded) {
    return <OnboardingPage />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/chat/:conversationId" element={<ChatPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Route>
    </Routes>
  );
}
