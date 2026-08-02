import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlignCenter, AlignLeft, AlignRight, Copy, Moon, Sun } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { expandEscapes } from '../../lib/color-text.js';
import { parseStyleTree, styleForNode, type Node as StyleTreeNode } from '../../lib/style-tags.js';

/** Renders text, expanding literal `\n` into `<br/>` line breaks. */
function renderText(text: string, key: number): ReactNode {
  return (
    <Fragment key={key}>
      {expandEscapes(text)
        .split('\n')
        .map((line, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {line}
          </Fragment>
        ))}
    </Fragment>
  );
}

/** Recursively renders a StyleNode tree, applying each node's inline style. */
function renderNodes(nodes: StyleTreeNode[]): ReactNode {
  return nodes.map((node, i) =>
    typeof node === 'string' ? (
      renderText(node, i)
    ) : (
      <span key={i} style={styleForNode(node)}>
        {renderNodes(node.children)}
      </span>
    ),
  );
}

type PreviewBg = 'dark' | 'light';
type PreviewAlign = 'left' | 'center' | 'right';

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32'];

/**
 * Live colored render of the tagged draft, with its own dark/light background
 * (independent of the app theme — game text sits on game backgrounds), plus
 * the collapsible tagged-output strip and copy action.
 */
export function PreviewPanel({ value, onCopy }: { value: string; onCopy: () => void }) {
  const { t } = useTranslation('colorText');
  const [bg, setBg] = useState<PreviewBg>('dark');
  const [fontSize, setFontSize] = useState('20');
  const [align, setAlign] = useState<PreviewAlign>('center');
  const [showOutput, setShowOutput] = useState(true);
  const nodes = parseStyleTree(value);

  const alignButton = (a: PreviewAlign, Icon: typeof AlignLeft, label: string) => (
    <Button
      size="sm"
      variant={align === a ? 'secondary' : 'ghost'}
      className="h-6 w-6 p-0"
      aria-pressed={align === a}
      aria-label={label}
      onClick={() => setAlign(a)}
    >
      <Icon className="size-3.5" />
    </Button>
  );

  return (
    <section
      className="space-y-2 rounded-md border bg-card p-3"
      data-testid="color-text-preview-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t('preview')}</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            aria-label={t('previewBgToggle')}
            data-testid="color-text-preview-bg"
            onClick={() => setBg(bg === 'dark' ? 'light' : 'dark')}
          >
            {bg === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </Button>
          <Select
            value={fontSize}
            onValueChange={(v) => {
              if (v !== null) setFontSize(v);
            }}
          >
            <SelectTrigger aria-label={t('fontSize')} className="h-6 w-[4.5rem] px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border border-border p-0.5">
            {alignButton('left', AlignLeft, t('alignLeft'))}
            {alignButton('center', AlignCenter, t('alignCenter'))}
            {alignButton('right', AlignRight, t('alignRight'))}
          </div>
        </div>
      </div>
      <div
        data-testid="color-text-preview"
        className={`min-h-24 rounded-md border p-4 whitespace-pre-wrap ${
          bg === 'dark'
            ? 'border-zinc-700 bg-zinc-900 text-zinc-100'
            : 'border-zinc-300 bg-zinc-50 text-zinc-800'
        }`}
        style={{ fontSize: `${fontSize}px`, textAlign: align }}
      >
        {renderNodes(nodes)}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={showOutput}
            data-testid="color-text-output-toggle"
            onClick={() => setShowOutput((v) => !v)}
          >
            {t('taggedOutput')}
          </button>
          <Button size="sm" variant="outline" onClick={onCopy} data-testid="color-text-copy">
            <Copy className="size-3.5" />
            {t('copyOutput')}
          </Button>
        </div>
        {showOutput && (
          <pre
            data-testid="color-text-output"
            className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-xs break-all whitespace-pre-wrap"
          >
            {value}
          </pre>
        )}
      </div>
    </section>
  );
}
