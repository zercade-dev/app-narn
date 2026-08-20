import { useEffect, type RefObject } from 'react';
import { LANGUAGE_REGISTRY, LANG_NAMES } from '@zercade-dev/narn-shared';
import type { EntryFilters } from '../../lib/filter-entries.js';

/**
 * Display order for language codes, derived once from the canonical
 * {@link LANGUAGE_REGISTRY}. Shared by the String table, its filters, and the
 * Comparison tab so a registry/ordering change applies everywhere at once.
 */
const REGISTRY_ORDER = new Map(LANGUAGE_REGISTRY.map((l, i) => [l.code, i]));

/** Human-readable name for a language code, falling back to the upper-cased code. */
export function getLangName(code: string): string {
  return LANG_NAMES[code] ?? code.toUpperCase();
}

/** Sort language codes by their registry order (unknown codes sort last). */
export function sortByRegistry(codes: string[]): string[] {
  return [...codes].sort((a, b) => (REGISTRY_ORDER.get(a) ?? 999) - (REGISTRY_ORDER.get(b) ?? 999));
}

/**
 * The "show everything" filter reset shared by the String table's
 * {@link StringTable} "Show all" action and the {@link StringTableFilters}
 * "Clear filters" action. Spelling it out once keeps the two from drifting when
 * a new filter is added. Note: this deliberately omits `activeLanguages` and
 * `orderMode` — resetting filters should not change which languages are loaded
 * or the chosen display order.
 */
export const DEFAULT_FILTERS: Omit<EntryFilters, 'activeLanguages' | 'orderMode'> = {
  search: '',
  sources: [],
  categories: [],
  glossaryIds: [],
  tones: [],
  visibleLanguages: [],
  runId: '',
  untranslatedOnly: false,
  overflowOnly: false,
  tooLong: false,
  lqaFailed: false,
  needsReview: false,
  sameAsSource: false,
  placeholderMismatch: false,
  flaggedNewOnly: false,
  filterMode: 'AND',
  freewayTierBelow: null,
};

/**
 * Close a popover/picker when a `mousedown` lands outside its element. No-op
 * while `open` is false, so the listener is only attached when needed.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [ref, open, onClose]);
}
