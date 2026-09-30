import { create } from "zustand";
import type { AppSettings } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/constants";

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
  load: async () => {
    try {
      const settings = await window.jaduu.settings.all();
      set({ settings, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  update: async (patch) => {
    // optimistic
    const previous = get().settings;
    set({ settings: { ...previous, ...patch } });
    try {
      const next = await window.jaduu.settings.update(patch);
      set({ settings: next });
    } catch {
      set({ settings: previous });
    }
  },
}));
