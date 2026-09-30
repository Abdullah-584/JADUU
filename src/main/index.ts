/**
 * JADUU — main process entry.
 * Wires database, services, windows, tray, shortcuts, IPC and the smoke check.
 */
import { app, BrowserWindow, clipboard, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { DEFAULT_OLLAMA_URL, IPC } from "@shared/constants";
import type { QuickAssistantPayload } from "@shared/types";
import { ensureAppDirectories } from "./config";
import { initFileLogging, logger, safeError } from "./logger";
import { openDatabase, closeDatabase, type SqliteDatabase } from "./database/database";
import { ConversationRepository, MessageRepository } from "./database/repositories/conversations";
import { ChunkRepository, FileRepository, SettingsRepository } from "./database/repositories/files";
import { SettingsService } from "./services/settingsService";
import { OllamaService } from "./ollama/OllamaService";
import { FileIndexer } from "./files/indexer";
import { SearchService } from "./files/search";
import { ChatService } from "./services/chatService";
import { registerIpc } from "./ipc";
import { createMainWindow } from "./windows/mainWindow";
import { createQuickAssistant, positionQuickAssistant } from "./windows/quickAssistant";
import { TrayManager } from "./tray/trayManager";
import { ShortcutManager } from "./shortcuts/shortcutManager";
import { initAutoUpdater } from "./updater";

const log = logger("main");

let db: SqliteDatabase | null = null;
let mainWindow: BrowserWindow | null = null;
let quickWindow: BrowserWindow | null = null;
let trayManager: TrayManager | null = null;
let shortcutManager: ShortcutManager | null = null;
let chatService: ChatService | null = null;
let ollamaService: OllamaService | null = null;
let settingsService: SettingsService | null = null;
let quitting = false;

const isSmoke = process.env.JADUU_SMOKE === "1";

function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

function getQuickWindow(): BrowserWindow | null {
  return quickWindow && !quickWindow.isDestroyed() ? quickWindow : null;
}

function showMainWindow(): void {
  const win = getMainWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return;
  }
  mainWindow = createMainWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      getMainWindow()?.hide();
    }
  });
}

function newChatAction(): void {
  showMainWindow();
  getMainWindow()?.webContents.send(IPC.MENU_NEW_CHAT);
}

function toggleQuickAssistant(): void {
  const existing = getQuickWindow();
  if (existing && existing.isVisible()) {
    existing.hide();
    return;
  }
  if (!existing) {
    quickWindow = createQuickAssistant();
    quickWindow.on("closed", () => {
      quickWindow = null;
    });
    quickWindow.on("blur", () => {
      const w = getQuickWindow();
      if (w && w.isVisible() && !w.webContents.isDevToolsOpened()) w.hide();
    });
  }
  const win = getQuickWindow()!;
  positionQuickAssistant(win);

  // Clipboard assistance: hand copied text (if any) to the quick UI.
  let payload: QuickAssistantPayload = {};
  try {
    const text = clipboard.readText().trim();
    if (text.length > 0) payload = { clipboardText: text.slice(0, 8000) };
  } catch (err) {
    log.warn(`clipboard read failed: ${safeError(err)}`);
  }

  win.show();
  win.focus();
  win.webContents.send(IPC.QUICK_SHOW_EVENT, payload);
}

function rebuildTrayMenu(): void {
  if (!trayManager || !settingsService || !ollamaService) return;
  trayManager.rebuildMenu({
    online: ollamaService.getStatus().online,
    model: settingsService.getAll().defaultModel || null,
    actions: {
      onOpen: showMainWindow,
      onNewChat: newChatAction,
      onQuickAssistant: toggleQuickAssistant,
      onQuit: () => {
        quitting = true;
        app.quit();
      },
    },
  });
}

function setupServices(): void {
  const { dbPath, logsDir } = ensureAppDirectories(app.getPath("userData"));
  initFileLogging(logsDir);
  db = openDatabase(dbPath);

  const conversations = new ConversationRepository(db);
  const messages = new MessageRepository(db);
  const files = new FileRepository(db);
  const chunks = new ChunkRepository(db);
  const settingsRepo = new SettingsRepository(db);

  settingsService = new SettingsService(settingsRepo);
  ollamaService = new OllamaService(settingsService.getAll().ollamaUrl || DEFAULT_OLLAMA_URL);
  const indexer = new FileIndexer(files, chunks);
  const search = new SearchService(db, files, chunks, conversations, messages);
  chatService = new ChatService(conversations, messages, files, settingsService, ollamaService, search);

  registerIpc({
    chat: chatService,
    settings: settingsService,
    ollama: ollamaService,
    indexer,
    search,
    conversations,
    messages,
    files,
    getMainWindow,
    getQuickWindow,
  });

  // Window controls for the frameless quick assistant.
  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle("window:toggle-visible", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isVisible()) win.hide();
    else {
      win.show();
      win.focus();
    }
  });
}

async function runSmokeCheck(): Promise<void> {
  const checks: Record<string, unknown> = {};
  try {
    if (!chatService || !settingsService || !ollamaService || !db) throw new Error("services not ready");

    const conversations = new ConversationRepository(db);
    const messages = new MessageRepository(db);

    const convo = conversations.create(randomUUID(), "smoke-check", null);
    checks.conversationCreate = true;
    conversations.rename(convo.id, "smoke-renamed");
    checks.conversationRename = true;
    messages.create(randomUUID(), convo.id, "user", "ping", null);
    checks.messageCreate = true;
    checks.messageList = messages.listByConversation(convo.id).length === 1;
    conversations.delete(convo.id);
    checks.conversationDelete = true;

    const status = await ollamaService.checkStatus(true);
    checks.ollamaProbe = typeof status.online === "boolean";
    checks.settings = settingsService.getAll().ollamaUrl.length > 0;

    log.info(`smoke: ${JSON.stringify(checks)}`);
    console.log(`JADUU_SMOKE_OK ${JSON.stringify(checks)}`);
  } catch (err) {
    console.error(`JADUU_SMOKE_FAIL ${safeError(err)}`);
  }
  setTimeout(() => app.quit(), 250);
}

/** Periodic Ollama status poll keeps the tray + renderer informed. */
function startStatusPolling(): void {
  const poll = async () => {
    if (!ollamaService || quitting) return;
    await ollamaService.checkStatus(true);
    rebuildTrayMenu();
  };
  void poll();
  setInterval(() => void poll(), 30_000);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());

  app.setAppUserModelId("app.jaduu.desktop");
  app.setName("JADUU");

  app.whenReady()
    .then(() => {
      try {
        setupServices();
      } catch (err) {
        log.error(`fatal: failed to initialize services: ${safeError(err)}`);
        app.quit();
        return;
      }

      mainWindow = createMainWindow();
      mainWindow.on("closed", () => {
        mainWindow = null;
      });
      mainWindow.on("close", (event) => {
        // Background behavior: hide to tray instead of quitting.
        if (!quitting) {
          event.preventDefault();
          getMainWindow()?.hide();
        }
      });

      trayManager = new TrayManager();
      trayManager.create({
        onOpen: showMainWindow,
        onNewChat: newChatAction,
        onQuickAssistant: toggleQuickAssistant,
        onQuit: () => {
          quitting = true;
          app.quit();
        },
      });

      shortcutManager = new ShortcutManager();
      const shortcut = settingsService?.getAll().shortcutQuickAssistant;
      if (shortcut) {
        const result = shortcutManager.register(shortcut, { onQuickAssistant: toggleQuickAssistant });
        if (!result.ok && result.error) log.warn(result.error);
      }

      startStatusPolling();

      if (isSmoke) {
        void runSmokeCheck();
        return;
      }

      initAutoUpdater();
    })
    .catch((err) => {
      log.error(`fatal: app ready failed: ${safeError(err)}`);
      app.quit();
    });

  app.on("window-all-closed", () => {
    // JADUU keeps running in the tray; explicit Quit exits the app.
  });

  app.on("before-quit", () => {
    quitting = true;
    ollamaService?.abortAll();
    shortcutManager?.unregisterAll();
    trayManager?.destroy();
  });

  app.on("quit", () => {
    closeDatabase(db);
    db = null;
  });

  app.on("activate", () => showMainWindow());
}
