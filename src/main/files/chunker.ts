/** Splits extracted text into overlapping chunks for indexing and retrieval. */
import { CHUNK_OVERLAP, CHUNK_SIZE } from "@shared/constants";

export interface TextChunk {
  index: number;
  text: string;
}

export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): TextChunk[] {
  const clean = text.replace(/\u0000/g, "").trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: TextChunk[] = [];
  let current = "";

  const pushCurrent = () => {
    const t = current.trim();
    if (t) chunks.push({ index: chunks.length, text: t });
    current = "";
  };

  for (const paragraph of paragraphs) {
    // Very long single paragraph: hard-split with overlap.
    if (paragraph.length > size) {
      pushCurrent();
      let start = 0;
      while (start < paragraph.length) {
        const end = Math.min(start + size, paragraph.length);
        chunks.push({ index: chunks.length, text: paragraph.slice(start, end) });
        if (end >= paragraph.length) break;
        start = end - overlap > 0 ? end - overlap : end;
      }
      continue;
    }
    if (current.length + paragraph.length + 2 > size) pushCurrent();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  pushCurrent();

  return chunks;
}
