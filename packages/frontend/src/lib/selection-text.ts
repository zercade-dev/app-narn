/**
 * Reads whatever text is "selected" right now, for prefilling the Ctrl+K
 * web-search dialog. `window.getSelection()` doesn't reliably see text
 * selected inside a form control's own value, so when the focused element
 * is an `<input>` or `<textarea>` this reads its `selectionStart`/`selectionEnd`
 * slice instead; otherwise it falls back to the document selection. Result
 * is trimmed and capped at 200 characters.
 */
const MAX_LENGTH = 200;

function isTextEntryElement(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

export function getActiveSelectionText(): string {
  const active = document.activeElement;
  let raw: string;

  if (isTextEntryElement(active)) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    raw = active.value.slice(start, end);
  } else {
    raw = window.getSelection?.()?.toString() ?? '';
  }

  return raw.trim().slice(0, MAX_LENGTH);
}
