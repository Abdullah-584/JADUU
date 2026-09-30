import { create } from "zustand";
import type { WorkspaceFile } from "@shared/types";

interface FileState {
  files: WorkspaceFile[];
  loading: boolean;
  attachedIds: string[];
  load: () => Promise<void>;
  addFromDialog: () => Promise<WorkspaceFile[]>;
  addPaths: (paths: string[]) => Promise<WorkspaceFile[]>;
  remove: (id: string) => Promise<void>;
  toggleAttached: (id: string) => void;
  setAttached: (ids: string[]) => void;
  clearAttached: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  loading: false,
  attachedIds: [],

  load: async () => {
    set({ loading: true });
    try {
      const files = await window.jaduu.files.list();
      set({ files });
    } finally {
      set({ loading: false });
    }
  },

  addFromDialog: async () => {
    const paths = await window.jaduu.files.select();
    if (paths.length === 0) return [];
    return get().addPaths(paths);
  },

  addPaths: async (paths) => {
    const results = await window.jaduu.files.addPaths(paths);
    await get().load();
    const added = get().files.filter((f) => results.some((r) => r.id === f.id && r.status === "indexed"));
    set((s) => ({ attachedIds: [...new Set([...s.attachedIds, ...added.map((f) => f.id)])] }));
    return added;
  },

  remove: async (id) => {
    await window.jaduu.files.delete(id);
    set((s) => ({
      files: s.files.filter((f) => f.id !== id),
      attachedIds: s.attachedIds.filter((a) => a !== id),
    }));
  },

  toggleAttached: (id) => {
    set((s) => ({
      attachedIds: s.attachedIds.includes(id)
        ? s.attachedIds.filter((a) => a !== id)
        : [...s.attachedIds, id],
    }));
  },

  setAttached: (ids) => set({ attachedIds: [...new Set(ids)] }),
  clearAttached: () => set({ attachedIds: [] }),
}));
