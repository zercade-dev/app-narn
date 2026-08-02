import type { CSSProperties, ReactNode } from 'react';
import type React from 'react';
import type { TagNode } from '@zercade-dev/narn-shared';

interface RichRendererProps {
  nodes: TagNode[];
}

/** Strict CSS color literal pattern (named colors, #hex, rgb()/rgba(), hsl()/hsla()). */
const CSS_COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([0-9a-z.,%\s/]+\)|hsla?\([0-9a-z.,%\s/]+\))$/i;

export function isValidColor(value: string): boolean {
  return CSS_COLOR_RE.test(value.trim());
}

function isValidSize(value: string): boolean {
  return /^\d+(\.\d+)?(px|em|rem|%)?$/.test(value.trim());
}

function renderNodes(nodes: TagNode[], keyPrefix = ''): ReactNode {
  return nodes.map((node, i) => renderNode(node, `${keyPrefix}${i}`));
}

function renderNode(node: TagNode, key: string): ReactNode {
  if (node.type === 'text') {
    // Normalise literal \n escapes (game-engine line separators) and actual newlines
    // to <br/> elements so both forms render correctly in the UI.
    const segments = node.content.replace(/\\n/g, '\n').split('\n');
    return segments.flatMap((seg, idx) =>
      idx === 0
        ? [<span key={`${key}-t${idx}`}>{seg}</span>]
        : [<br key={`${key}-br${idx}`} />, <span key={`${key}-t${idx}`}>{seg}</span>],
    );
  }

  if (node.type === 'error') {
    return (
      <span
        key={key}
        className="underline decoration-status-fail decoration-wavy"
        data-testid="rich-error"
      >
        {node.content}
      </span>
    );
  }

  if (node.type === 'tag') {
    const attr = node.attributes?.[node.content] ?? '';
    const style: CSSProperties = {};
    if (node.content === 'b') {
      // Attribute-less styler tags — M14 parses <b>/<i> into tag nodes, so they
      // render as real emphasis here instead of an unstyled wrapper.
      style.fontWeight = 'bold';
    } else if (node.content === 'i') {
      style.fontStyle = 'italic';
    } else if (node.content === 'color') {
      style.color = isValidColor(attr) ? attr : 'currentColor';
    } else if (node.content === 'size') {
      // `isValidSize` only accepts a bare number or a number with a px/em/rem/%
      // unit, so appending `px` exactly when no unit is present is sufficient.
      style.fontSize = isValidSize(attr)
        ? /(px|em|rem|%)$/.test(attr)
          ? attr
          : `${attr}px`
        : undefined;
    }
    return (
      <span key={key} style={style} data-testid={`rich-tag-${node.content}`}>
        {renderNodes(node.children ?? [], `${key}-`)}
      </span>
    );
  }

  return null;
}

export function RichRenderer({ nodes }: RichRendererProps): React.JSX.Element {
  return <span>{renderNodes(nodes)}</span>;
}
