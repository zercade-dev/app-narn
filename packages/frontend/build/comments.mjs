// Parser-based comment detection + stripping for shipped static assets.
//
// WHY parsers, never regex: `//`, `/*`, and `<!--` legitimately appear inside
// string and attribute values, not only in comments — index.html's CSP `<meta>`
// carries `connect-src 'self' http://localhost:3001`, and the bundled JS carries
// `https://…` link targets as string literals. A regex would corrupt those or
// miss/over-report. Every kind goes through a real parser:
//   - HTML -> parse5 (locates comment nodes + inline <script>/<style> spans)
//   - JS   -> acorn  (onComment yields exact comment offsets)
//   - CSS  -> postcss (walkComments)
//
// The model is OFFSET SPANS: each function ultimately produces `{start,end}`
// byte offsets of comment runs within `source`. `stripComments` splices those
// spans out (descending, so earlier offsets stay valid), leaving every other
// byte — the CSP `<meta>` content, `nonce="…"` attributes, the inline
// theme-bootstrap script, whitespace — untouched. `findComments` maps the same
// spans to line/col for the guard's error output. No re-serialization, no
// minification.

import { parse } from 'parse5';
import * as acorn from 'acorn';
import postcss from 'postcss';

/** Script `type=` values whose body is data, not JS (no JS comments to find). */
const NON_JS_SCRIPT_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'importmap',
  'speculationrules',
]);

/** Map a 0-based byte offset to 1-based {line, col} within `text`. */
function offsetToLineCol(text, offset) {
  let line = 1;
  let col = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

/** Map a 1-based (line, col) — postcss position — to a 0-based byte offset. */
function lineColToOffset(text, line, col) {
  let curLine = 1;
  let i = 0;
  while (curLine < line && i < text.length) {
    if (text[i] === '\n') curLine++;
    i++;
  }
  return i + (col - 1);
}

/** Comment spans within standalone JavaScript. Throws if the JS won't parse. */
function jsCommentSpans(code) {
  for (const sourceType of ['module', 'script']) {
    const spans = [];
    try {
      acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType,
        allowHashBang: true,
        allowReturnOutsideFunction: sourceType === 'script',
        onComment: (_block, _text, start, end) => spans.push({ start, end }),
      });
      return spans;
    } catch (err) {
      if (sourceType === 'script') {
        throw new Error(`JavaScript parse failed: ${err.message}`);
      }
      // else: retry as a classic script
    }
  }
  return [];
}

/** Comment spans within standalone CSS. Throws if the CSS won't parse. */
function cssCommentSpans(code) {
  const spans = [];
  let root;
  try {
    root = postcss.parse(code);
  } catch (err) {
    throw new Error(`CSS parse failed: ${err.message}`);
  }
  root.walkComments((node) => {
    const s = node.source?.start;
    const e = node.source?.end;
    if (!s || !e) return;
    const start = lineColToOffset(code, s.line, s.column);
    // postcss `end` points AT the last char of the comment (the closing `/`);
    // +1 makes the span end-exclusive like the others.
    const end = lineColToOffset(code, e.line, e.column) + 1;
    spans.push({ start, end });
  });
  return spans;
}

/**
 * Comment spans within an HTML document: HTML comment nodes, plus comments
 * inside every inline <style> (CSS) and inline <script> (JS) body. Offsets are
 * absolute within `html`.
 */
function htmlCommentSpans(html) {
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const spans = [];

  const walk = (node) => {
    const loc = node.sourceCodeLocation;
    if (node.nodeName === '#comment' && loc) {
      spans.push({ start: loc.startOffset, end: loc.endOffset });
    }
    const tag = node.tagName;
    if ((tag === 'style' || tag === 'script') && loc?.startTag && loc?.endTag) {
      const attrs = node.attrs ?? [];
      const hasSrc = attrs.some((a) => a.name === 'src');
      const type = (attrs.find((a) => a.name === 'type')?.value ?? '').toLowerCase();
      const start = loc.startTag.endOffset;
      const end = loc.endTag.startOffset;
      const inner = html.slice(start, end);
      if (tag === 'style') {
        for (const sp of cssCommentSpans(inner)) {
          spans.push({ start: start + sp.start, end: start + sp.end });
        }
      } else if (!hasSrc && !NON_JS_SCRIPT_TYPES.has(type)) {
        for (const sp of jsCommentSpans(inner)) {
          spans.push({ start: start + sp.start, end: start + sp.end });
        }
      }
    }
    for (const child of node.childNodes ?? []) walk(child);
  };

  walk(doc);
  return spans;
}

/** Dispatch to the parser for `kind` ∈ {html, css, js}; returns sorted spans. */
function commentSpans(source, kind) {
  let spans;
  if (kind === 'html') spans = htmlCommentSpans(source);
  else if (kind === 'css') spans = cssCommentSpans(source);
  else if (kind === 'js') spans = jsCommentSpans(source);
  else throw new Error(`Unknown kind: ${kind}`);
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Remove every comment from `source`, preserving all other bytes exactly.
 * @param {string} source
 * @param {'html'|'css'|'js'} kind
 * @returns {string}
 */
export function stripComments(source, kind) {
  const spans = commentSpans(source, kind);
  let out = source;
  // Splice descending so each removal leaves earlier offsets valid.
  for (let i = spans.length - 1; i >= 0; i--) {
    out = out.slice(0, spans[i].start) + out.slice(spans[i].end);
  }
  return out;
}

/**
 * Locate every comment in `source`.
 * @param {string} source
 * @param {'html'|'css'|'js'} kind
 * @returns {Array<{line:number, col:number, snippet:string}>}
 */
export function findComments(source, kind) {
  return commentSpans(source, kind).map(({ start, end }) => {
    const { line, col } = offsetToLineCol(source, start);
    const raw = source.slice(start, end).replace(/\s+/g, ' ').trim();
    const snippet = raw.length > 60 ? `${raw.slice(0, 57)}…` : raw;
    return { line, col, snippet };
  });
}

/** Pick the comment `kind` for a file path, or null if not a scannable asset. */
export function kindForPath(path) {
  if (/\.html?$/i.test(path)) return 'html';
  if (/\.css$/i.test(path)) return 'css';
  if (/\.m?js$/i.test(path)) return 'js';
  return null;
}
