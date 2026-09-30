/** OllamaService — app-facing wrapper: status, model cache, chat orchestration with abort. */
import type { ModelInfo, OllamaStatus } from "@shared/types";
import { OllamaProvider, normalizeBaseUrl } from "./OllamaProvider";

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export type OllamaChatChunk = { text?: string; done?: boolean };

export class OllamaService {
  private provider: OllamaProvider;
  private status: OllamaStatus = { online: false, url: "", version: null, error: null };
  private models: ModelInfo[] = [];
  private lastStatusAt = 0;
  private readonly statusTtlMs = 10_000;
  private abortControllers = new Map<string, AbortController>();

  constructor(baseUrl: string) {
    this.provider = new OllamaProvider(normalizeBaseUrl(baseUrl));
    this.status.url = this.provider.getBaseUrl();
  }

  setBaseUrl(url: string): void {
    const normalized = normalizeBaseUrl(url);
    if (normalized === this.provider.getBaseUrl()) return;
    this.provider.setBaseUrl(normalized);
    this.status.url = normalized;
    this.lastStatusAt = 0; // force refresh
    this.models = [];
  }

  getStatus(): OllamaStatus {
    return this.status;
  }

  /** Cached status probe (10s TTL) — safe to call on every UI focus. */
  async checkStatus(force = false): Promise<OllamaStatus> {
    const now = Date.now();
    if (!force && now - this.lastStatusAt < this.statusTtlMs) return this.status;
    this.lastStatusAt = now;
    const result = await this.provider.checkConnection();
    this.status = {
      online: result.online,
      url: this.provider.getBaseUrl(),
      version: result.version,
      error: result.error,
    };
    return this.status;
  }

  async getModels(force = false): Promise<ModelInfo[]> {
    if (!force && this.models.length > 0) return this.models;
    this.models = await this.provider.getModels();
    return this.models;
  }

  async testModel(model: string): Promise<boolean> {
    try {
      for await (const chunk of this.provider.generate({ model, prompt: "ping", temperature: 0 })) {
        if (chunk.text) return true; // got any token back — model works
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Runs a streaming chat. Returns an id used to abort via `abort(requestId)`.
   * The returned async iterable is consumed by the IPC layer which forwards
   * events to the renderer over `chat:stream-event`.
   */
  chatStream(requestId: string, options: {
    model: string;
    messages: ChatTurn[];
    temperature?: number;
  }): { stream: AsyncIterable<OllamaChatChunk>; abort: () => void } {
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    const upstream = this.provider.chat({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      signal: controller.signal,
    });

    const cleanup = () => this.abortControllers.delete(requestId);

    const stream: AsyncIterable<OllamaChatChunk> = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            try {
              const { value, done } = await upstream.next();
              if (done) {
                cleanup();
                return { value: { done: true }, done: false };
              }
              return { value, done: false };
            } catch (err) {
              cleanup();
              throw err;
            }
          },
          async return() {
            cleanup();
            return { value: undefined as unknown as OllamaChatChunk, done: true };
          },
        };
      },
    };

    return { stream, abort: () => controller.abort() };
  }

  abort(requestId: string): boolean {
    const controller = this.abortControllers.get(requestId);
    if (!controller) return false;
    controller.abort();
    this.abortControllers.delete(requestId);
    return true;
  }

  abortAll(): void {
    for (const [, controller] of this.abortControllers) controller.abort();
    this.abortControllers.clear();
  }

  getProvider(): OllamaProvider {
    return this.provider;
  }
}
