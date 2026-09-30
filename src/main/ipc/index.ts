/** IPC registration — every channel validates input with shared zod schemas. */
import { app, dialog, ipcMain, shell } from "electron";
import { randomUUID } from "node:crypto";
import { IPC } from "@shared/constants";

const {
  APP_FLAGS,
  APP_INFO,
  APP_OPEN_EXTERNAL,
  APP_SET_FLAG,
  CHAT_REGENERATE,
  CHAT_SEND,
  CHAT_STOP,
  CHAT_STREAM_EVENT,
  CONVERSATION_CLEAR,
  CONVERSATION_CREATE,
  CONVERSATION_DELETE,
  CONVERSATION_GET,
  CONVERSATION_LIST,
  CONVERSATION_RENAME,
  FILES_ADD_PATHS,
  FILES_DELETE,
  FILES_LIST,
  FILES_SELECT,
  FILES_SEARCH,
  GENERATE_SEND,
  GENERATE_STOP,
  GENERATE_STREAM_EVENT,
  MESSAGES_LIST,
  OLLAMA_MODELS,
  OLLAMA_STATUS,
  OLLAMA_TEST,
  SEARCH_ALL,
  SETTINGS_ALL,
  SETTINGS_UPDATE,
} = IPC;
import {
  messageContentSchema,
  modelNameSchema,
  ollamaUrlSchema,
  safePathSchema,
  settingsPatchSchema,
  temperatureSchema,
  titleSchema,
  uuidSchema,
  validate,
} from "@shared/validation";
import type { ChatMessage, Conversation, ModelInfo, OllamaStatus, SearchHit, WorkspaceFile } from "@shared/types";
import type { ChatService } from "../services/chatService";
import type { SettingsService } from "../services/settingsService";
import type { OllamaService } from "../ollama/OllamaService";
import type { FileIndexer } from "../files/indexer";
import type { SearchService } from "../files/search";
import type { ConversationRepository, MessageRepository } from "../database/repositories/conversations";
import type { FileRepository } from "../database/repositories/files";
import { toUserMessage } from "../errors";
import { logger } from "../logger";

const log = logger("ipc");

interface StreamHandlers {
  onChunk: (messageId: string, text: string) => void;
  onDone: (messageId: string) => void;
  onError: (messageId: string, message: string) => void;
  onCancelled: (messageId: string) => void;
}

export interface IpcDeps {
  chat: ChatService;
  settings: SettingsService;
  ollama: OllamaService;
  indexer: FileIndexer;
  search: SearchService;
  conversations: ConversationRepository;
  messages: MessageRepository;
  files: FileRepository;
  getMainWindow: () => Electron.BrowserWindow | null;
  getQuickWindow: () => Electron.BrowserWindow | null;
}

function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: toUserMessage(error) };
}

/** Wraps a handler so the renderer always receives {ok, data|error}. */
function handle<T>(channel: string, fn: (...args: unknown[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return ok(await fn(...args));
    } catch (err) {
      log.warn(`channel ${channel} failed: ${toUserMessage(err)}`);
      return fail(err);
    }
  });
}

function streamHandlersFor(conversationId: string, target: () => Electron.BrowserWindow | null): StreamHandlers {
  return {
    onChunk: (messageId, text) => {
      const win = target();
      if (win && !win.isDestroyed()) win.webContents.send(CHAT_STREAM_EVENT, { type: "chunk", conversationId, messageId, text });
    },
    onDone: (messageId) => {
      const win = target();
      if (win && !win.isDestroyed()) win.webContents.send(CHAT_STREAM_EVENT, { type: "done", conversationId, messageId });
    },
    onError: (messageId, message) => {
      const win = target();
      if (win && !win.isDestroyed()) win.webContents.send(CHAT_STREAM_EVENT, { type: "error", conversationId, messageId, message });
    },
    onCancelled: (messageId) => {
      const win = target();
      if (win && !win.isDestroyed()) win.webContents.send(CHAT_STREAM_EVENT, { type: "cancelled", conversationId, messageId });
    },
  };
}

export function registerIpc(deps: IpcDeps): void {
  /** Route chat stream events to the quick window when it's the active surface. */
  const streamTarget = (): Electron.BrowserWindow | null => {
    const quick = deps.getQuickWindow();
    if (quick && !quick.isDestroyed() && quick.isVisible()) return quick;
    return deps.getMainWindow();
  };

  /* ---------------------------------- app ---------------------------------- */
  handle(APP_INFO, () => ({
    version: app.getVersion(),
    platform: process.platform,
    userDataPath: app.getPath("userData"),
    isSmoke: process.env.JADUU_SMOKE === "1",
  }));

  handle(APP_OPEN_EXTERNAL, (url: unknown) => {
    const parsed = validate(ollamaUrlSchema, url);
    if (!parsed.ok) throw new Error("Invalid URL");
    void shell.openExternal(parsed.data);
  });

  handle(APP_FLAGS, (key: unknown) => {
    const k = validate(titleSchema, key);
    return k.ok ? deps.settings.getFlag(k.data) : null;
  });

  handle(APP_SET_FLAG, (key: unknown, value: unknown) => {
    const k = validate(titleSchema, key);
    const v = typeof value === "string" ? value.slice(0, 500) : String(value);
    if (k.ok) deps.settings.setFlag(k.data, v);
  });

  /* --------------------------------- ollama -------------------------------- */
  handle(OLLAMA_STATUS, async (force: unknown) => {
    const status: OllamaStatus = await deps.ollama.checkStatus(force === true);
    return status;
  });

  handle(OLLAMA_MODELS, async (force: unknown) => {
    const models: ModelInfo[] = await deps.ollama.getModels(force === true);
    return models;
  });

  handle(OLLAMA_TEST, async (model: unknown) => {
    const parsed = validate(modelNameSchema, model);
    if (!parsed.ok) return false;
    return deps.ollama.testModel(parsed.data);
  });

  /* ------------------------------ conversations ----------------------------- */
  handle(CONVERSATION_LIST, (): Conversation[] => deps.conversations.list());

  handle(CONVERSATION_CREATE, (title: unknown, model: unknown) => {
    const t = validate(titleSchema, typeof title === "string" && title.trim() ? title : "New Chat");
    if (!t.ok) throw new Error(t.error);
    let modelOut: string | null = null;
    if (model != null) {
      const m = validate(modelNameSchema, model);
      if (!m.ok) throw new Error(m.error);
      modelOut = m.data;
    }
    return deps.conversations.create(randomUUID(), t.data, modelOut);
  });

  handle(CONVERSATION_GET, (id: unknown): Conversation | null => {
    const v = validate(uuidSchema, id);
    if (!v.ok) throw new Error(v.error);
    return deps.conversations.get(v.data);
  });

  handle(CONVERSATION_RENAME, (id: unknown, title: unknown) => {
    const i = validate(uuidSchema, id);
    if (!i.ok) throw new Error(i.error);
    const t = validate(titleSchema, title);
    if (!t.ok) throw new Error(t.error);
    deps.conversations.rename(i.data, t.data);
  });

  handle(CONVERSATION_DELETE, (id: unknown) => {
    const v = validate(uuidSchema, id);
    if (!v.ok) throw new Error(v.error);
    deps.chat.stop(v.data);
    deps.conversations.delete(v.data);
  });

  handle(CONVERSATION_CLEAR, (id: unknown) => {
    const v = validate(uuidSchema, id);
    if (!v.ok) throw new Error(v.error);
    deps.chat.stop(v.data);
    deps.conversations.clear(v.data);
  });

  /* -------------------------------- messages ------------------------------- */
  handle(MESSAGES_LIST, (conversationId: unknown): ChatMessage[] => {
    const v = validate(uuidSchema, conversationId);
    if (!v.ok) throw new Error(v.error);
    return deps.messages.listByConversation(v.data);
  });

  /* ---------------------------------- chat --------------------------------- */
  handle(CHAT_SEND, async (options: unknown) => {
    const input = options as { conversationId?: string; content?: string; model?: string; attachmentFileIds?: string[] };
    const id = validate(uuidSchema, input?.conversationId);
    if (!id.ok) throw new Error(id.error);
    const content = validate(messageContentSchema, input?.content);
    if (!content.ok) throw new Error(content.error);
    const model = validate(modelNameSchema, input?.model);
    if (!model.ok) throw new Error(model.error);
    const fileIds = Array.isArray(input?.attachmentFileIds)
      ? input.attachmentFileIds.filter((f: unknown): f is string => typeof f === "string" && validate(uuidSchema, f).ok)
      : [];

    const handlers = streamHandlersFor(id.data, streamTarget);
    return deps.chat.send(
      { conversationId: id.data, content: content.data, model: model.data, attachmentFileIds: fileIds },
      handlers,
    );
  });

  handle(CHAT_STOP, (conversationId: unknown) => {
    const v = validate(uuidSchema, conversationId);
    if (!v.ok) throw new Error(v.error);
    return deps.chat.send === undefined ? false : deps.chat.stop(v.data);
  });

  handle(CHAT_REGENERATE, async (conversationId: unknown, model: unknown) => {
    const i = validate(uuidSchema, conversationId);
    if (!i.ok) throw new Error(i.error);
    const m = validate(modelNameSchema, model);
    if (!m.ok) throw new Error(m.error);
    return deps.chat.regenerate(i.data, m.data, streamHandlersFor(i.data, streamTarget));
  });

  /* -------------------------------- generate ------------------------------- */
  handle(GENERATE_SEND, async (prompt: unknown, model: unknown, temperature: unknown) => {
    const p = validate(messageContentSchema, prompt);
    if (!p.ok) throw new Error(p.error);
    const m = validate(modelNameSchema, model);
    if (!m.ok) throw new Error(m.error);
    const t =
      temperature == null
        ? { ok: true as const, data: undefined as number | undefined }
        : validate(temperatureSchema, temperature);
    if (!t.ok) throw new Error(t.error);

    const win = deps.getQuickWindow();
    let acc = "";
    for await (const chunk of deps.ollama.getProvider().generate({ model: m.data, prompt: p.data, temperature: t.data })) {
      if (chunk.text) {
        acc += chunk.text;
        const w = win;
        if (w && !w.isDestroyed()) w.webContents.send(GENERATE_STREAM_EVENT, { type: "chunk", text: chunk.text });
      }
      if (chunk.done) break;
    }
    if (win && !win.isDestroyed()) win.webContents.send(GENERATE_STREAM_EVENT, { type: "done", text: acc });
    return acc;
  });

  handle(GENERATE_STOP, () => {
    deps.ollama.abortAll();
    return true;
  });

  /* --------------------------------- files --------------------------------- */
  handle(FILES_SELECT, async () => {
    const result = await dialog.showOpenDialog({
      title: "Add files to JADUU",
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  handle(FILES_ADD_PATHS, async (paths: unknown) => {
    if (!Array.isArray(paths)) throw new Error("Expected a list of file paths");
    const safe: string[] = [];
    for (const p of paths.slice(0, 50)) {
      const v = validate(safePathSchema, p);
      if (v.ok) safe.push(v.data);
    }
    const results: { id: string; status: string; chunkCount: number; path: string }[] = [];
    for (const p of safe) {
      const r = await deps.indexer.index(p);
      results.push({ ...r, path: p });
    }
    return results;
  });

  handle(FILES_LIST, (): WorkspaceFile[] => deps.files.list());

  handle(FILES_DELETE, (id: unknown) => {
    const v = validate(uuidSchema, id);
    if (!v.ok) throw new Error(v.error);
    deps.files.delete(v.data);
  });

  handle(FILES_SEARCH, (query: unknown): SearchHit[] => {
    const q = typeof query === "string" ? query.trim().slice(0, 200) : "";
    if (!q) return [];
    return deps.search.searchAll(q);
  });

  /* --------------------------------- search -------------------------------- */
  handle(SEARCH_ALL, (query: unknown): SearchHit[] => {
    const q = typeof query === "string" ? query.trim().slice(0, 200) : "";
    if (!q) return [];
    return deps.search.searchAll(q);
  });

  /* -------------------------------- settings ------------------------------- */
  handle(SETTINGS_ALL, () => deps.settings.getAll());

  handle(SETTINGS_UPDATE, (patch: unknown) => {
    const parsed = validate(settingsPatchSchema, patch);
    if (!parsed.ok) throw new Error(parsed.error);
    return deps.settings.update(parsed.data);
  });
}

/** Fired by main entry when the app menu triggers "New Chat". */
export const MENU_NEW_CHAT_HANDLER = "menu:new-chat";
