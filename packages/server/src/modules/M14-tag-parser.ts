/**
 * M14 — TagParser
 *
 * Pure recursive-descent parser for inline tags used by game strings.
 * Supports `<color=...>...</color>`, `<size=...>...</size>`, `<b>...</b>`,
 * `<i>...</i>`, `[placeholder]`, `\n` escapes, and plain text. Unclosed tags
 * become `{ type: 'error' }` nodes — the parser never throws.
 */
import type { TagNode } from '@zercade-dev/narn-shared';

/** Tags carrying a required `=value` attribute: `<color=#fff>`, `<size=20>`. */
const NAMED_TAGS = new Set(['color', 'size']);

/**
 * Attribute-less ("boolean") tags: `<b>`, `<i>`. Together with NAMED_TAGS these
 * are exactly the four tags the Text Styler's toolbar and system prompt offer
 * (see services/color-text-chat.ts). Parsing them as real `tag` nodes is what
 * puts them under the blocking "Inline tag equality" LQA check — while they
 * fell through to plain text, a translation that dropped or duplicated a
 * `<b>`/`<i>` pair compared equal to its source and the gate was a no-op for
 * them. It also brings them under M17 masking, which already restores an
 * attribute-less slot as `<name>` rather than `<name=>`.
 */
const BOOLEAN_TAGS = new Set(['b', 'i']);

// Recursion-depth cap for `parseNodes`. The parser recurses once per nesting
// level, so a pathologically-nested source (thousands of unclosed openers)
// would overflow the call stack and throw `RangeError` — violating the
// "never throws" contract and silently no-op'ing the blocking tag-equality
// LQA gate (the gate swallows the throw and continues). Past the cap we stop
// recursing and emit the opener as an `error` node (the same fallback used for
// unclosed openers), so parsing stays linear, never throws, and `tagsEqual`
// remains deterministic. Real game strings nest only a handful of levels.
const MAX_TAG_DEPTH = 200;

interface ParserState {
  src: string;
  pos: number;
}

function peek(state: ParserState, offset = 0): string {
  return state.src[state.pos + offset] ?? '';
}

function startsWith(state: ParserState, text: string): boolean {
  return state.src.startsWith(text, state.pos);
}

function readUntil(state: ParserState, stopChars: string[]): string {
  const start = state.pos;
  while (state.pos < state.src.length) {
    const c = state.src[state.pos];
    if (c === undefined) break;
    if (stopChars.includes(c)) break;
    state.pos++;
  }
  return state.src.slice(start, state.pos);
}

/**
 * `raw` is the opener exactly as written (`<color=red>`, `<b>`). Callers use it
 * for the `error`-node fallback so an unclosed opener round-trips byte-for-byte
 * — a `<${name}=${attribute}>` template would emit `<b=>` for a boolean tag.
 */
interface OpeningTag {
  name: string;
  attribute: string;
  raw: string;
}

function tryParseOpeningTag(state: ParserState): OpeningTag | null {
  // Expects state.pos at '<'
  if (peek(state) !== '<') return null;
  const save = state.pos;
  state.pos++; // consume '<'
  const name = readUntil(state, ['=', '>', '<', '/']);
  // Boolean tags close immediately after the name; anything else (including the
  // `/` of a void tag like `<br/>`) leaves them unrecognized, as before.
  if (peek(state) === '>' && BOOLEAN_TAGS.has(name)) {
    state.pos++; // consume '>'
    return { name, attribute: '', raw: state.src.slice(save, state.pos) };
  }
  if (peek(state) !== '=' || !NAMED_TAGS.has(name)) {
    state.pos = save;
    return null;
  }
  state.pos++; // consume '='
  const attribute = readUntil(state, ['>', '<']);
  if (peek(state) !== '>') {
    state.pos = save;
    return null;
  }
  state.pos++; // consume '>'
  return { name, attribute, raw: state.src.slice(save, state.pos) };
}

function tryParseClosingTag(state: ParserState): string | null {
  if (!startsWith(state, '</')) return null;
  const save = state.pos;
  state.pos += 2;
  const name = readUntil(state, ['>', '<']);
  if (peek(state) !== '>') {
    state.pos = save;
    return null;
  }
  state.pos++;
  return name;
}

function parseNodes(
  state: ParserState,
  expectedClose: string | null,
  depth = 0,
): { nodes: TagNode[]; closed: boolean } {
  const nodes: TagNode[] = [];
  let textBuf = '';

  const flushText = (): void => {
    if (textBuf.length > 0) {
      nodes.push({ type: 'text', content: textBuf });
      textBuf = '';
    }
  };

  while (state.pos < state.src.length) {
    // Escaped newline — preserve literal \n so the masker round-trips it faithfully
    // to the translation backend; RichRenderer normalises it to <br/> when rendering.
    if (startsWith(state, '\\n')) {
      textBuf += '\\n';
      state.pos += 2;
      continue;
    }

    const ch = peek(state);

    if (ch === '<') {
      // Closing tag? `tryParseClosingTag` leaves `state.pos` unchanged when it
      // returns null, so no save/restore is needed around it here.
      if (startsWith(state, '</')) {
        const closeName = tryParseClosingTag(state);
        if (closeName !== null) {
          if (closeName === expectedClose) {
            flushText();
            return { nodes, closed: true };
          }
          // Mismatched close — emit error node and continue
          flushText();
          nodes.push({ type: 'error', content: `</${closeName}>` });
          continue;
        }
        // Could not parse — treat '<' as text
        textBuf += ch;
        state.pos++;
        continue;
      }

      // `tryParseOpeningTag` likewise self-restores `state.pos` on its failure
      // path, so the opener branch needs no outer save/restore either.
      const open = tryParseOpeningTag(state);
      if (open) {
        flushText();
        if (depth >= MAX_TAG_DEPTH) {
          // Too deep to recurse safely: emit the opener verbatim as an error
          // node (matching the unclosed-opener fallback) and keep scanning the
          // remaining input flat. Guarantees the parser never overflows the
          // stack / throws on adversarially-nested tags.
          nodes.push({ type: 'error', content: open.raw });
          continue;
        }
        const inner = parseNodes(state, open.name, depth + 1);
        if (!inner.closed) {
          nodes.push({ type: 'error', content: open.raw });
          nodes.push(...inner.nodes);
        } else {
          nodes.push({
            type: 'tag',
            content: open.name,
            attributes: { [open.name]: open.attribute },
            children: inner.nodes,
          });
        }
        continue;
      }
      // Not a recognized tag — treat as text
      textBuf += ch;
      state.pos++;
      continue;
    }

    textBuf += ch;
    state.pos++;
  }

  flushText();
  return { nodes, closed: expectedClose === null };
}

export function parse(rawString: string): TagNode[] {
  return parseNodes({ src: rawString, pos: 0 }, null).nodes;
}

/**
 * Returns a multiset signature of tag names with attribute values (sorted).
 *
 * `error` nodes — unmatched closing tags and unclosed openers (see the parser)
 * — are included verbatim in the signature. Without them a translation that
 * injects a spurious `</color>`/`</b>` (parsed as an error node, never a
 * `tag`) would compare equal to a source that has no such tag, slipping past
 * the blocking tag-equality gate.
 *
 * Attribute-less tags signature as `b=`/`i=` (empty attribute), which is enough
 * to tell them apart from each other and from the named tags.
 */
function tagSignature(nodes: TagNode[]): string[] {
  const sig: string[] = [];
  const walk = (ns: TagNode[]): void => {
    for (const node of ns) {
      if (node.type === 'tag') {
        const attr = node.attributes?.[node.content] ?? '';
        sig.push(`${node.content}=${attr}`);
      } else if (node.type === 'error') {
        sig.push(`error:${node.content}`);
      }
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return sig.sort();
}

export function tagsEqual(source: string, translation: string): boolean {
  const a = tagSignature(parse(source));
  const b = tagSignature(parse(translation));
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
