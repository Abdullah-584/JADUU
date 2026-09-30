import { create } from "zustand";
import type { ModelInfo, OllamaStatus } from "@shared/types";

interface OllamaState {
  status: OllamaStatus | null;
  models: ModelInfo[];
  checking: boolean;
  refresh: (force?: boolean) => Promise<OllamaStatus | null>;
  refreshModels: (force?: boolean) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export const useOllamaStore = create<OllamaState>((set) => ({
  status: null,
  models: [],
  checking: false,
  refresh: async (force = false) => {
    set({ checking: true });
    try {
      const status = await window.jaduu.ollama.status(force);
      set({ status });
      return status;
    } catch {
      return null;
    } finally {
      set({ checking: false });
    }
  },
  refreshModels: async (force = false) => {
    try {
      const models = await window.jaduu.ollama.models(force);
      set({ models });
    } catch {
      set({ models: [] });
    }
  },
  startPolling: () => {
    if (pollTimer) return;
    const store = useOllamaStore;
    void store.getState().refresh(true);
    pollTimer = setInterval(() => void store.getState().refresh(true), 15_000);
  },
  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },
}));
