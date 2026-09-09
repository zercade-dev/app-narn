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

/** Matches one opening tag; sticky, so `lastIndex` picks the position to test. */
const OPEN_RE = /<(color=([^>]+)|size=([^>]+)|b|i)>/iy;

const TAG_KINDS: readonly TagKind[] = ['color', 'bold', 'italic', 'size'];
const KIND_INDEX: Record<TagKind, number> = { color: 0, bold: 1, italic: 2, size: 3 };

interface OpenTag {
  kind: TagKind;
  value?: string;
  raw: string;
}

function matchOpenAt(input: string, i: number): OpenTag | null {
  OPEN_RE.lastIndex = i;
  const m = OPEN_RE.exec(input);
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

const CLOSE_TAGS: readonly string[] = TAG_KINDS.map(closeTagFor);

/**
 * For every position in `input` and every tag kind, the index just past the close
 * tag that ends a scan started there, or -1 when that scan reaches the end of the
 * input without one. Filled right to left, so each entry only reads entries
 * further along and a balanced nested tag is skipped whole, exactly as a scan
 * skips it.
 */
function buildCloseTable(input: string): Int32Array {
  const width = TAG_KINDS.length;
  const table = new Int32Array((input.length + 1) * width).fill(-1);
  for (let i = input.length - 1; i >= 0; i -= 1) {
    let skipTo = -1;
    if (input[i] === '<') {
      const open = matchOpenAt(input, i);
      if (open) {
        const inner = table[(i + open.raw.length) * width + KIND_INDEX[open.kind]];
        if (inner >= 0) skipTo = inner;
      }
    }
    const next = (skipTo >= 0 ? skipTo : i + 1) * width;
    for (let k = 0; k < width; k += 1) {
      table[i * width + k] = input.startsWith(CLOSE_TAGS[k], i)
        ? i + CLOSE_TAGS[k].length
        : table[next + k];
    }
  }
  return table;
}

interface Frame {
  kind: TagKind | null;
  value?: string;
  out: Node[];
  textStart: number;
}

/**
 * Parse `input` into a node tree. Text between/around tags becomes string
 * nodes. A tag whose matching close is missing is emitted as literal text.
 *
 * The close table settles balancedness before the walk starts, so an opener is
 * pushed only when its close is reachable and the walk never revisits a position.
 */
export function parseStyleTree(input: string): Node[] {
  const width = TAG_KINDS.length;
  const table = buildCloseTable(input);
  const root: Node[] = [];
  const stack: Frame[] = [{ kind: null, out: root, textStart: 0 }];
  const flush = (frame: Frame, end: number) => {
    if (end > frame.textStart) frame.out.push(input.slice(frame.textStart, end));
  };
  let i = 0;
  while (i < input.length) {
    const top = stack[stack.length - 1];
    if (top.kind !== null) {
      const close = CLOSE_TAGS[KIND_INDEX[top.kind]];
      if (input.startsWith(close, i)) {
        flush(top, i);
        stack.pop();
        i += close.length;
        const parent = stack[stack.length - 1];
        parent.out.push({
          kind: top.kind,
          ...(top.value !== undefined ? { value: top.value } : {}),
          children: top.out,
        });
        parent.textStart = i;
        continue;
      }
    }
    if (input[i] === '<') {
      const open = matchOpenAt(input, i);
      if (open) {
        const contentStart = i + open.raw.length;
        if (table[contentStart * width + KIND_INDEX[open.kind]] >= 0) {
          flush(top, i);
          stack.push({ kind: open.kind, value: open.value, out: [], textStart: contentStart });
          i = contentStart;
          continue;
        }
      }
    }
    i += 1;
  }
  flush(stack[stack.length - 1], input.length);
  return root;
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
