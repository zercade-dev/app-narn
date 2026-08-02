/**
 * `useDialogSettings` — per-browser persistence of a settings dialog's
 * last-used values (backlog: "settings per modal"), stored as ONE JSON object
 * per modal under `dialog-settings:<dialogKey>`.
 *
 * Deliberately NOT `usePersistentState`: values are written only when the
 * dialog's run/action actually starts (`save(used)`), so fiddling with options
 * and cancelling persists nothing, and `read()` re-reads storage on every
 * dialog open (a mount-time snapshot would go stale after save → reopen).
 *
 * `read()` shape-merges the stored object over `defaults`: unknown keys are
 * dropped, and a stored value is taken only when its JS type (and
 * array-ness) matches the default's — so a stale or hand-edited entry can
 * never push a wrong-shaped value into dialog state. Domain validation beyond
 * shape (e.g. "is this module id still enabled", GroupingChoice membership)
 * stays at the call site, which has the context for it.
 */
import { useCallback, useRef } from 'react';
import { readJson, writeJson } from '../lib/local-storage.js';

/** Shape-merge `raw` over `defaults` (exported for tests). */
export function mergeDialogSettings<T extends Record<string, unknown>>(
  defaults: T,
  raw: unknown,
): T {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...defaults };
  const source = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const stored = source[key];
    const def = defaults[key];
    if (stored === undefined || stored === null) continue;
    if (Array.isArray(def) !== Array.isArray(stored)) continue;
    if (typeof stored !== typeof def) continue;
    out[key] = stored;
  }
  return out as T;
}

export function useDialogSettings<T extends Record<string, unknown>>(
  dialogKey: string,
  defaults: T,
): { read: () => T; save: (used: T) => void } {
  const key = `dialog-settings:${dialogKey}`;
  // Defaults are module constants at every call site; a ref keeps `read`
  // referentially stable without demanding a memoized argument.
  const defaultsRef = useRef(defaults);
  const read = useCallback(
    () => mergeDialogSettings(defaultsRef.current, readJson<unknown>(key, null)),
    [key],
  );
  const save = useCallback(
    (used: T) => {
      writeJson(key, used);
    },
    [key],
  );
  return { read, save };
}
