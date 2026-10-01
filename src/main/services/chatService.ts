/** ChatService — persistence + RAG context + streaming orchestration for chats. */
import { randomUUID } from "node:crypto";
import type { ChatOptions, ChatMessage, Role } from "@shared/types";
import type { ConversationRepository, MessageRepository } from "../database/repositories/conversations";
import type { FileRepository } from "../database/repositories/files";
import type { SettingsService } from "./settingsService";
import type { OllamaService } from "../ollama/OllamaService";
import { SearchService, buildContextBlock } from "../files/search";
import { AppError } from "../errors";
import { logger, safeError } from "../logger";

const log = logger("chat");

const TITLE_MAX = 48;

export function deriveTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\s+/g, " ").trim();
  if (!clean) return "New Chat";
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 1)}…` : clean;
}

export interface StreamHandlers {
  onChunk: (messageId: string, text: string) => void;
  onDone: (messageId: string) => void;
  onError: (messageId: string, message: string) => void;
  onCancelled: (messageId: string) => void;
}

export class ChatService {
  private active = new Map<string, { conversationId: string; messageId: string }>();

  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly files: FileRepository,
    private readonly settings: SettingsService,
    private readonly ollama: OllamaService,
    private readonly search: SearchService,
  ) {}

  /** Creates a persisted user message and starts streaming the assistant reply. */
  async send(options: ChatOptions, handlers: StreamHandlers): Promise<{ userMessage: ChatMessage; assistantMessageId: string }> {
    const settings = this.settings.getAll();
    const model = options.model || settings.defaultModel;
    if (!model) throw new AppError("NO_MODEL", "No model selected", "Choose a model first — JADUU doesn't know which AI to use yet.");

    let conversation = this.conversations.get(options.conversationId);
    if (!conversation) throw new AppError("NO_CONVERSATION", "Conversation not found", "That conversation no longer exists.");

    // Persist the user message.
    const userMessage = this.messages.create(randomUUID(), conversation.id, "user", options.content, null);

    // Auto-title new conversations from the first message.
    const history = this.messages.listByConversation(conversation.id);
    if (conversation.title === "New Chat" && history.length === 1) {
      const title = deriveTitle(options.content);
      this.conversations.rename(conversation.id, title);
      conversation = { ...conversation, title };
    }

    // Build the assistant message shell (persisted after first chunk so empty replies don't linger).
    const assistantMessageId = randomUUID();

    // RAG context from attached files (or, failing that, the whole local library).
    const contextBlock = await this.buildContext(options.attachmentFileIds, options.content, settings.maxContextChars, settings.contextChunkCount);

    const llmMessages: { role: Role; content: string }[] = [
      { role: "system", content: settings.systemPrompt },
    ];
    if (contextBlock) llmMessages.push({ role: "system", content: contextBlock });
    for (const msg of history) {
      if (msg.role === "system") continue;
      llmMessages.push({ role: msg.role, content: msg.content });
    }

    const requestId = `${conversation.id}:${assistantMessageId}`;
    const { stream } = this.ollama.chatStream(requestId, {
      model,
      messages: llmMessages,
      temperature: settings.temperature,
    });
    this.active.set(requestId, { conversationId: conversation.id, messageId: assistantMessageId });

    // Consume the stream in the background; IPC layer receives events via handlers.
    void (async () => {
      let full = "";
      let persisted = false;
      try {
        for await (const chunk of stream) {
          if (chunk.text) {
            full += chunk.text;
            handlers.onChunk(assistantMessageId, chunk.text);
            if (!persisted && full.length > 0) {
              // Persist as soon as we have first content so refresh-safe.
              this.messages.create(assistantMessageId, conversation!.id, "assistant", full, model);
              persisted = true;
            } else if (persisted) {
              this.messages.updateContent(assistantMessageId, full);
            }
          }
          if (chunk.done) break;
        }
        if (!persisted) {
          // Model returned nothing (or immediate done) — persist an empty marker only if errored-less.
          if (full.length === 0) {
            this.messages.create(assistantMessageId, conversation!.id, "assistant", "", model);
          }
        }
        this.conversations.touch(conversation!.id);
        handlers.onDone(assistantMessageId);
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        if (aborted) {
          if (persisted) this.messages.updateContent(assistantMessageId, `${full}\n\n_Stopped._`);
          handlers.onCancelled(assistantMessageId);
        } else {
          const userMessageText = err instanceof AppError ? err.userMessage : toFriendlyOllamaError(err, model);
          log.error(`chat stream failed: ${safeError(err)}`);
          if (persisted) {
            this.messages.updateContent(assistantMessageId, `${full}\n\n⚠️ ${userMessageText}`);
          } else {
            this.messages.create(assistantMessageId, conversation!.id, "assistant", `⚠️ ${userMessageText}`, model);
          }
          handlers.onError(assistantMessageId, userMessageText);
        }
      } finally {
        this.active.delete(requestId);
      }
    })();

    return { userMessage, assistantMessageId };
  }

  stop(conversationId: string): boolean {
    let stopped = false;
    for (const [requestId, info] of this.active) {
      if (info.conversationId === conversationId) {
        stopped = this.ollama.abort(requestId) || stopped;
      }
    }
    return stopped;
  }

  /** Re-runs the last user message: deletes trailing assistant messages and streams again. */
  async regenerate(conversationId: string, model: string, handlers: StreamHandlers): Promise<{ userMessage: ChatMessage; assistantMessageId: string } | null> {
    const history = this.messages.listByConversation(conversationId);
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) return null;

    // Remove trailing assistant messages after the last user message.
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg && msg.role !== "assistant") break;
      if (msg) this.hardDeleteMessage(msg.id);
    }

    return this.send({ conversationId, content: lastUser.content, model, attachmentFileIds: [] }, handlers);
  }

  /** Messages live in `messages` table; assistant shells can be removed directly. */
  private hardDeleteMessage(messageId: string): void {
    try {
      this.messages.deleteById(messageId);
    } catch (err) {
      log.warn(`delete message failed: ${safeError(err)}`);
    }
  }

  private async buildContext(attachmentFileIds: string[], question: string, maxChars: number, chunkCount: number): Promise<string> {
    try {
      const chunks = this.search.retrieve(
        question,
        chunkCount,
        attachmentFileIds.length > 0 ? attachmentFileIds : undefined,
      );
      return buildContextBlock(chunks, maxChars);
    } catch (err) {
      log.warn(`context build failed: ${safeError(err)}`);
      return "";
    }
  }

  getActiveCount(): number {
    return this.active.size;
  }
}

function toFriendlyOllamaError(err: unknown, model?: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("ECONNREFUSED")) return "JADUU couldn't connect to Ollama. Make sure Ollama is running and try again.";
  if (/\b401\b|unauthorized/i.test(raw))
    return "This Ollama server rejected your API key. Check it in Settings → AI → API Key, then retry.";
  if (/\b402\b|payment|quota/i.test(raw))
    return `Your Ollama Cloud plan can't run "${model ?? "this model"}". Pick a free model in the composer (e.g. gpt-oss:20b), or add credits at ollama.com/settings.`;
  if (raw.includes("404")) return "That model isn't installed. Pull it with `ollama pull <model>` and refresh.";
  if (raw.toLowerCase().includes("timeout")) return "Ollama took too long to respond. Try a smaller model or check system load.";
  return raw.slice(0, 200);
}
