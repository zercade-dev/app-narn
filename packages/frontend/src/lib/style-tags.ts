/**
 * Recursive model + parser/serializer for the game-markup tags the Text Styler
 * tab supports: <color=#HEX>, <b>, <i>, <size=N>. Unlike the old flat color
 * parser, these nest arbitrarily. Malformed/unbalanced input degrades to
 * literal text rather than throwing.
 */
import type { CSSProperties } from 'react';

export type TagKind = 'color' | 'bold' | 'italic' | 'size';

export interface StyleNode {
  kind: TagKind;
  /** #HEX for color, integer string for size; absent for bold/italic. */
  value?: string;
  children: Node[];
}

export type Node = string | StyleNode;

const SIZE_MIN = 8;
const SIZE_MAX = 200;
const SIZE_DEFAULT = 24;

/** Matches one opening tag at position 0 of the remaining input. */
const OPEN_RE = /^<(color=([^>]+)|size=([^>]+)|b|i)>/i;

interface OpenTag {
  kind: TagKind;
  value?: string;
  raw: string;
}

function matchOpen(s: string): OpenTag | null {
  const m = OPEN_RE.exec(s);
  if (!m) return null;
  const body = m[1].toLowerCase();
  if (body === 'b') return { kind: 'bold', raw: m[0] };
  if (body === 'i') return { kind: 'italic', raw: m[0] };
  if (m[2] !== undefined) return { kind: 'color', value: m[2], raw: m[0] };
  return { kind: 'size', value: m[3], raw: m[0] };
}

function closeTagFor(kind: TagKind): string {
  return kind === 'bold'
    ? '</b>'
    : kind === 'italic'
      ? '</i>'
      : kind === 'color'
        ? '</color>'
        : '</size>';
}

/**
 * Parse `input` into a node tree. Text between/around tags becomes string
 * nodes. A tag whose matching close is missing is emitted as literal text.
 */
export function parseStyleTree(input: string): Node[] {
  const [nodes] = parseChildren(input, 0, null);
  return nodes;
}

/**
 * Single-pass recursive descent. Parses children starting at `i` until either
 * end-of-input (closeKind === null) or the close tag for `closeKind` is reached.
 * Returns [nodes, nextIndex, closed]. `closed` is true exactly when the recursion
 * terminated by matching and consuming the close tag for `closeKind` (as opposed
 * to running off the end of input) — the caller uses this to decide whether an
 * opener is balanced, rather than re-deriving it from the returned index.
 */
function parseChildren(
  input: string,
  i: number,
  closeKind: TagKind | null,
): [Node[], number, boolean] {
  const out: Node[] = [];
  let text = '';
  const flush = () => {
    if (text) {
      out.push(text);
      text = '';
    }
  };
  while (i < input.length) {
    if (closeKind && input.startsWith(closeTagFor(closeKind), i)) {
      flush();
      return [out, i + closeTagFor(closeKind).length, true];
    }
    if (input[i] === '<') {
      const open = matchOpen(input.slice(i));
      if (open) {
        const contentStart = i + open.raw.length;
        const [children, end, closed] = parseChildren(input, contentStart, open.kind);
        if (closed) {
          flush();
          out.push({
            kind: open.kind,
            ...(open.value !== undefined ? { value: open.value } : {}),
            children,
          });
          i = end;
          continue;
        }
        // Unbalanced: the opener is literal. Fall through to emit '<' as text.
      }
    }
    text += input[i];
    i += 1;
  }
  flush();
  return [out, i, false];
}

export function serializeStyleTree(nodes: Node[]): string {
  return nodes
    .map((n) => {
      if (typeof n === 'string') return n;
      const open =
        n.kind === 'bold'
          ? '<b>'
          : n.kind === 'italic'
            ? '<i>'
            : n.kind === 'color'
              ? `<color=${n.value}>`
              : `<size=${n.value}>`;
      return `${open}${serializeStyleTree(n.children)}${closeTagFor(n.kind)}`;
    })
    .join('');
}

export function clampSizePx(raw: string | number): number {
  const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
  if (Number.isNaN(n)) return SIZE_DEFAULT;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, n));
}

/** Maps a single StyleNode to the inline CSS it represents (non-recursive). */
export function styleForNode(node: StyleNode): CSSProperties {
  switch (node.kind) {
    case 'color':
      return { color: node.value };
    case 'bold':
      return { fontWeight: 'bold' };
    case 'italic':
      return { fontStyle: 'italic' };
    case 'size':
      return { fontSize: `${clampSizePx(node.value ?? '')}px` };
  }
}
