/**
 * DOM round-trip helpers for the Color Text rich editor.
 * The raw tagged string is always the source of truth: the rich
 * contenteditable renders FROM it (rawToRichDOM) and serializes BACK to it
 * (richToRaw) on every input. Style tags nest arbitrarily:
 * `<color=#HEX>` → `<span data-color style="color:…">`,
 * `<size=N>` → `<span data-size="N" style="font-size:…px">`,
 * `<b>` → `<strong>`, `<i>` → `<em>`; literal `\n` sequences become `<br>`
 * and vice versa.
 */
import { expandEscapes } from '../../lib/color-text.js';
import { type Node as StyleTreeNode, clampSizePx, parseStyleTree } from '../../lib/style-tags.js';

/** Appends the DOM for a text run, splitting literal `\n` escapes into <br>s. */
function appendTextRun(text: string, parent: globalThis.Node): void {
  const lines = expandEscapes(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) parent.appendChild(document.createTextNode(lines[i]));
    if (i < lines.length - 1) parent.appendChild(document.createElement('br'));
  }
}

/** Creates the wrapper element for a style-tree node (without its children). */
function elementForStyleNode(node: Exclude<StyleTreeNode, string>): HTMLElement {
  switch (node.kind) {
    case 'color': {
      const span = document.createElement('span');
      span.dataset.color = node.value;
      span.style.color = node.value ?? '';
      return span;
    }
    case 'size': {
      const span = document.createElement('span');
      span.dataset.size = node.value;
      span.style.fontSize = `${clampSizePx(node.value ?? '')}px`;
      return span;
    }
    case 'bold':
      return document.createElement('strong');
    case 'italic':
      return document.createElement('em');
  }
}

/** Recursively builds DOM for a list of style-tree nodes under `parent`. */
function buildStyleNodes(nodes: StyleTreeNode[], parent: globalThis.Node): void {
  for (const node of nodes) {
    if (typeof node === 'string') {
      appendTextRun(node, parent);
    } else {
      const el = elementForStyleNode(node);
      buildStyleNodes(node.children, el);
      parent.appendChild(el);
    }
  }
}

/** Populates `container` with DOM nodes representing the raw tagged value. */
export function rawToRichDOM(value: string, container: HTMLElement): void {
  container.innerHTML = '';
  buildStyleNodes(parseStyleTree(value), container);
  // Content ending in a line break needs the explicit caret placeholder so
  // Chromium lets the user type on the empty last line (richRootToRaw
  // ignores a root-trailing <br> to compensate).
  if (container.lastChild?.nodeName === 'BR') {
    container.appendChild(document.createElement('br'));
  }
}

/**
 * The raw open/close tag pair a style element serializes to, or null when the
 * node carries no style tag (text, <br>, plain wrappers). Shared by richToRaw
 * and richOffsetOf so their traversals stay in lock-step.
 */
function rawTagsFor(node: Node): { open: string; close: string } | null {
  if (!(node instanceof HTMLElement)) return null;
  switch (node.nodeName) {
    case 'SPAN':
      if (node.dataset.color) return { open: `<color=${node.dataset.color}>`, close: '</color>' };
      if (node.dataset.size) return { open: `<size=${node.dataset.size}>`, close: '</size>' };
      return null;
    case 'STRONG':
    case 'B':
      return { open: '<b>', close: '</b>' };
    case 'EM':
    case 'I':
      return { open: '<i>', close: '</i>' };
    default:
      return null;
  }
}

/** Serializes the rich editor's DOM back to the raw tagged string. */
export function richToRaw(container: Node): string {
  let result = '';
  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeName === 'BR') {
      result += '\\n';
    } else if (node.nodeName === 'DIV') {
      // Some browsers create DIV wrappers for newlines inside contenteditable.
      result += '\\n' + richToRaw(node);
    } else {
      const tags = rawTagsFor(node);
      result += tags ? `${tags.open}${richToRaw(node)}${tags.close}` : richToRaw(node);
    }
  }
  return result;
}

/**
 * Serializes the rich editor root, treating a root-trailing <br> as the
 * caret placeholder (see the Enter handler / rawToRichDOM), not content.
 */
export function richRootToRaw(root: Node): string {
  const raw = richToRaw(root);
  return root.lastChild?.nodeName === 'BR' && raw.endsWith('\\n') ? raw.slice(0, -2) : raw;
}

/** True when nothing with content (text or <br>) follows `node` inside `root`. */
export function isAtContentEnd(node: Node, root: Node): boolean {
  let n: Node | null = node;
  while (n && n !== root) {
    for (let s = n.nextSibling; s; s = s.nextSibling) {
      if (s.nodeName === 'BR') return false;
      if (s.textContent && s.textContent.length > 0) return false;
    }
    n = n.parentNode;
  }
  return true;
}

/**
 * Maps a DOM selection boundary inside the rich editor to its index in the
 * richToRaw() serialization of `root`. Mirrors richToRaw's traversal exactly:
 * text → its length, <br> → 2 (literal \n), style elements (color/size spans,
 * <strong>/<em>) → opening tag + children + closing tag, DIV → 2 + children,
 * other elements → children.
 */
export function richOffsetOf(root: Node, container: Node, offset: number): number {
  let pos = 0;
  let found = false;

  const visit = (node: Node): void => {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      if (node === container) {
        pos += offset;
        found = true;
      } else {
        pos += (node.textContent ?? '').length;
      }
      return;
    }
    if (node.nodeName === 'BR') {
      // The root-trailing <br> is the caret placeholder richRootToRaw skips.
      pos += node === root.lastChild ? 0 : 2;
      return;
    }
    const tags = rawTagsFor(node);
    if (tags) pos += tags.open.length;
    if (node.nodeName === 'DIV' && node !== root) pos += 2;
    const children = [...node.childNodes];
    for (let i = 0; i < children.length; i++) {
      if (node === container && i === offset) {
        found = true;
        return;
      }
      visit(children[i]);
      if (found) return;
    }
    if (node === container && offset >= children.length) {
      found = true;
      return;
    }
    if (tags) pos += tags.close.length;
  };

  visit(root);
  return pos;
}

/** Recursively unwraps color spans, keeping text nodes and <br>s intact. */
export function unwrapColorSpans(node: Node): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const child of [...node.childNodes]) {
    if (child instanceof HTMLElement && child.nodeName === 'SPAN' && child.dataset.color) {
      frag.appendChild(unwrapColorSpans(child));
    } else {
      frag.appendChild(child.cloneNode(true));
    }
  }
  return frag;
}
