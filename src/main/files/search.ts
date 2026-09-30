/** Local RAG retrieval + global search over files, chunks and conversations. */
import type { SqliteDatabase } from "../database/database";
import type { RetrievedChunk, SearchHit } from "@shared/types";
import { ChunkRepository, FileRepository } from "../database/repositories/files";
import { ConversationRepository, MessageRepository } from "../database/repositories/conversations";
import { logger, safeError } from "../logger";

const log = logger("search");

function escapeFts(query: string, operator: "AND" | "OR" = "OR"): string {
  // Wrap each token in double quotes so FTS treats it as a phrase term;
  // prevents syntax errors from user punctuation.
  return query
    .split(/\s+/)
    .map((token) => token.replace(/^"|"$/g, ""))
    .filter((token) => token.length > 0)
    .map((token) => `"${token.replace(/"/g, "")}"`)
    .join(` ${operator} `);
}

function makeSnippet(db: SqliteDatabase, text: string, query: string, length = 180): string {
  try {
    const row = db.pragma("user_version", { simple: true });
    void row;
    const ftsExpr = escapeFts(query.split(/\s+/).slice(0, 3).join(" "));
    const result = db.prepare(
      `SELECT snippet(file_chunks_fts, 0, '『', '』', '…', 12) AS s FROM file_chunks_fts WHERE file_chunks_fts MATCH ? LIMIT 1`,
    ).get(ftsExpr) as { s?: string } | undefined;
    if (result?.s) return String(result.s);
  } catch {
    /* fall through to plain snippet */
  }
  void text;
  void query;
  void length;
  return text.slice(0, length);
}

export class SearchService {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly files: FileRepository,
    private readonly chunks: ChunkRepository,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
  ) {}

  /** Retrieve top chunks for RAG context. Rank = BM25 (lower is better). */
  retrieve(query: string, limit: number, fileIds?: string[]): RetrievedChunk[] {
    const ftsQuery = escapeFts(query);
    if (!ftsQuery) return [];
    try {
      const scoped = fileIds && fileIds.length > 0;
      const placeholders = scoped ? fileIds!.map(() => "?").join(",") : "";
      const sql = scoped
        ? `SELECT fc.id, fc.file_id, fc.text, bm25(file_chunks_fts) AS rank
           FROM file_chunks_fts
           JOIN file_chunks fc ON fc.id = file_chunks_fts.rowid
           WHERE file_chunks_fts MATCH ? AND fc.file_id IN (${placeholders})
           ORDER BY rank
           LIMIT ?`
        : `SELECT fc.id, fc.file_id, fc.text, bm25(file_chunks_fts) AS rank
           FROM file_chunks_fts
           JOIN file_chunks fc ON fc.id = file_chunks_fts.rowid
           WHERE file_chunks_fts MATCH ?
           ORDER BY rank
           LIMIT ?`;
      const params = scoped ? [ftsQuery, ...fileIds!, limit] : [ftsQuery, limit];
      const rows = this.db.prepare(sql).all(...params) as { id: number; file_id: string; text: string; rank: number }[];

      const filesById = new Map(this.files.list().map((f) => [f.id, f]));
      const rowsOut: RetrievedChunk[] = rows
        .map((r) => {
          const file = filesById.get(r.file_id);
          return {
            fileId: r.file_id,
            fileName: file?.name ?? "file",
            chunkIndex: 0,
            text: r.text,
            score: Number(r.rank),
          };
        })
        .filter((r) => r.fileId);
      // Normalize scores to 0..1 (1 = best) for the UI/context builder.
      const worst = rowsOut.length ? Math.max(...rowsOut.map((r) => r.score)) : 1;
      return rowsOut.map((r) => ({ ...r, score: worst > 0 ? 1 - r.score / worst : 1 }));
    } catch (err) {
      log.warn(`retrieve failed: ${safeError(err)}`);
      return [];
    }
  }

  /** Global search across chunk content, file names and conversations. */
  searchAll(query: string): SearchHit[] {
    const hits: SearchHit[] = [];
    const like = `%${query.replace(/[%_]/g, "")}%`;
    const q = query.trim();
    if (!q) return hits;

    // 1. Chunk content (FTS)
    const ftsQuery = escapeFts(q);
    if (ftsQuery) {
      try {
        const rows = this.db
          .prepare(
            `SELECT fc.id, fc.file_id, fc.text, bm25(file_chunks_fts) AS rank
             FROM file_chunks_fts JOIN file_chunks fc ON fc.id = file_chunks_fts.rowid
             WHERE file_chunks_fts MATCH ? ORDER BY rank LIMIT 8`,
          )
          .all(ftsQuery) as { id: number; file_id: string; text: string; rank: number }[];
        const filesById = new Map(this.files.list().map((f) => [f.id, f]));
        for (const row of rows) {
          const file = filesById.get(row.file_id);
          if (!file) continue;
          hits.push({
            kind: "file",
            id: file.id,
            conversationId: null,
            title: file.name,
            snippet: makeSnippet(this.db, row.text, q),
          });
        }
      } catch (err) {
        log.warn(`fts search failed: ${safeError(err)}`);
      }
    }

    // 2. File names (LIKE)
    try {
      const rows = this.db
        .prepare("SELECT id, name FROM files WHERE name LIKE ? LIMIT 5")
        .all(like) as { id: string; name: string }[];
      for (const row of rows) {
        if (!hits.some((h) => h.kind === "file" && h.id === row.id)) {
          hits.push({ kind: "file", id: row.id, conversationId: null, title: row.name, snippet: "File name match" });
        }
      }
    } catch {
      /* ignore */
    }

    // 3. Conversation titles
    try {
      const rows = this.db
        .prepare("SELECT id, title FROM conversations WHERE title LIKE ? ORDER BY updated_at DESC LIMIT 5")
        .all(like) as { id: string; title: string }[];
      for (const row of rows) {
        hits.push({ kind: "conversation", id: row.id, conversationId: row.id, title: row.title, snippet: "Conversation" });
      }
    } catch {
      /* ignore */
    }

    // 4. Message content (LIKE across all conversations)
    try {
      const rows = this.db
        .prepare(
          `SELECT m.id, m.content, m.conversation_id, c.title
           FROM messages m JOIN conversations c ON c.id = m.conversation_id
           WHERE m.content LIKE ? ORDER BY m.created_at DESC LIMIT 8`,
        )
        .all(like) as { id: string; content: string; conversation_id: string; title: string }[];
      for (const row of rows) {
        const idx = row.content.toLowerCase().indexOf(q.toLowerCase());
        const start = Math.max(0, idx - 60);
        const snippet = idx >= 0 ? (start > 0 ? "…" : "") + row.content.slice(start, idx + q.length + 80) : row.content.slice(0, 140);
        hits.push({
          kind: "message",
          id: row.id,
          conversationId: row.conversation_id,
          title: row.title,
          snippet: snippet + (row.content.length > idx + q.length + 80 ? "…" : ""),
        });
      }
    } catch (err) {
      log.warn(`message search failed: ${safeError(err)}`);
    }

    return hits;
  }
}

export function buildContextBlock(chunks: RetrievedChunk[], maxChars: number): string {
  if (chunks.length === 0) return "";
  const parts: string[] = ["The user has attached local files. Relevant excerpts:"];
  let used = parts[0].length;
  for (const chunk of chunks) {
    const part = `\n\n---\nFrom ${chunk.fileName}:\n${chunk.text}`;
    if (used + part.length > maxChars) break;
    parts.push(part);
    used += part.length;
  }
  parts.push("\n---\nAnswer using this context when relevant. If the context doesn't contain the answer, say so clearly — do not invent information.");
  return parts.join("");
}
