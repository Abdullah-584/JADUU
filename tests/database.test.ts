import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase, closeDatabase, type SqliteDatabase } from "../src/main/database/database";
import { ConversationRepository, MessageRepository } from "../src/main/database/repositories/conversations";
import { ChunkRepository, FileRepository, SettingsRepository } from "../src/main/database/repositories/files";
import { deriveTitle } from "../src/main/services/chatService";

let db: SqliteDatabase;
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "jaduu-test-"));
  db = openDatabase(path.join(dir, "test.db"));
});

afterEach(() => {
  closeDatabase(db);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("conversations + messages", () => {
  it("creates, reads, renames and deletes conversations", () => {
    const conversations = new ConversationRepository(db);
    const convo = conversations.create("id-1", "New Chat", null);
    expect(convo.id).toBe("id-1");

    expect(conversations.get("id-1")?.title).toBe("New Chat");

    conversations.rename("id-1", "Renamed");
    expect(conversations.get("id-1")?.title).toBe("Renamed");

    conversations.delete("id-1");
    expect(conversations.get("id-1")).toBeNull();
  });

  it("saves and retrieves messages in order", () => {
    const conversations = new ConversationRepository(db);
    const messages = new MessageRepository(db);
    conversations.create("c1", "chat", null);
    messages.create("m1", "c1", "user", "first question", null);
    messages.create("m2", "c1", "assistant", "first answer", "qwen3:8b");

    const list = messages.listByConversation("c1");
    expect(list).toHaveLength(2);
    expect(list[0]?.role).toBe("user");
    expect(list[1]?.content).toBe("first answer");
    expect(list[1]?.model).toBe("qwen3:8b");
  });

  it("updates message content (streaming persistence)", () => {
    const conversations = new ConversationRepository(db);
    const messages = new MessageRepository(db);
    conversations.create("c1", "chat", null);
    messages.create("m1", "c1", "assistant", "par", null);
    messages.updateContent("m1", "partial → complete");
    expect(messages.listByConversation("c1")[0]?.content).toBe("partial → complete");
  });

  it("cascades message deletion with the conversation", () => {
    const conversations = new ConversationRepository(db);
    const messages = new MessageRepository(db);
    conversations.create("c1", "chat", null);
    messages.create("m1", "c1", "user", "hello", null);
    conversations.delete("c1");
    expect(messages.listByConversation("c1")).toHaveLength(0);
  });

  it("clears messages but keeps the conversation", () => {
    const conversations = new ConversationRepository(db);
    const messages = new MessageRepository(db);
    conversations.create("c1", "chat", null);
    messages.create("m1", "c1", "user", "hello", null);
    conversations.clear("c1");
    expect(conversations.get("c1")).not.toBeNull();
    expect(messages.listByConversation("c1")).toHaveLength(0);
  });

  it("lists conversations most-recent-first", async () => {
    const conversations = new ConversationRepository(db);
    const a = conversations.create("a", "older", null);
    await new Promise((r) => setTimeout(r, 10));
    conversations.create("b", "newer", null);
    conversations.rename(a.id, "older-but-updated");
    const list = conversations.list();
    expect(list[0]?.id).toBe("a");
  });
});

describe("files + chunks + FTS", () => {
  it("indexes chunks and finds them via FTS5", () => {
    const files = new FileRepository(db);
    const chunks = new ChunkRepository(db);
    files.upsert({ id: "f1", name: "auth.pdf", path: "/tmp/auth.pdf", ext: ".pdf", size: 100, status: "indexed" });
    chunks.replaceAll("f1", [
      { index: 0, text: "Authentication uses JWT bearer tokens." },
      { index: 1, text: "The storage layer uses SQLite." },
    ]);

    expect(files.get("f1")?.chunkCount).toBe(2);

    const search = `SELECT fc.text FROM file_chunks_fts JOIN file_chunks fc ON fc.id = file_chunks_fts.rowid WHERE file_chunks_fts MATCH ?`;
    const rows = db.prepare(search).all('"JWT"') as { text: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toContain("JWT");
  });

  it("removes old chunks when re-indexing a file", () => {
    const files = new FileRepository(db);
    const chunks = new ChunkRepository(db);
    files.upsert({ id: "f1", name: "a.txt", path: "/tmp/a.txt", ext: ".txt", size: 10, status: "indexed" });
    chunks.replaceAll("f1", [{ index: 0, text: "old" }]);
    chunks.replaceAll("f1", [{ index: 0, text: "new" }, { index: 1, text: "content" }]);
    expect(chunks.count()).toBe(2);
  });

  it("deletes a file with its chunks", () => {
    const files = new FileRepository(db);
    const chunks = new ChunkRepository(db);
    files.upsert({ id: "f1", name: "a.txt", path: "/tmp/a.txt", ext: ".txt", size: 10, status: "indexed" });
    chunks.replaceAll("f1", [{ index: 0, text: "text" }]);
    files.delete("f1");
    expect(files.get("f1")).toBeNull();
    expect(chunks.count()).toBe(0);
  });
});

describe("settings", () => {
  it("round-trips settings JSON", () => {
    const repo = new SettingsRepository(db);
    repo.set("app.settings", JSON.stringify({ temperature: 0.4 }));
    expect(JSON.parse(repo.get("app.settings") ?? "{}")).toEqual({ temperature: 0.4 });
    repo.set("app.settings", JSON.stringify({ temperature: 0.9 }));
    expect(JSON.parse(repo.get("app.settings") ?? "{}").temperature).toBe(0.9);
  });
});

describe("deriveTitle", () => {
  it("trims long titles with an ellipsis", () => {
    const long = "a".repeat(100);
    expect(deriveTitle(long).length).toBe(48);
    expect(deriveTitle(long).endsWith("…")).toBe(true);
  });
  it("collapses whitespace", () => {
    expect(deriveTitle("  hello   world  ")).toBe("hello world");
  });
});
