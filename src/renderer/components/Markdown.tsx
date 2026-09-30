/** Safe markdown: react-markdown + GFM + rehype-highlight. No raw HTML execution. */
import { memo, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { IconCheck, IconCopy } from "./icons";

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(() => {
    try {
      void navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [getText]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
    >
      {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown selectable">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children }) => {
            // Extract language + raw text for the header/copy button.
            let language = "code";
            let raw = "";
            const child: unknown = Array.isArray(children) ? children[0] : children;
            if (child && typeof child === "object" && "props" in (child as Record<string, unknown>)) {
              const props = (child as { props?: { className?: string; children?: unknown } }).props;
              const match = /language-(\w+)/.exec(props?.className ?? "");
              if (match) language = match[1] ?? "code";
              raw = extractText(props?.children);
            }
            return (
              <div className="code-block">
                <div className="code-block-header">
                  <span>{language}</span>
                  <CopyButton getText={() => raw} />
                </div>
                <pre>{children}</pre>
              </div>
            );
          },
          a: ({ href, children }) => {
            // Links open externally via the bridge; never navigate in-app.
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
                    void window.jaduu.app.openExternal(href);
                  }
                }}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function extractText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in (node as Record<string, unknown>)) {
    return extractText((node as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}
