import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chunkText } from "../src/main/files/chunker";
import { FileIndexer } from "../src/main/files/indexer";
import { SearchService, buildContextBlock } from "../src/main/files/search";
import { openDatabase, closeDatabase, type SqliteDatabase } from "../src/main/database/database";
import { ConversationRepository, MessageRepository } from "../src/main/database/repositories/conversations";
import { ChunkRepository, FileRepository } from "../src/main/database/repositories/files";

let db: SqliteDatabase;
let dir: string;
let files: FileRepository;
let chunks: ChunkRepository;
let conversations: ConversationRepository;
let messages: MessageRepository;
let indexer: FileIndexer;
let search: SearchService;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jaduu-files-"));
  db = openDatabase(path.join(dir, "test.db"));
  files = new FileRepository(db);
  chunks = new ChunkRepository(db);
  conversations = new ConversationRepository(db);
  messages = new MessageRepository(db);
  indexer = new FileIndexer(files, chunks);
  search = new SearchService(db, files, chunks, conversations, messages);
});

afterEach(() => {
  closeDatabase(db);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("chunker", () => {
  it("splits on paragraph boundaries", () => {
    const text = `${"para one ".repeat(50)}\n\n${"para two ".repeat(50)}\n\nshort`;
    const result = chunkText(text, 300, 40);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(320);
    }
  });

  it("hard-splits single giant paragraphs with overlap", () => {
    const giant = "x".repeat(3000);
    const result = chunkText(giant, 1000, 100);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // overlap: end of chunk 0 ≈ start of chunk 1
    const first = result[0]!.text;
    const second = result[1]!.text;
    expect(second.startsWith(first.slice(-80))).toBe(true);
  });

  it("returns empty for empty text", () => {
    expect(chunkText("   \n\n  ")).toEqual([]);
  });
});

describe("indexer", () => {
  it("extracts and indexes a TXT file", async () => {
    const p = path.join(dir, "notes.txt");
    fs.writeFileSync(p, "JADUU stores everything locally.\n\nNothing leaves this machine.");
    const result = await indexer.index(p);
    expect(result.status).toBe("indexed");
    expect(result.chunkCount).toBeGreaterThanOrEqual(1);
    const file = files.getByPath(path.resolve(p));
    expect(file?.name).toBe("notes.txt");
  });

  it("extracts JSON, CSV and code files", async () => {
    const jsonPath = path.join(dir, "data.json");
    fs.writeFileSync(jsonPath, JSON.stringify({ authentication: "JWT tokens", storage: "SQLite" }));
    const jsonResult = await indexer.index(jsonPath);
    expect(jsonResult.status).toBe("indexed");

    const pyPath = path.join(dir, "script.py");
    fs.writeFileSync(pyPath, "def hello():\n    return 'world'\n");
    const pyResult = await indexer.index(pyPath);
    expect(pyResult.status).toBe("indexed");
  });

  it("marks unsupported files as failed", async () => {
    const p = path.join(dir, "photo.bmp");
    fs.writeFileSync(p, "not really a bmp");
    const result = await indexer.index(p);
    expect(result.status).toBe("failed");
  });

  it("marks missing files as failed without crashing", async () => {
    const result = await indexer.index(path.join(dir, "ghost.txt"));
    expect(result.status).toBe("failed");
  });

  it("re-indexing the same path replaces chunks, not duplicates", async () => {
    const p = path.join(dir, "again.md");
    fs.writeFileSync(p, "# First version\n\nsome content");
    const first = await indexer.index(p);
    fs.writeFileSync(p, "# Second version\n\ndifferent content about authentication");
    const second = await indexer.index(p);
    expect(second.status).toBe("indexed");
    expect(second.id).toBe(first.id); // stable id across re-index
    expect(files.list()).toHaveLength(1);
    expect(chunks.count()).toBeGreaterThan(0);
  });
});

describe("search (local RAG)", () => {
  it("retrieves relevant chunks for a question", async () => {
    const p = path.join(dir, "docs.md");
    fs.writeFileSync(
      p,
      [
        "# Project documentation",
        "The authentication system uses JWT bearer tokens with a 15 minute expiry.",
        "",
        "## Storage",
        "All data lives in a local SQLite database on the user's machine.",
      ].join("\n"),
    );
    await indexer.index(p);
    const results = search.retrieve("How does authentication work?", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.text).toContain("JWT");
    expect(results[0]!.fileName).toBe("docs.md");
  });

  it("returns [] for garbage queries instead of throwing", () => {
    expect(search.retrieve('"\\ AND (', 5)).toEqual([]);
    expect(search.retrieve("", 5)).toEqual([]);
  });

  it("searchAll finds file names, content and conversations", async () => {
    const p = path.join(dir, "auth-notes.txt");
    fs.writeFileSync(p, "Authentication notes: JWT implementation details and token refresh flow.");
    await indexer.index(p);
    conversations.create("c1", "Authentication discussion", null);
    messages.create("m1", "c1", "user", "explain the authentication flow", null);

    const hits = search.searchAll("authentication");
    const kinds = hits.map((h) => h.kind);
    expect(kinds).toContain("conversation");
    expect(kinds).toContain("file");
    expect(kinds).toContain("message");
  });

  it("buildContextBlock respects the char budget", () => {
    const block = buildContextBlock(
      [
        { fileId: "f", fileName: "a.txt", chunkIndex: 0, text: "x".repeat(600), score: 1 },
        { fileId: "g", fileName: "b.txt", chunkIndex: 0, text: "y".repeat(600), score: 0.5 },
      ],
      900,
    );
    expect(block.length).toBeLessThan(1400);
    expect(block).toContain("a.txt");
    expect(block).not.toContain("b.txt");
  });
});
