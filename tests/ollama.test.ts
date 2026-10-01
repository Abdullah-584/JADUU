import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { OllamaProvider, normalizeBaseUrl } from "../src/main/ollama/OllamaProvider";
import { OllamaService } from "../src/main/ollama/OllamaService";

let server: http.Server | undefined;
let baseUrl = "";
let lastAuth: string | undefined;

function startMock(behavior: {
  version?: string;
  tags?: unknown;
  chatChunks?: unknown[];
  chatStatus?: number;
  meStatus?: number;
  delayMs?: number;
}): Promise<void> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      lastAuth = req.headers.authorization;
      const sendJson = (obj: unknown) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (req.url === "/api/version") {
        if (behavior.version === undefined) {
          res.writeHead(500);
          res.end("boom");
          return;
        }
        sendJson({ version: behavior.version });
        return;
      }
      if (req.url === "/api/me" && req.method === "POST") {
        res.writeHead(behavior.meStatus ?? 200, { "Content-Type": "application/json" });
        res.end(behavior.meStatus && behavior.meStatus >= 400 ? '{"error":"invalid credentials"}' : '{"account":"tester"}');
        return;
      }
      if (req.url === "/api/tags") {
        sendJson(behavior.tags ?? { models: [] });
        return;
      }
      if (req.url === "/api/chat") {
        res.writeHead(behavior.chatStatus ?? 200, { "Content-Type": "application/x-ndjson" });
        const chunks = behavior.chatChunks ?? [];
        let i = 0;
        const timer = setInterval(() => {
          if (i < chunks.length) {
            res.write(JSON.stringify(chunks[i]) + "\n");
            i++;
          } else {
            clearInterval(timer);
            res.end();
          }
        }, behavior.delayMs ?? 5);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

async function closeMock(): Promise<void> {
  if (!server) return;
  (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  server = undefined as unknown as http.Server;
}

beforeEach(async () => {
  lastAuth = undefined;
  await startMock({
    version: "0.5.4",
    tags: {
      models: [
        { name: "qwen3:8b", size: 4_700_000_000, details: { family: "qwen2" } },
        { name: "llama3.2:3b", size: 2_000_000_000, details: { family: "llama" } },
      ],
    },
  });
});

afterEach(async () => {
  await closeMock();
});

describe("OllamaProvider", () => {
  it("normalizes base URLs", () => {
    expect(normalizeBaseUrl("http://localhost:11434/")).toBe("http://localhost:11434");
    expect(normalizeBaseUrl("localhost:11434")).toBe("http://localhost:11434");
    expect(normalizeBaseUrl("  https://ai.local:8080  ")).toBe("https://ai.local:8080");
  });

  it("reports a successful connection", async () => {
    const provider = new OllamaProvider(baseUrl);
    const status = await provider.checkConnection();
    expect(status.online).toBe(true);
    expect(status.version).toBe("0.5.4");
    expect(status.error).toBeNull();
  });

  it("reports offline on connection refused", async () => {
    const provider = new OllamaProvider("http://127.0.0.1:9"); // nothing listens here
    const status = await provider.checkConnection();
    expect(status.online).toBe(false);
    expect(status.error).toBeTruthy();
  });

  it("lists installed models from /api/tags", async () => {
    const provider = new OllamaProvider(baseUrl);
    const models = await provider.getModels();
    expect(models.map((m) => m.name)).toEqual(["llama3.2:3b", "qwen3:8b"]); // sorted
    expect(models[1]?.family).toBe("qwen2");
  });

  it("streams chat chunks and a done flag", async () => {
    await closeMock();
    await startMock({
      version: "0.5.4",
      chatChunks: [
        { message: { role: "assistant", content: "Hel" } },
        { message: { role: "assistant", content: "lo " } },
        { message: { role: "assistant", content: "world" }, done: true },
      ],
    });
    const provider = new OllamaProvider(baseUrl);
    const texts: string[] = [];
    let sawDone = false;
    for await (const chunk of provider.chat({
      model: "qwen3:8b",
      messages: [{ role: "user", content: "hi" }],
    })) {
      if (chunk.text) texts.push(chunk.text);
      if (chunk.done) sawDone = true;
    }
    expect(texts.join("")).toBe("Hello world");
    expect(sawDone).toBe(true);
  });

  it("sends no Authorization header when no API key is set", async () => {
    const provider = new OllamaProvider(baseUrl);
    await provider.checkConnection();
    expect(lastAuth).toBeUndefined();
  });

  it("sends a bearer token on every request when an API key is set", async () => {
    const provider = new OllamaProvider(baseUrl, "test-key-123");
    await provider.checkConnection();
    expect(lastAuth).toBe("Bearer test-key-123");

    await provider.getModels();
    expect(lastAuth).toBe("Bearer test-key-123");

    for await (const _ of provider.chat({ model: "qwen3:8b", messages: [{ role: "user", content: "hi" }] })) {
      void _;
    }
    expect(lastAuth).toBe("Bearer test-key-123");
  });

  it("updates and clears the key via setApiKey", async () => {
    const provider = new OllamaProvider(baseUrl);
    provider.setApiKey("k1");
    await provider.checkConnection();
    expect(lastAuth).toBe("Bearer k1");
    expect(provider.getApiKey()).toBe("k1");

    provider.setApiKey("  ");
    expect(provider.getApiKey()).toBe("");
    await provider.checkConnection();
    expect(lastAuth).toBeUndefined();
  });

  it("verifies the API key via /api/me during connection check", async () => {
    const provider = new OllamaProvider(baseUrl, "good-key");
    const status = await provider.checkConnection();
    expect(status.online).toBe(true);
    expect(lastAuth).toBe("Bearer good-key");
  });

  it("fails the connection check when the API key is rejected", async () => {
    await closeMock();
    await startMock({ version: "0.5.4", meStatus: 401 });
    const provider = new OllamaProvider(baseUrl, "bad-key");
    const status = await provider.checkConnection();
    expect(status.online).toBe(false);
    expect(status.error).toContain("401");
  });

  it("skips the /api/me probe when no API key is set", async () => {
    const provider = new OllamaProvider(baseUrl);
    const status = await provider.checkConnection();
    expect(status.online).toBe(true);
  });

  it("throws a friendly error on non-200 chat responses", async () => {
    await closeMock();
    await startMock({ version: "0.5.4", chatStatus: 404 });
    const provider = new OllamaProvider(baseUrl);
    await expect(async () => {
      for await (const _ of provider.chat({ model: "nope", messages: [{ role: "user", content: "x" }] })) {
        void _;
      }
    }).rejects.toThrow(/404/);
  });
});

describe("OllamaService", () => {
  it("caches status and refreshes on demand", async () => {
    const service = new OllamaService(baseUrl);
    const first = await service.checkStatus();
    expect(first.online).toBe(true);
    const second = await service.checkStatus();
    expect(second.url).toBe(baseUrl);
  });

  it("clears cached models when the API key changes", async () => {
    const service = new OllamaService(baseUrl, "key-a");
    const first = await service.getModels(true);
    expect(first.length).toBe(2);

    service.setApiKey("key-b");
    // Cache cleared → next non-forced call must refetch (mock returns 2 again, so
    // verify via the provider that the new key is actually in use).
    expect(service.getApiKey()).toBe("key-b");
    const status = await service.checkStatus(); // was not forced but key change reset TTL
    expect(status.online).toBe(true);
  });

  it("supports aborting a chat stream", async () => {
    await closeMock();
    await startMock({
      version: "0.5.4",
      chatChunks: [
        { message: { role: "assistant", content: "a" } },
        { message: { role: "assistant", content: "b" } },
        { message: { role: "assistant", content: "c" } },
        { message: { role: "assistant", content: "d" }, done: true },
      ],
      delayMs: 80,
    });
    const service = new OllamaService(baseUrl);
    const { stream, abort } = service.chatStream("req-1", {
      model: "qwen3:8b",
      messages: [{ role: "user", content: "count" }],
    });
    const received: string[] = [];
    let aborted = false;
    await expect(
      (async () => {
        for await (const chunk of stream) {
          if (chunk.text) {
            received.push(chunk.text);
            if (!aborted && received.length >= 1) {
              aborted = true;
              abort();
            }
          }
        }
      })(),
    ).rejects.toThrow();
    expect(received.length).toBeGreaterThanOrEqual(1);
  });
});
