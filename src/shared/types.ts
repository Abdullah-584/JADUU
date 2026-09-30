/** JADUU shared types — single source of truth for main/preload/renderer contracts. */

export type Role = "user" | "assistant" | "system";

export interface Conversation {
  id: string;
  title: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  model: string | null;
  createdAt: string;
}

export interface ModelInfo {
  name: string;
  size: number | null;
  family: string | null;
  modifiedAt: string | null;
}

export interface OllamaStatus {
  online: boolean;
  url: string;
  version: string | null;
  error: string | null;
}

/* --------------------------------- streaming -------------------------------- */

export type StreamEvent =
  | { type: "chunk"; conversationId: string; messageId: string; text: string }
  | { type: "done"; conversationId: string; messageId: string }
  | { type: "error"; conversationId: string; messageId: string; message: string }
  | { type: "cancelled"; conversationId: string; messageId: string };

export interface GenerateEvent {
  type: "chunk" | "done" | "error" | "cancelled";
  text?: string;
  message?: string;
}

/* ----------------------------------- files ---------------------------------- */

export type FileStatus = "parsing" | "indexed" | "failed";

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  ext: string;
  size: number;
  status: FileStatus;
  chunkCount: number;
  error: string | null;
  createdAt: string;
}

export type FileKind = "pdf" | "docx" | "text" | "code" | "data" | "image" | "unknown";

export interface SearchHit {
  kind: "file" | "message" | "conversation";
  id: string;
  conversationId: string | null;
  title: string;
  snippet: string;
}

export interface RetrievedChunk {
  fileId: string;
  fileName: string;
  chunkIndex: number;
  text: string;
  score: number;
}

/* --------------------------------- settings --------------------------------- */

export type ThemeMode = "dark" | "light" | "system";

export interface AppSettings {
  ollamaUrl: string;
  defaultModel: string;
  theme: ThemeMode;
  temperature: number;
  systemPrompt: string;
  shortcutQuickAssistant: string;
  fontSize: "sm" | "md" | "lg";
  animations: boolean;
  compactMode: boolean;
  localOnly: boolean;
  maxContextChars: number;
  contextChunkCount: number;
}

/* ----------------------------------- chat ----------------------------------- */

export interface ChatOptions {
  conversationId: string;
  content: string;
  model: string;
  attachmentFileIds: string[];
}

export interface GenerateOptions {
  prompt: string;
  model: string;
  temperature?: number;
}

export interface AIProvider {
  readonly id: string;
  checkConnection(): Promise<{ online: boolean; version: string | null; error: string | null }>;
  getModels(): Promise<ModelInfo[]>;
  chat(options: { model: string; messages: { role: Role; content: string }[]; temperature?: number; signal?: AbortSignal }): AsyncIterable<{ text?: string; done?: boolean }>;
  generate(options: GenerateOptions & { signal?: AbortSignal }): AsyncIterable<{ text?: string; done?: boolean }>;
}

/* --------------------------------- payload ---------------------------------- */

export interface QuickAssistantPayload {
  clipboardText?: string;
}

export interface AppInfo {
  version: string;
  platform: string;
  userDataPath: string;
  isSmoke: boolean;
}
