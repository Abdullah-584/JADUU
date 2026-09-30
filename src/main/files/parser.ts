/** Local file text extraction. All parsing happens on-device; nothing is uploaded. */
import fs from "node:fs";
import path from "node:path";
import { FILE_KINDS, MAX_FILE_BYTES } from "@shared/constants";
import { AppError } from "../errors";

export interface ParsedFile {
  text: string;
  kind: string;
  label: string;
  size: number;
  ext: string;
}

function readTextFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  // Strip BOM; treat everything as UTF-8 with replacement for invalid chars.
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

export async function parseFile(filePath: string): Promise<ParsedFile> {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `File exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB limit`,
      "That file is too large (limit 50 MB).",
    );
  }

  const ext = path.extname(filePath).toLowerCase();
  const kindInfo = FILE_KINDS[ext];
  if (!kindInfo) {
    throw new AppError("UNSUPPORTED_FILE", `Unsupported extension ${ext}`, "That file type isn't supported yet.");
  }

  try {
    if (kindInfo.kind === "pdf") {
      const text = await extractPdf(filePath);
      return { text, kind: kindInfo.kind, label: kindInfo.label, size: stat.size, ext };
    }
    if (kindInfo.kind === "docx") {
      const text = await extractDocx(filePath);
      return { text, kind: kindInfo.kind, label: kindInfo.label, size: stat.size, ext };
    }
    if (kindInfo.kind === "image") {
      // Images are registered but not OCR'd in the MVP.
      return {
        text: `[Image file: ${path.basename(filePath)} (${formatBytes(stat.size)}) — visual analysis is not available in this version.]`,
        kind: kindInfo.kind,
        label: kindInfo.label,
        size: stat.size,
        ext,
      };
    }
    const text = readTextFile(filePath);
    return { text, kind: kindInfo.kind, label: kindInfo.label, size: stat.size, ext };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("PARSE_FAILED", String(err), "JADUU couldn't read that file.");
  }
}

async function extractPdf(filePath: string): Promise<string> {
  // pdf-parse is CJS; require it lazily. Its default export wraps the buffer.
  const pdfParse = require("pdf-parse");
  const dataBuffer = fs.readFileSync(filePath);
  const result = (await pdfParse(dataBuffer)) as { text?: string };
  const text = (result.text ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) throw new AppError("PDF_EMPTY", "PDF had no extractable text", "No text found — this PDF may be scanned images.");
  return text;
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = require("mammoth");
  const result = (await mammoth.extractRawText({ path: filePath })) as { value?: string };
  const text = (result.value ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) throw new AppError("DOCX_EMPTY", "DOCX had no extractable text", "No text found in that document.");
  return text;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
