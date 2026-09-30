/**
 * JADUU preload — the only bridge between React and Electron.
 * Exposes a typed, minimal `window.jaduu` API. No Node primitives leak through.
 */
import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "@shared/constants";

const { MENU_NEW_CHAT, QUICK_SHOW_EVENT } = IPC;
import type {
  AppInfo,
  AppSettings,
  ChatMessage,
  Conversation,
  GenerateEvent,
  ModelInfo,
  OllamaStatus,
  SearchHit,
  StreamEvent,
  WorkspaceFile,
} from "@shared/types";

export interface JaduuBridge {
  app: {
    info(): Promise<AppInfo>;
    openExternal(url: string): Promise<void>;
    getFlag(key: string): Promise<string | null>;
    setFlag(key: string, value: string): Promise<void>;
  };
  ollama: {
    status(force?: boolean): Promise<OllamaStatus>;
    models(force?: boolean): Promise<ModelInfo[]>;
    testModel(model: string): Promise<boolean>;
  };
  conversations: {
    list(): Promise<Conversation[]>;
    create(title?: string, model?: string): Promise<Conversation>;
    get(id: string): Promise<Conversation | null>;
    rename(id: string, title: string): Promise<void>;
    delete(id: string): Promise<void>;
    clear(id: string): Promise<void>;
  };
  messages: {
    list(conversationId: string): Promise<ChatMessage[]>;
  };
  chat: {
    send(options: { conversationId: string; content: string; model: string; attachmentFileIds: string[] }): Promise<{
      userMessage: ChatMessage;
      assistantMessageId: string;
    }>;
    stop(conversationId: string): Promise<boolean>;
    regenerate(conversationId: string, model: string): Promise<{ userMessage: ChatMessage; assistantMessageId: string } | null>;
    onStreamEvent(listener: (event: StreamEvent) => void): () => void;
    onNewChat(listener: () => void): () => void;
  };
  generate: {
    send(prompt: string, model: string, temperature?: number): Promise<string>;
    stop(): Promise<boolean>;
    onStreamEvent(listener: (event: GenerateEvent) => void): () => void;
  };
  files: {
    select(): Promise<string[]>;
    addPaths(paths: string[]): Promise<{ id: string; status: string; chunkCount: number; path: string }[]>;
    list(): Promise<WorkspaceFile[]>;
    delete(id: string): Promise<void>;
    search(query: string): Promise<SearchHit[]>;
  };
  search: {
    all(query: string): Promise<SearchHit[]>;
  };
  settings: {
    all(): Promise<AppSettings>;
    update(patch: Partial<AppSettings>): Promise<AppSettings>;
  };
  window: {
    close(): Promise<void>;
    toggleVisible(): Promise<void>;
  };
  quick: {
    onShow(listener: (payload: { clipboardText?: string }) => void): () => void;
  };
}

function invoke<T>(channel: string, ...args: unknown[]): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  return ipcRenderer.invoke(channel, ...args) as Promise<{ ok: true; data: T } | { ok: false; error: string }>;
}

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await invoke<T>(channel, ...args);
  if (result.ok) return result.data;
  throw new Error(result.error);
}

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const bridge: JaduuBridge = {
  app: {
    info: () => call<AppInfo>(IPC.APP_INFO),
    openExternal: (url) => call<void>(IPC.APP_OPEN_EXTERNAL, url),
    getFlag: (key) => call<string | null>(IPC.APP_FLAGS, key),
    setFlag: (key, value) => call<void>(IPC.APP_SET_FLAG, key, value),
  },
  ollama: {
    status: (force) => call<OllamaStatus>(IPC.OLLAMA_STATUS, force === true),
    models: (force) => call<ModelInfo[]>(IPC.OLLAMA_MODELS, force === true),
    testModel: (model) => call<boolean>(IPC.OLLAMA_TEST, model),
  },
  conversations: {
    list: () => call<Conversation[]>(IPC.CONVERSATION_LIST),
    create: (title, model) => call<Conversation>(IPC.CONVERSATION_CREATE, title ?? null, model ?? null),
    get: (id) => call<Conversation | null>(IPC.CONVERSATION_GET, id),
    rename: (id, title) => call<void>(IPC.CONVERSATION_RENAME, id, title),
    delete: (id) => call<void>(IPC.CONVERSATION_DELETE, id),
    clear: (id) => call<void>(IPC.CONVERSATION_CLEAR, id),
  },
  messages: {
    list: (conversationId) => call<ChatMessage[]>(IPC.MESSAGES_LIST, conversationId),
  },
  chat: {
    send: (options) =>
      call<{ userMessage: ChatMessage; assistantMessageId: string }>(IPC.CHAT_SEND, options),
    stop: (conversationId) => call<boolean>(IPC.CHAT_STOP, conversationId),
    regenerate: (conversationId, model) =>
      call<{ userMessage: ChatMessage; assistantMessageId: string } | null>(IPC.CHAT_REGENERATE, conversationId, model),
    onStreamEvent: (listener) => subscribe<StreamEvent>(IPC.CHAT_STREAM_EVENT, listener),
    onNewChat: (listener) => subscribe<void>(MENU_NEW_CHAT, listener),
  },
  generate: {
    send: (prompt, model, temperature) => call<string>(IPC.GENERATE_SEND, prompt, model, temperature ?? null),
    stop: () => call<boolean>(IPC.GENERATE_STOP),
    onStreamEvent: (listener) => subscribe<GenerateEvent>(IPC.GENERATE_STREAM_EVENT, listener),
  },
  files: {
    select: () => call<string[]>(IPC.FILES_SELECT),
    addPaths: (paths) => call<{ id: string; status: string; chunkCount: number; path: string }[]>(IPC.FILES_ADD_PATHS, paths),
    list: () => call<WorkspaceFile[]>(IPC.FILES_LIST),
    delete: (id) => call<void>(IPC.FILES_DELETE, id),
    search: (query) => call<SearchHit[]>(IPC.FILES_SEARCH, query),
  },
  search: {
    all: (query) => call<SearchHit[]>(IPC.SEARCH_ALL, query),
  },
  settings: {
    all: () => call<AppSettings>(IPC.SETTINGS_ALL),
    update: (patch) => call<AppSettings>(IPC.SETTINGS_UPDATE, patch),
  },
  window: {
    close: () => call<void>("window:close"),
    toggleVisible: () => call<void>("window:toggle-visible"),
  },
  quick: {
    onShow: (listener) => subscribe<{ clipboardText?: string }>(QUICK_SHOW_EVENT, listener),
  },
};

contextBridge.exposeInMainWorld("jaduu", bridge);
