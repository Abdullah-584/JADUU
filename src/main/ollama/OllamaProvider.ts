/** OllamaProvider — implements the AIProvider contract against an Ollama HTTP server (local or remote). */
import type { AIProvider, GenerateOptions, ModelInfo } from "@shared/types";
import { OLLAMA_TIMEOUT_MS } from "@shared/constants";
import type {
  ChatRequest,
  ChatRequestMessage,
  ChatStreamChunk,
  GenerateRequest,
  GenerateStreamChunk,
  TagsResponse,
} from "./types";
import { errorMessage } from "../errors";

export function normalizeBaseUrl(raw: string): string {
  const value = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(value)) return `http://${value}`;
  return value;
}

export class OllamaProvider implements AIProvider {
  readonly id = "ollama";

  constructor(
    private baseUrl: string,
    private apiKey = "",
  ) {}

  setBaseUrl(url: string): void {
    this.baseUrl = normalizeBaseUrl(url);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  getApiKey(): string {
    return this.apiKey;
  }

  /** Hosted Ollama-compatible endpoints commonly gate access behind a bearer token. */
  private authHeaders(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  private async fetchJson<T>(
    pathName: string,
    signal?: AbortSignal,
    timeoutMs = OLLAMA_TIMEOUT_MS,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener("abort", onOuterAbort, { once: true });
    try {
      const res = await fetch(`${this.baseUrl}${pathName}`, {
        ...init,
        headers: { ...this.authHeaders(), ...(init.headers as Record<string, string>) },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);
    }
  }

  async checkConnection(): Promise<{ online: boolean; version: string | null; error: string | null }> {
    try {
      const data = await this.fetchJson<{ version?: string }>("/api/version");
      // Public endpoints on ollama.com don't validate the key — probe the identity
      // endpoint so a wrong/expired API key surfaces here instead of at chat time.
      if (this.apiKey) {
        await this.fetchJson<unknown>("/api/me", undefined, OLLAMA_TIMEOUT_MS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      }
      return { online: true, version: data.version ?? null, error: null };
    } catch (err) {
      return { online: false, version: null, error: errorMessage(err) };
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const data = await this.fetchJson<TagsResponse>("/api/tags");
      const models = data.models ?? [];
      return models
        .map((m) => ({
          name: m.name,
          size: typeof m.size === "number" ? m.size : null,
          family: m.details?.family ?? null,
          modifiedAt: m.modified_at ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  /** Streams POST /api/chat as NDJSON; yields text chunks. */
  async *chat(options: {
    model: string;
    messages: ChatRequestMessage[];
    temperature?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<{ text?: string; done?: boolean }, void, unknown> {
    yield* this.streamRequest<ChatRequest, ChatStreamChunk>(
      "/api/chat",
      {
        model: options.model,
        messages: options.messages,
        stream: true,
        options: options.temperature != null ? { temperature: options.temperature } : undefined,
      },
      (chunk) => ({
        text: chunk.message?.content || undefined,
        done: chunk.done === true || undefined,
      }),
      options.signal,
    );
  }

  async *generate(options: GenerateOptions & { signal?: AbortSignal }): AsyncGenerator<{ text?: string; done?: boolean }, void, unknown> {
    yield* this.streamRequest<GenerateRequest, GenerateStreamChunk>(
      "/api/generate",
      {
        model: options.model,
        prompt: options.prompt,
        stream: true,
        options: options.temperature != null ? { temperature: options.temperature } : undefined,
      },
      (chunk) => ({
        text: chunk.response || undefined,
        done: chunk.done === true || undefined,
      }),
      options.signal,
    );
  }

  private async *streamRequest<TReq, TChunk extends { done?: boolean }>(
    pathName: string,
    body: TReq,
    pick: (chunk: TChunk) => { text?: string; done?: boolean },
    signal?: AbortSignal,
  ): AsyncGenerator<{ text?: string; done?: boolean }, void, unknown> {
    const res = await fetch(`${this.baseUrl}${pathName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 200);
      } catch {
        /* ignore */
      }
      throw new Error(`Ollama error ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    if (!res.body) throw new Error("Ollama returned an empty stream");

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buffer = "";

    try {
      while (true) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let parsed: TChunk;
          try {
            parsed = JSON.parse(line) as TChunk;
          } catch {
            continue; // skip malformed partial lines
          }
          yield pick(parsed);
        }
      }
      const tail = buffer.trim();
      if (tail) {
        try {
          yield pick(JSON.parse(tail) as TChunk);
        } catch {
          /* ignore */
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }
  }
}
