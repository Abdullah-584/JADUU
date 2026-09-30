import { create } from "zustand";
import { STORAGE_KEYS } from "@shared/constants";

interface UiState {
  onboarded: boolean;
  sidebarCollapsed: boolean;
  bootstrap: () => Promise<void>;
  setOnboarded: (value: boolean) => Promise<void>;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  onboarded: true, // assume true until bootstrap proves otherwise (avoids flash)
  sidebarCollapsed: false,
  bootstrap: async () => {
    try {
      const flag = await window.jaduu.app.getFlag(STORAGE_KEYS.ONBOARDED);
      set({ onboarded: flag === "true" });
    } catch {
      set({ onboarded: true });
    }
  },
  setOnboarded: async (value) => {
    set({ onboarded: value });
    try {
      await window.jaduu.app.setFlag(STORAGE_KEYS.ONBOARDED, value ? "true" : "false");
    } catch {
      /* non-fatal */
    }
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
