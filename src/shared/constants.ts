export const APP_NAME = "JADUU";
export const APP_TAGLINE_UR = "Apki soch ka digital saathi.";
export const APP_TAGLINE_EN = "Your private AI companion.";

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
export const OLLAMA_TIMEOUT_MS = 4000;
export const STREAM_IDLE_TIMEOUT_MS = 120_000;

export const DEFAULT_SYSTEM_PROMPT = [
  "You are JADUU, a helpful private desktop AI assistant.",
  "You run locally through Ollama on the user's computer.",
  "Be concise, useful, accurate and practical.",
  "When the user asks technical questions: explain clearly, provide working examples, avoid unnecessary complexity.",
  "When files are provided: use the supplied context, do not invent information, clearly say when information is missing.",
  "Respect user privacy. Never claim to send data anywhere.",
].join("\n");

export const DEFAULT_SHORTCUT =
  process.platform === "darwin" ? "CommandOrControl+Shift+Space" : "Ctrl+Shift+Space";

export const DEFAULT_SETTINGS = {
  ollamaUrl: DEFAULT_OLLAMA_URL,
  defaultModel: "",
  theme: "dark" as const,
  temperature: 0.7,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  shortcutQuickAssistant: DEFAULT_SHORTCUT,
  fontSize: "md" as const,
  animations: true,
  compactMode: false,
  localOnly: true,
  maxContextChars: 12_000,
  contextChunkCount: 6,
};

export const FILE_KINDS: Record<string, { kind: string; label: string }> = {
  ".pdf": { kind: "pdf", label: "PDF document" },
  ".docx": { kind: "docx", label: "Word document" },
  ".txt": { kind: "text", label: "Text file" },
  ".md": { kind: "text", label: "Markdown" },
  ".markdown": { kind: "text", label: "Markdown" },
  ".csv": { kind: "data", label: "CSV" },
  ".json": { kind: "data", label: "JSON" },
  ".xml": { kind: "data", label: "XML" },
  ".yaml": { kind: "data", label: "YAML" },
  ".yml": { kind: "data", label: "YAML" },
  ".js": { kind: "code", label: "JavaScript" },
  ".ts": { kind: "code", label: "TypeScript" },
  ".jsx": { kind: "code", label: "JSX" },
  ".tsx": { kind: "code", label: "TSX" },
  ".html": { kind: "code", label: "HTML" },
  ".css": { kind: "code", label: "CSS" },
  ".sql": { kind: "code", label: "SQL" },
  ".py": { kind: "code", label: "Python" },
  ".java": { kind: "code", label: "Java" },
  ".c": { kind: "code", label: "C" },
  ".cpp": { kind: "code", label: "C++" },
  ".png": { kind: "image", label: "Image" },
  ".jpg": { kind: "image", label: "Image" },
  ".jpeg": { kind: "image", label: "Image" },
  ".gif": { kind: "image", label: "Image" },
  ".webp": { kind: "image", label: "Image" },
};

export const INDEXABLE_EXTENSIONS = Object.keys(FILE_KINDS).filter(
  (e) => FILE_KINDS[e] && FILE_KINDS[e].kind !== "image",
);

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export const CHUNK_SIZE = 1200; // characters per chunk
export const CHUNK_OVERLAP = 150;

export const WINDOW_MIN_WIDTH = 940;
export const WINDOW_MIN_HEIGHT = 620;
export const WINDOW_DEFAULT_WIDTH = 1280;
export const WINDOW_DEFAULT_HEIGHT = 820;

export const QUICK_ASSISTANT_WIDTH = 460;
export const QUICK_ASSISTANT_HEIGHT = 360;

export const IPC = {
  APP_INFO: "app:info",
  APP_OPEN_EXTERNAL: "app:open-external",

  OLLAMA_STATUS: "ollama:status",
  OLLAMA_MODELS: "ollama:models",
  OLLAMA_TEST: "ollama:test",

  CONVERSATION_LIST: "conversation:list",
  CONVERSATION_CREATE: "conversation:create",
  CONVERSATION_RENAME: "conversation:rename",
  CONVERSATION_DELETE: "conversation:delete",
  CONVERSATION_CLEAR: "conversation:clear",
  CONVERSATION_GET: "conversation:get",

  MESSAGES_LIST: "messages:list",

  CHAT_SEND: "chat:send",
  CHAT_STOP: "chat:stop",
  CHAT_REGENERATE: "chat:regenerate",
  CHAT_STREAM_EVENT: "chat:stream-event",

  GENERATE_SEND: "generate:send",
  GENERATE_STOP: "generate:stop",
  GENERATE_STREAM_EVENT: "generate:stream-event",

  FILES_SELECT: "files:select",
  FILES_LIST: "files:list",
  FILES_ADD_PATHS: "files:add-paths",
  FILES_DELETE: "files:delete",
  FILES_SEARCH: "files:search",

  SEARCH_ALL: "search:all",

  SETTINGS_ALL: "settings:all",
  SETTINGS_UPDATE: "settings:update",

  APP_FLAGS: "app:flags",
  APP_SET_FLAG: "app:set-flag",

  QUICK_SHOW_EVENT: "quick:show",
  MENU_NEW_CHAT: "menu:new-chat",

  WINDOW_CLOSE: "window:close",
  WINDOW_TOGGLE_VISIBLE: "window:toggle-visible",
} as const;

export const STORAGE_KEYS = {
  LAST_CONVERSATION: "ui.lastConversationId",
  ONBOARDED: "ui.onboarded",
} as const;
