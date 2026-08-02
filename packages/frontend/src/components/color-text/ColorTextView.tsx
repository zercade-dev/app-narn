import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Eraser, Merge, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button.js';
import { Textarea } from '../ui/textarea.js';
import {
  applyColorToSelection,
  countColorTags,
  findEnclosingColorBlock,
  mergeConsecutiveColorTags,
  removeColorInRange,
  stripColorTags,
  wrapTag,
} from '../../lib/color-text.js';
import { clampSizePx, type TagKind } from '../../lib/style-tags.js';
import { useColorTextStore, type ColorTextMode } from '../../stores/color-text-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { AssistantPanel } from './AssistantPanel.js';
import { FormatToolbar } from './FormatToolbar.js';
import { PaletteSection } from './PaletteSection.js';
import { PreviewPanel } from './PreviewPanel.js';
import { isAtContentEnd, rawToRichDOM, richOffsetOf, richRootToRaw } from './rich-dom.js';

type FormatKind = Exclude<TagKind, 'color'>;

const MAX_UNDO = 50;

/**
 * Color Text workspace view: wrap selected text in `<color=#HEX>` game-markup
 * tags. Raw mode edits the tagged string directly in a textarea; rich mode is
 * a WYSIWYG contenteditable kept in sync through rich-dom round-tripping. The
 * draft, mode, and custom colors persist via useColorTextStore.
 */
export function ColorTextView() {
  const { t } = useTranslation('colorText');
  // Draft is per-project (keyed by the active project id, `''` when none is
  // active — the styler still works as a standalone scratch pad).
  const projectId = useProjectStore((s) => s.activeProjectId) ?? '';
  const draftFor = useColorTextStore((s) => s.draftFor);
  const setDraft = useColorTextStore((s) => s.setDraft);
  const value = useColorTextStore((s) => s.drafts[projectId] ?? '');
  const setValue = useCallback((next: string) => setDraft(projectId, next), [setDraft, projectId]);
  const mode = useColorTextStore((s) => s.mode);
  const setMode = useColorTextStore((s) => s.setMode);
  // Adopt any pending pre-v2 legacy draft into this project the first time its
  // styler tab opens (no-op once adopted or when the project already has a draft).
  useEffect(() => {
    draftFor(projectId);
  }, [draftFor, projectId]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const richRef = useRef<HTMLDivElement>(null);
  // The undo stack is per-component-instance state (a ref, not store-backed),
  // so it otherwise survives a project switch — Ctrl+Z in project B could pop a
  // snapshot captured while editing project A and stomp B's draft with it. Tag
  // the stack with the project it belongs to and discard it on mismatch at both
  // push and pop time (not only via an effect): the clear is otherwise a passive
  // effect that can lag a synchronous Ctrl+Z fired right after the switch.
  const undoRef = useRef<{ projectId: string; stack: string[] }>({ projectId, stack: [] });
  const undoStack = (): string[] => {
    if (undoRef.current.projectId !== projectId) {
      undoRef.current = { projectId, stack: [] };
    }
    return undoRef.current.stack;
  };
  // The Size popover moves focus off the rich editor into its Input/Apply
  // button, which can collapse or replace the live document Selection before
  // Apply is clicked. Snapshotting the Range when the popover opens (while
  // the editor selection is still alive) lets applyFormatRich restore it.
  const savedRichRangeRef = useRef<Range | null>(null);

  const pushUndo = () => {
    const stack = undoStack();
    stack.push(useColorTextStore.getState().drafts[projectId] ?? '');
    if (stack.length > MAX_UNDO) stack.shift();
  };

  const undo = () => {
    const prev = undoStack().pop();
    if (prev === undefined) return;
    setValue(prev);
    if (richRef.current) rawToRichDOM(prev, richRef.current);
  };

  // The rich editor is uncontrolled between inputs (re-rendering the DOM on
  // every keystroke would destroy the caret), so the draft is rendered into it
  // only when rich mode becomes active; undo/merge/clear re-render explicitly.
  useEffect(() => {
    if (mode === 'rich' && richRef.current) {
      rawToRichDOM(useColorTextStore.getState().drafts[projectId] ?? '', richRef.current);
    }
    // Re-render the rich DOM when the mode flips OR the active project (hence
    // the draft) changes.
  }, [mode, projectId]);

  const handleUndoKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && undoStack().length > 0) {
      e.preventDefault();
      undo();
      return true;
    }
    return false;
  };

  /** Returns the active selection range inside the rich editor, or null. */
  const richSelection = (): Range | null => {
    const rich = richRef.current;
    const sel = globalThis.getSelection?.();
    if (!rich || !sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    return rich.contains(range.commonAncestorContainer) ? range : null;
  };

  const applyColorRich = (hex: string) => {
    const rich = richRef.current;
    const range = richSelection();
    if (!rich || !range) {
      toast.info(t('selectTextFirst'));
      return;
    }
    pushUndo();
    const ancestor = range.commonAncestorContainer;
    const parentSpan =
      ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : (ancestor as HTMLElement);
    const isEntireSpan =
      parentSpan !== null &&
      parentSpan !== rich &&
      parentSpan.tagName === 'SPAN' &&
      parentSpan.dataset.color !== undefined &&
      range.toString() === parentSpan.textContent;
    if (isEntireSpan && parentSpan) {
      // Entire span selected → recolor in place, no DOM restructuring.
      parentSpan.dataset.color = hex;
      parentSpan.style.color = hex;
    } else {
      const fragment = range.extractContents();
      const span = document.createElement('span');
      span.dataset.color = hex;
      span.style.color = hex;
      span.appendChild(fragment);
      range.insertNode(span);
      // Splitting a parent span can leave empty husks behind.
      for (const s of rich.querySelectorAll('span[data-color]')) {
        if (s.innerHTML === '') s.remove();
      }
      const sel = globalThis.getSelection?.();
      if (sel) {
        range.setStartAfter(span);
        range.setEndAfter(span);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    setValue(richRootToRaw(rich));
  };

  const applyColor = (hex: string) => {
    if (mode === 'rich') {
      applyColorRich(hex);
      return;
    }
    const editor = textareaRef.current;
    if (!editor) return;
    const { selectionStart: start, selectionEnd: end } = editor;
    if (start === end) {
      toast.info(t('selectTextFirst'));
      return;
    }
    const res = applyColorToSelection(value, start, end, hex);
    if ('error' in res) {
      toast.warning(t('unbalancedTags'));
      return;
    }
    pushUndo();
    setValue(res.result);
    // Restore focus + caret after React re-renders the textarea value.
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(res.cursor, res.cursor);
    });
  };

  /** Opens/closes the Size popover: snapshot the live rich selection on open. */
  const handleSizeOpenChange = (open: boolean) => {
    savedRichRangeRef.current = open ? (richSelection()?.cloneRange() ?? null) : null;
  };

  const applyFormatRich = (kind: FormatKind, tagValue?: string) => {
    const rich = richRef.current;
    if (kind === 'size' && savedRichRangeRef.current) {
      const sel = globalThis.getSelection?.();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRichRangeRef.current);
      }
      savedRichRangeRef.current = null;
    }
    const range = richSelection();
    if (!rich || !range) {
      toast.info(t('selectTextFirst'));
      return;
    }
    pushUndo();
    const fragment = range.extractContents();
    const el =
      kind === 'bold'
        ? document.createElement('strong')
        : kind === 'italic'
          ? document.createElement('em')
          : document.createElement('span');
    if (kind === 'size') {
      el.dataset.size = tagValue;
      el.style.fontSize = `${clampSizePx(tagValue ?? '')}px`;
    }
    el.appendChild(fragment);
    range.insertNode(el);
    // Splitting a parent element of the same kind can leave empty husks behind.
    const selector = kind === 'bold' ? 'strong' : kind === 'italic' ? 'em' : 'span[data-size]';
    for (const node of rich.querySelectorAll(selector)) {
      if (node.innerHTML === '') node.remove();
    }
    const sel = globalThis.getSelection?.();
    if (sel) {
      range.setStartAfter(el);
      range.setEndAfter(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    setValue(richRootToRaw(rich));
  };

  const applyFormat = (kind: FormatKind, tagValue?: string) => {
    if (mode === 'rich') {
      applyFormatRich(kind, tagValue);
      return;
    }
    const editor = textareaRef.current;
    if (!editor) return;
    const { selectionStart: start, selectionEnd: end } = editor;
    if (start === end) {
      toast.info(t('selectTextFirst'));
      return;
    }
    const res = wrapTag(value, start, end, kind, tagValue);
    pushUndo();
    setValue(res.result);
    // Restore focus + caret after React re-renders the textarea value.
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(res.cursor, res.cursor);
    });
  };

  const removeColorRich = () => {
    const rich = richRef.current;
    const range = richSelection();
    if (!rich || !range) {
      toast.info(t('selectTextFirst'));
      return;
    }
    // Map the DOM selection to offsets in the serialized raw string, then
    // reuse the raw-mode removal semantics verbatim (single source of truth).
    const raw = richRootToRaw(rich);
    const start = richOffsetOf(rich, range.startContainer, range.startOffset);
    const end = richOffsetOf(rich, range.endContainer, range.endOffset);
    const selected = raw.substring(start, end);
    const { open, close } = countColorTags(selected);
    if (open !== close) {
      // Tags are invisible in rich mode — refuse rather than corrupt them.
      toast.warning(t('unbalancedTags'));
      return;
    }
    const stripped = stripColorTags(selected);
    if (stripped !== selected) {
      pushUndo();
      const res = removeColorInRange(raw, start, end);
      setValue(res.result);
      rawToRichDOM(res.result, rich);
      return;
    }
    const enclosing = findEnclosingColorBlock(raw, start, end);
    if (!enclosing) {
      toast.info(t('noColorTags'));
      return;
    }
    pushUndo();
    const next =
      raw.substring(0, enclosing.blockStart) + enclosing.inner + raw.substring(enclosing.blockEnd);
    setValue(next);
    rawToRichDOM(next, rich);
  };

  const handleRemoveColor = () => {
    if (mode === 'rich') {
      removeColorRich();
      return;
    }
    const editor = textareaRef.current;
    if (!editor) return;
    const { selectionStart: start, selectionEnd: end } = editor;
    if (start === end) {
      toast.info(t('selectTextFirst'));
      return;
    }
    const selected = value.substring(start, end);
    if (stripColorTags(selected) !== selected) {
      // Selection contains tags — strip them.
      pushUndo();
      const res = removeColorInRange(value, start, end);
      setValue(res.result);
      requestAnimationFrame(() => {
        editor.focus();
        editor.setSelectionRange(start, res.selectionEnd);
      });
      return;
    }
    // No tags inside the selection — is it the inner text of an enclosing block?
    const enclosing = findEnclosingColorBlock(value, start, end);
    if (!enclosing) {
      toast.info(t('noColorTags'));
      return;
    }
    pushUndo();
    setValue(
      value.substring(0, enclosing.blockStart) +
        enclosing.inner +
        value.substring(enclosing.blockEnd),
    );
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(enclosing.blockStart, enclosing.blockStart + enclosing.inner.length);
    });
  };

  const handleMerge = () => {
    const merged = mergeConsecutiveColorTags(value);
    if (merged === value) {
      toast.info(t('nothingToMerge'));
      return;
    }
    pushUndo();
    setValue(merged);
    if (mode === 'rich' && richRef.current) rawToRichDOM(merged, richRef.current);
  };

  /** Drops an assistant-suggested replacement into the draft (undoable). */
  const handleApplySuggestion = (text: string) => {
    pushUndo();
    setValue(text);
    if (mode === 'rich' && richRef.current) rawToRichDOM(text, richRef.current);
  };

  const handleClear = () => {
    if (!value) return;
    pushUndo();
    setValue('');
    if (richRef.current) richRef.current.innerHTML = '';
  };

  const handleCopy = async () => {
    if (!value) {
      toast.info(t('nothingToCopy'));
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Non-secure contexts (plain-http LAN hosts) have no clipboard API.
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast.success(t('copied'));
  };

  const handleRichKeyDown = (e: React.KeyboardEvent) => {
    if (handleUndoKey(e)) return;
    if (e.key === 'Enter') {
      // Insert <br> ourselves: browsers otherwise wrap lines in DIVs, which
      // round-trip less predictably than explicit <br> → literal \n.
      e.preventDefault();
      const sel = globalThis.getSelection?.();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const br = document.createElement('br');
      range.insertNode(br);
      // Chromium can't put a caret after a trailing <br>; keep an explicit
      // placeholder break at the end so typing lands after the real one.
      const rich = richRef.current;
      if (rich && isAtContentEnd(br, rich)) {
        rich.appendChild(document.createElement('br'));
      }
      range.setStartAfter(br);
      range.setEndAfter(br);
      sel.removeAllRanges();
      sel.addRange(range);
      if (richRef.current) setValue(richRootToRaw(richRef.current));
    }
  };

  const modeButton = (m: ColorTextMode, label: string) => (
    <Button
      size="sm"
      variant={mode === m ? 'secondary' : 'ghost'}
      className="h-6 px-2 text-xs"
      aria-pressed={mode === m}
      data-testid={`color-text-mode-${m}`}
      onClick={() => setMode(m)}
    >
      {label}
    </Button>
  );

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:flex-row lg:items-start"
      data-testid="color-text-view"
    >
      <div className="min-w-0 flex-1 space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </header>

        <section className="space-y-3 rounded-md border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center rounded-md border border-border p-0.5">
              {modeButton('raw', t('modeRaw'))}
              {modeButton('rich', t('modeRich'))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FormatToolbar onFormat={applyFormat} onSizeOpenChange={handleSizeOpenChange} />
              <Button
                size="sm"
                variant="outline"
                // Keep the editor's selection alive: focus must not move on click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleRemoveColor}
                data-testid="color-text-remove-color"
              >
                <Eraser className="size-3.5" />
                {t('removeColor')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleMerge}
                data-testid="color-text-merge"
              >
                <Merge className="size-3.5" />
                {t('mergeTags')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                data-testid="color-text-clear"
              >
                <Trash2 className="size-3.5" />
                {t('clear')}
              </Button>
            </div>
          </div>

          {mode === 'raw' ? (
            <Textarea
              ref={textareaRef}
              value={value}
              spellCheck={false}
              placeholder={t('editorPlaceholder')}
              data-testid="color-text-editor"
              className="min-h-40 font-mono text-sm"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleUndoKey}
            />
          ) : (
            <div
              ref={richRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              role="textbox"
              aria-multiline="true"
              aria-label={t('title')}
              data-testid="color-text-rich-editor"
              className="min-h-40 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-pre-wrap focus-visible:outline-hidden"
              onInput={() => {
                if (richRef.current) setValue(richRootToRaw(richRef.current));
              }}
              onKeyDown={handleRichKeyDown}
            />
          )}

          <PaletteSection onApply={applyColor} />
        </section>

        <PreviewPanel value={value} onCopy={handleCopy} />
      </div>

      <div className="w-full shrink-0 lg:w-80">
        <AssistantPanel onApplySuggestion={handleApplySuggestion} />
      </div>
    </div>
  );
}
