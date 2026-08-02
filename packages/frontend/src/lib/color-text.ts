/**
 * Core color-text parsing and manipulation utilities.
 * Pure functions — no DOM dependencies, fully testable.
 */
import { type TagKind, parseStyleTree } from './style-tags';

export interface Segment {
  text: string;
  color: string | null;
}

/**
 * Parse a tagged string like `<color=#FF0000>hello</color> world`
 * into an array of segments. Literal `\n` sequences are converted to real newlines.
 */
export function parseSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  const tagRegex = /<color=([^>]+)>([\s\S]*?)<\/color>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: input.substring(lastIndex, match.index),
        color: null,
      });
    }
    segments.push({ text: match[2], color: match[1] });
    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.substring(lastIndex), color: null });
  }

  return segments;
}

/**
 * Convert literal `\n` sequences in text to real newline characters.
 */
export function expandEscapes(input: string): string {
  return input.replace(/\\n/g, '\n');
}

/**
 * Check if the selected text is exactly a single complete `<color=...>...</color>` block.
 * Returns the match details or null.
 */
export function matchExactColorBlock(selected: string): { color: string; inner: string } | null {
  const m = selected.match(/^<color=([^>]+)>([\s\S]*)<\/color>$/i);
  if (!m) return null;
  // Make sure there's only one opening tag and one closing tag (no nested blocks)
  const openCount = (selected.match(/<color=[^>]+>/gi) || []).length;
  const closeCount = (selected.match(/<\/color>/gi) || []).length;
  if (openCount !== 1 || closeCount !== 1) return null;
  return { color: m[1], inner: m[2] };
}

/**
 * Replace the color of an exact color block selection.
 * Returns the new full string and cursor position.
 */
export function replaceBlockColor(
  value: string,
  start: number,
  end: number,
  newColor: string,
): { result: string; cursor: number } {
  const selected = value.substring(start, end);
  const block = matchExactColorBlock(selected);
  if (!block) {
    // Fallback to wrapping
    return wrapColor(value, start, end, newColor);
  }
  const newTag = `<color=${newColor}>${block.inner}</color>`;
  const result = value.substring(0, start) + newTag + value.substring(end);
  return { result, cursor: start + newTag.length };
}

/**
 * Wrap a portion of `value` (from `start` to `end`) in a `<color=...>` tag.
 * Returns the new full string and the cursor position after the tag.
 */
export function wrapColor(
  value: string,
  start: number,
  end: number,
  color: string,
): { result: string; cursor: number } {
  const selected = value.substring(start, end);
  const tag = `<color=${color}>${selected}</color>`;
  const result = value.substring(0, start) + tag + value.substring(end);
  return { result, cursor: start + tag.length };
}

/**
 * Strip all `<color=...>` and `</color>` tags from a string.
 */
export function stripColorTags(input: string): string {
  return input.replace(/<color=[^>]*>/gi, '').replace(/<\/color>/gi, '');
}

/**
 * Remove color tags only within a selected range of the full string.
 * Returns the new full string and the new selection end.
 */
export function removeColorInRange(
  value: string,
  start: number,
  end: number,
): { result: string; selectionEnd: number } {
  const selected = value.substring(start, end);
  const stripped = stripColorTags(selected);
  const result = value.substring(0, start) + stripped + value.substring(end);
  return { result, selectionEnd: start + stripped.length };
}

/**
 * Find a color block that directly encloses the selection [start, end].
 * Returns the full extent of that block and its inner text, or null if none.
 *
 * Example: value = `<color=#F00>hello</color>`, start=12, end=17 ("hello")
 * → { blockStart: 0, blockEnd: 27, inner: "hello" }
 */
export function findEnclosingColorBlock(
  value: string,
  start: number,
  end: number,
): { blockStart: number; blockEnd: number; inner: string } | null {
  const before = value.substring(0, start);
  // Find the last opening tag before the selection start
  const openTagRegex = /<color=[^>]+>/gi;
  let lastOpenMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = openTagRegex.exec(before)) !== null) {
    lastOpenMatch = m;
  }
  if (!lastOpenMatch) return null;

  const openTagEnd = lastOpenMatch.index + lastOpenMatch[0].length; // position just after >

  // Verify there's no </color> between the opening tag end and our selection start
  const betweenOpenAndSel = value.substring(openTagEnd, start);
  if (/<\/color>/i.test(betweenOpenAndSel)) return null;

  // Verify the selection ends exactly at a </color>
  const closeTag = '</color>';
  const after = value.substring(end);
  if (!after.toLowerCase().startsWith(closeTag)) return null;

  const blockStart = lastOpenMatch.index;
  const blockEnd = end + closeTag.length;
  const inner = value.substring(openTagEnd, end);

  return { blockStart, blockEnd, inner };
}

/**
 * Count how many opening and closing color tags are in a string.
 * Returns { open, close }. Balanced means open === close.
 */
export function countColorTags(input: string): { open: number; close: number } {
  const open = (input.match(/<color=[^>]+>/gi) || []).length;
  const close = (input.match(/<\/color>/gi) || []).length;
  return { open, close };
}

/**
 * Apply a color to a selection within `value`, respecting tag structure.
 *
 * - If the selection is exactly one complete block → replace color.
 * - If the selection has unbalanced tags → returns { error: 'unbalanced' }.
 * - If the selection has balanced inner tags → strips them, then wraps.
 * - Otherwise → wraps the selection.
 */
export function applyColorToSelection(
  value: string,
  start: number,
  end: number,
  color: string,
): { result: string; cursor: number } | { error: 'unbalanced' } {
  const selected = value.substring(start, end);

  // Case 1: exact single block → replace color only
  const block = matchExactColorBlock(selected);
  if (block) {
    const newTag = `<color=${color}>${block.inner}</color>`;
    return {
      result: value.substring(0, start) + newTag + value.substring(end),
      cursor: start + newTag.length,
    };
  }

  // Case 2: mismatched tag counts → refuse
  const { open, close } = countColorTags(selected);
  if (open !== close) {
    return { error: 'unbalanced' };
  }

  // Case 3: balanced inner tags → strip then wrap
  const inner = open > 0 ? stripColorTags(selected) : selected;
  const tag = `<color=${color}>${inner}</color>`;
  return {
    result: value.substring(0, start) + tag + value.substring(end),
    cursor: start + tag.length,
  };
}

/**
 * Merge two adjacent `<color=X>` blocks with the same color into one,
 * folding the separating text into the merged block — as long as that
 * separator contains no letter (in any script). Whitespace, punctuation,
 * digits, symbols, and literal `\n` escapes are treated as formatting and
 * may be absorbed; a separator holding even one real letter is content, not
 * formatting, so those blocks are left alone. Repeats until no more merges
 * are possible, so a chain of 3+ blocks collapses fully in one call.
 *
 * Examples:
 *   `<color=#F00>a</color>, <color=#F00>b</color>` → `<color=#F00>a, b</color>`
 *   `<color=#F00>a</color> text <color=#F00>b</color>` → unchanged ("text" has letters)
 *   `<color=#F00>a</color>\n<color=#F00>b</color>` → `<color=#F00>a\nb</color>` (still supported)
 */
export function mergeConsecutiveColorTags(input: string): string {
  let prev: string;
  do {
    prev = input;
    // Use (?:[^<]|<(?!\/color>))* so inner content cannot cross </color> tokens.
    // The separator alternation matches a literal `\n` escape as one unit
    // (so its letter 'n' doesn't trip the no-letter rule) or any other
    // non-letter, non-'<' character.
    input = input.replace(
      /<color=([^>]+)>((?:[^<]|<(?!\/color>))*)<\/color>((?:\\n|[^\p{L}<])*)<color=\1>((?:[^<]|<(?!\/color>))*)<\/color>/giu,
      '<color=$1>$2$3$4</color>',
    );
  } while (input !== prev);
  return input;
}

/**
 * True when `value` is a #-prefixed 3-, 6-, or 8-digit hex color
 * (the three forms the `<color=…>` tag syntax accepts).
 */
export function isValidHexColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}

/**
 * Wrap a portion of `value` (from `start` to `end`) in the tag for `kind`.
 * `tagValue` supplies the `=...` payload for `color`/`size` tags.
 * Returns the new full string and the cursor position after the tag.
 */
export function wrapTag(
  value: string,
  start: number,
  end: number,
  kind: TagKind,
  tagValue?: string,
): { result: string; cursor: number } {
  const selected = value.substring(start, end);
  const open =
    kind === 'bold'
      ? '<b>'
      : kind === 'italic'
        ? '<i>'
        : kind === 'color'
          ? `<color=${tagValue}>`
          : `<size=${tagValue}>`;
  const close =
    kind === 'bold'
      ? '</b>'
      : kind === 'italic'
        ? '</i>'
        : kind === 'color'
          ? '</color>'
          : '</size>';
  const tag = `${open}${selected}${close}`;
  return {
    result: value.substring(0, start) + tag + value.substring(end),
    cursor: start + tag.length,
  };
}

/** Strip every style tag, preserving only text content. */
export function stripAllTags(input: string): string {
  const flatten = (nodes: ReturnType<typeof parseStyleTree>): string =>
    nodes.map((n) => (typeof n === 'string' ? n : flatten(n.children))).join('');
  return flatten(parseStyleTree(input));
}
