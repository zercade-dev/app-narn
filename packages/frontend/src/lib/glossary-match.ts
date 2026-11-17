/**
 * Glossary-term matching over many entries, with the work done once: one
 * whole-word matcher per term (rather than a RegExp built per entry per term,
 * as `termMatchesText` does) and each entry's placeholder-free text kept
 * while the entry object lives. Same results as `termMatchesText`.
 */
import { buildTermBoundaryRegex, glossaryScanText } from '@zercade-dev/narn-shared';

/**
 * One matcher per term, built once. An empty term matches nothing, as with
 * `termMatchesText`. Test them against {@link glossaryScanText} of a text.
 */
export function termMatchers(sources: readonly string[]): RegExp[] {
  return sources.filter((s) => s !== '').map((s) => buildTermBoundaryRegex(s));
}

/** Store entries are replaced, never mutated, so an entry's scan text holds while it does. */
const scanTexts = new WeakMap<object, string>();

/** `glossaryScanText(entry.sourceText)`, worked out once per entry object. */
export function entryScanText(entry: { readonly sourceText: string }): string {
  let text = scanTexts.get(entry);
  if (text === undefined) {
    text = glossaryScanText(entry.sourceText);
    scanTexts.set(entry, text);
  }
  return text;
}

/** Whether a scan text holds any of `matchers`. */
export function matchesAny(matchers: readonly RegExp[], scanText: string): boolean {
  return matchers.some((re) => re.test(scanText));
}
