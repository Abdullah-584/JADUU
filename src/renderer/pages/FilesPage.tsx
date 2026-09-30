import { useEffect, useState } from "react";
import { useFileStore } from "../stores/fileStore";
import { IconFiles, IconPlus, IconTrash } from "../components/icons";
import type { WorkspaceFile } from "@shared/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusPill(file: WorkspaceFile) {
  if (file.status === "indexed") {
    return <span className="text-[11px] text-ok">✓ Indexed{file.chunkCount ? ` · ${file.chunkCount} chunks` : ""}</span>;
  }
  if (file.status === "failed") {
    return <span className="text-[11px] text-danger">✗ {file.error ?? "Failed"}</span>;
  }
  return <span className="text-[11px] text-warn">Indexing…</span>;
}

export default function FilesPage() {
  const files = useFileStore((s) => s.files);
  const loading = useFileStore((s) => s.loading);
  const load = useFileStore((s) => s.load);
  const addFromDialog = useFileStore((s) => s.addFromDialog);
  const addPaths = useFileStore((s) => s.addPaths);
  const remove = useFileStore((s) => s.remove);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const paths = Array.from(e.dataTransfer.files).map((f) => (f as { path?: string }).path).filter(Boolean) as string[];
    if (paths.length === 0) return;
    setBusy(true);
    try {
      await addPaths(paths);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="h-full overflow-y-auto"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => void onDrop(e)}
    >
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-txt-1">Files</h1>
            <p className="mt-0.5 text-xs text-txt-3">
              Indexed locally for private search &amp; chat context. Nothing is uploaded.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addFromDialog()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-transform hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            <IconPlus size={14} /> Add files
          </button>
        </div>

        {dragOver ? (
          <div className="mt-4 flex h-28 items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft text-sm text-txt-1">
            Drop files to index
          </div>
        ) : null}

        {files.length === 0 && !loading ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <IconFiles size={36} className="text-txt-3" />
            <div className="text-sm text-txt-2">No files yet</div>
            <div className="max-w-xs text-xs leading-relaxed text-txt-3">
              Add PDFs, Word documents, Markdown, code and data files. JADUU extracts text locally,
              chunks it and makes it searchable — fully offline.
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
              >
                <span className="text-xl">📄</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-txt-1">{file.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-txt-3">
                    <span>{formatBytes(file.size)}</span>
                    <span>·</span>
                    <span className="uppercase">{file.ext.replace(".", "")}</span>
                    <span>·</span>
                    {statusPill(file)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(file.id)}
                  className="rounded-lg p-1.5 text-txt-3 opacity-0 transition-all hover:bg-surface-2 hover:text-danger group-hover:opacity-100"
                  title="Remove from workspace"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
