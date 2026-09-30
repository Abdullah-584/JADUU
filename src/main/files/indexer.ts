/** Indexing pipeline: parse → chunk → store. Fully local. */
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FileRepository, ChunkRepository } from "../database/repositories/files";
import { parseFile } from "./parser";
import { chunkText } from "./chunker";
import { logger, safeError } from "../logger";

const log = logger("files");

export class FileIndexer {
  constructor(
    private readonly files: FileRepository,
    private readonly chunks: ChunkRepository,
  ) {}

  async index(filePath: string): Promise<{ id: string; status: string; chunkCount: number }> {
    const absPath = path.resolve(filePath);
    const existing = this.files.getByPath(absPath);
    if (existing) this.files.setStatus(existing.id, "parsing");

    // Reuse the existing id for stable references (attachments) and FK integrity.
    const id = existing?.id ?? randomUUID();
    try {
      const parsed = await parseFile(absPath);
      const chunks = chunkText(parsed.text);
      this.files.upsert({
        id,
        name: path.basename(absPath),
        path: absPath,
        ext: parsed.ext,
        size: parsed.size,
        status: "indexed",
      });
      this.chunks.replaceAll(id, chunks);
      log.info(`indexed ${path.basename(absPath)} → ${chunks.length} chunks`);
      return { id, status: "indexed", chunkCount: chunks.length };
    } catch (err) {
      const userMessage = err instanceof Error && "userMessage" in err ? String((err as { userMessage: string }).userMessage) : "JADUU couldn't process that file.";
      this.files.upsert({
        id,
        name: path.basename(absPath),
        path: absPath,
        ext: path.extname(absPath).toLowerCase(),
        size: 0,
        status: "failed",
        error: userMessage,
      });
      this.chunks.replaceAll(id, []);
      log.warn(`indexing failed: ${safeError(err)}`);
      return { id, status: "failed", chunkCount: 0 };
    }
  }
}
