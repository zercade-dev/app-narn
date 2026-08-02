import React from 'react';

/**
 * A level-2 heading flagged `(Optional)` — with or without the surrounding
 * `*…*` emphasis — opens a section that renders collapsed. Guides use it for
 * steps that improve quality but aren't required (see `usage-quick-setup.md`).
 */
const OPTIONAL_HEADING_RE = /\(\s*optional\s*\)/i;

export function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  // Monotonic block key. Reusing the line index `i` can collide when one block
  // (e.g. a list/code-fence) is immediately followed by another (e.g. a
  // heading): the first block is keyed on the line index of the *next* block, so
  // two siblings can share a key. A dedicated counter keeps every emitted key
  // unique.
  let key = 0;

  function parseInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    // Regex: code span, bold, italic, link
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let keyIdx = 0;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith('`')) {
        parts.push(
          <code
            key={keyIdx++}
            className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
          >
            {tok.slice(1, -1)}
          </code>,
        );
      } else if (tok.startsWith('**')) {
        parts.push(<strong key={keyIdx++}>{tok.slice(2, -2)}</strong>);
      } else if (tok.startsWith('*')) {
        parts.push(<em key={keyIdx++}>{tok.slice(1, -1)}</em>);
      } else if (tok.startsWith('[')) {
        const textEnd = tok.indexOf(']');
        const href = tok.slice(textEnd + 2, -1);
        // Scheme guard: only emit safe href schemes; otherwise drop the href
        // (still render the link text) so a `javascript:`/`data:` URL is inert.
        const safe = /^(https?:|mailto:|#|\/)/i.test(href) ? href : undefined;
        parts.push(
          <a
            key={keyIdx++}
            href={safe}
            target="_blank"
            rel="noreferrer"
            className="underline text-primary"
          >
            {tok.slice(1, textEnd)}
          </a>,
        );
      }
      last = m.index + tok.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const hMatch = /^(#{1,3})\s+(.+)/.exec(line);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2];

      // Optional section → collapsed <details>. The body is everything up to
      // the next h1/h2 (h3s stay inside), rendered by a recursive call. The
      // recursion terminates because the body can never contain an h1/h2, so
      // it cannot re-enter this branch.
      if (level === 2 && OPTIONAL_HEADING_RE.test(text)) {
        i++;
        const body: string[] = [];
        // Fence-aware: a `# comment` line inside a code block is content, not
        // the next heading, so it must not end the section early.
        let inFence = false;
        while (i < lines.length && (inFence || !/^#{1,2}\s/.test(lines[i]))) {
          if (lines[i].startsWith('```')) inFence = !inFence;
          body.push(lines[i]);
          i++;
        }
        nodes.push(
          <details key={key++} className="my-4 rounded-md border border-border/60">
            <summary className="cursor-pointer select-none px-3 py-2">
              {/* An inline <h2> keeps the document outline (screen-reader
                  heading navigation) intact while sitting on the marker line. */}
              <h2 className="inline text-lg font-semibold">{parseInline(text)}</h2>
            </summary>
            <div className="border-t border-border/60 px-3 pb-2">
              {renderMarkdown(body.join('\n'))}
            </div>
          </details>,
        );
        continue;
      }

      const cls =
        level === 1
          ? 'text-2xl font-bold tracking-tight mb-4 first:mt-0'
          : level === 2
            ? 'text-lg font-semibold mt-8 mb-2 pb-1.5 border-b border-border'
            : 'text-base font-semibold mt-5 mb-1.5';
      nodes.push(
        React.createElement(`h${level}` as 'h1', { key: key++, className: cls }, parseInline(text)),
      );
      i++;
      continue;
    }

    // Code fence
    if (line.startsWith('```')) {
      const fenceLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        fenceLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={key++} className="rounded bg-muted p-3 text-sm overflow-auto my-2">
          <code>{fenceLines.join('\n')}</code>
        </pre>,
      );
      i++;
      continue;
    }

    // Unordered list block
    if (/^[*-]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[*-]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[*-]\s/, ''));
        i++;
      }
      nodes.push(
        <ul key={key++} className="list-disc pl-6 space-y-1.5 my-3 leading-relaxed">
          {items.map((it, idx) => (
            <li key={idx}>{parseInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list block
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      nodes.push(
        <ol key={key++} className="list-decimal pl-6 space-y-1.5 my-3 leading-relaxed">
          {items.map((it, idx) => (
            <li key={idx}>{parseInline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — always consume the current line first (it matched no block
    // branch above), so `i` advances even when the line starts with a block-marker
    // char but is not a valid block (e.g. "**bold**", "#nospace", "-dashnospace").
    // Without this, such a line would never match the accumulation guard below and
    // the outer loop would spin forever.
    const paraLines: string[] = [lines[i]];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^[#`*-]/.test(lines[i]) &&
      !/^\d+\./.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    nodes.push(
      <p key={key++} className="my-3 leading-7 text-foreground/90">
        {parseInline(paraLines.join(' '))}
      </p>,
    );
  }

  return nodes;
}
