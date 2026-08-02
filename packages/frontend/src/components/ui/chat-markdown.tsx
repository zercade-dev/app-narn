/**
 * Markdown renderer for AI-assistant chat bubbles.
 *
 * No `rehype-raw`: model-authored HTML is never parsed as HTML, so a reply
 * cannot inject markup. react-markdown's default `urlTransform` already drops
 * `javascript:` URLs, so links only need target/rel hardening.
 *
 * Long tokens (URLs, JSON, code) must never widen the panel — every block sets
 * its own wrapping or its own horizontal scroll.
 */
import Markdown from 'react-markdown';
import { cn } from '@/lib/utils';

export interface ChatMarkdownProps {
  content: string;
  className?: string;
}

export function ChatMarkdown({ content, className }: Readonly<ChatMarkdownProps>) {
  return (
    <div className={cn('min-w-0 text-sm break-words', className)}>
      <Markdown
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" className="underline">
              {children}
            </a>
          ),
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-1.5 list-disc pl-4 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-1.5 list-decimal pl-4 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          h1: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
          h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
          h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
          code: ({ children }) => (
            <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-xs">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-1.5 max-w-full overflow-x-auto rounded bg-background/60 p-2 text-xs last:mb-0">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
