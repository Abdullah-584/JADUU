import { describe, expect, it } from "vitest";
import {
  messageContentSchema,
  modelNameSchema,
  ollamaUrlSchema,
  safePathSchema,
  settingsPatchSchema,
  shortcutSchema,
  temperatureSchema,
  titleSchema,
  uuidSchema,
  validate,
} from "../src/shared/validation";

describe("ollamaUrlSchema", () => {
  it("accepts http(s) URLs", () => {
    expect(validate(ollamaUrlSchema, "http://localhost:11434").ok).toBe(true);
    expect(validate(ollamaUrlSchema, "https://ai.local:8080").ok).toBe(true);
  });
  it("rejects non-http protocols and garbage", () => {
    expect(validate(ollamaUrlSchema, "ftp://x").ok).toBe(false);
    expect(validate(ollamaUrlSchema, "not a url").ok).toBe(false);
    expect(validate(ollamaUrlSchema, "").ok).toBe(false);
  });
});

describe("modelNameSchema", () => {
  it("accepts typical model names", () => {
    expect(validate(modelNameSchema, "qwen3:8b").ok).toBe(true);
    expect(validate(modelNameSchema, "llama3.2").ok).toBe(true);
    expect(validate(modelNameSchema, "deepseek-r1/distill").ok).toBe(true);
  });
  it("rejects injection attempts", () => {
    expect(validate(modelNameSchema, "model; rm -rf /").ok).toBe(false);
    expect(validate(modelNameSchema, "").ok).toBe(false);
  });
});

describe("safePathSchema", () => {
  it("accepts absolute paths with supported extensions", () => {
    expect(validate(safePathSchema, "C:\\work\\project.pdf").ok).toBe(true);
    expect(validate(safePathSchema, "/home/user/notes.txt").ok).toBe(true);
  });
  it("rejects traversal, unsupported types and relative paths", () => {
    expect(validate(safePathSchema, "/safe/../../etc/passwd").ok).toBe(false);
    expect(validate(safePathSchema, "/music/song.mp3").ok).toBe(false);
    expect(validate(safePathSchema, "relative/file.txt").ok).toBe(false);
    expect(validate(safePathSchema, "/x/file.txt\0.png").ok).toBe(false);
  });
});

describe("misc schemas", () => {
  it("validates UUIDs", () => {
    expect(validate(uuidSchema, "6f9619ff-8b86-d011-b42d-00c04fc964ff").ok).toBe(true);
    expect(validate(uuidSchema, "not-a-uuid").ok).toBe(false);
  });
  it("validates titles", () => {
    expect(validate(titleSchema, "My chat").ok).toBe(true);
    expect(validate(titleSchema, "").ok).toBe(false);
    expect(validate(titleSchema, "x".repeat(300)).ok).toBe(false);
  });
  it("validates message content", () => {
    expect(validate(messageContentSchema, "hello").ok).toBe(true);
    expect(validate(messageContentSchema, "").ok).toBe(false);
  });
  it("validates shortcuts", () => {
    expect(validate(shortcutSchema, "Ctrl+Shift+Space").ok).toBe(true);
    expect(validate(shortcutSchema, "X").ok).toBe(false);
  });
  it("validates temperature bounds", () => {
    expect(validate(temperatureSchema, 0.7).ok).toBe(true);
    expect(validate(temperatureSchema, 5).ok).toBe(false);
  });
});

describe("settingsPatchSchema", () => {
  it("accepts a valid partial patch", () => {
    const result = validate(settingsPatchSchema, { theme: "light", temperature: 0.3 });
    expect(result.ok).toBe(true);
  });
  it("rejects unknown keys (strict mode)", () => {
    const result = validate(settingsPatchSchema, { evilKey: "x" });
    expect(result.ok).toBe(false);
  });
  it("rejects invalid enum values", () => {
    expect(validate(settingsPatchSchema, { theme: "neon" }).ok).toBe(false);
  });
});
