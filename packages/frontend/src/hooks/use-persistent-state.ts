/**
 * `usePersistentState` — `useState` whose value is mirrored to localStorage,
 * collapsing the paired "lazy-init from storage" + "write-on-change effect"
 * idiom repeated across the app (page-size, bulk-re-translate, compare language
 * selections, …) into one call.
 *
 * - Lazy-initializes from `readJson(key, …)`. On a miss (absent key, unavailable
 *   storage, malformed JSON) it falls back to `initial`. When `opts.validate` is
 *   given, a stored value that fails the guard is also coerced to `initial`, so a
 *   stale or hand-edited entry of the wrong shape never reaches the component.
 * - Persists every change via a `writeJson(key, value)` effect. `writeJson`
 *   swallows storage errors (private mode, quota), so a failed write is a silent
 *   no-op and never throws into render.
 *
 * The returned tuple is API-compatible with `useState<T>`, so a `useState(initial)`
 * paired with a read-effect and a write-effect can be replaced in place.
 *
 * STORAGE FORMAT — values are JSON (`writeJson`/`readJson`). A key whose existing
 * data was persisted as a BARE string (e.g. `localStorage.setItem(k, 'es')`, as
 * some compare-language preferences are) is NOT readable as JSON — `JSON.parse('es')`
 * throws and the hook falls back to `initial`, silently dropping the saved value
 * on first load. Before adopting this hook for such a key, EITHER switch the key's
 * writers to JSON in the same change, OR migrate the stored value (re-key, or wrap
 * the legacy bare string), OR keep the raw-`localStorage` read for that key.
 * Numbers/booleans persisted via `String(x)` (`'50'`, `'true'`) happen to be valid
 * JSON and round-trip unchanged.
 *
 * WRITE-ON-MOUNT — the effect persists the current value on mount, so a storage
 * MISS is written back as `initial` (turning an absent key into one explicitly set
 * to the default). This matches the raw-`localStorage` write-effect patterns it
 * replaces (which also wrote the default on mount); a caller that must distinguish
 * "never chosen" from "chose the default" should not use this hook for that key.
 *
 * Note: like the raw-`localStorage` patterns it replaces, this does NOT subscribe
 * to the `storage` event, so values do not sync live across tabs — the existing
 * sites never did either (last write wins, matching the single-user design).
 *
 * `key` is read once on mount (initial state) and captured by the write effect;
 * changing it across renders is not supported (it was a module constant at every
 * call site). Pass a stable key.
 */
import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readJson, writeJson } from '../lib/local-storage.js';

export interface UsePersistentStateOptions<T> {
  /**
   * Type guard run against the parsed stored value. When it returns false the
   * value is discarded in favour of `initial`. Without it any parseable JSON is
   * trusted (the caller keeps its own shape assumptions, as before).
   */
  validate?: (value: unknown) => value is T;
}

/**
 * @param key      localStorage key (stable across renders)
 * @param initial  value used when nothing valid is stored
 * @param opts     optional validation (see {@link UsePersistentStateOptions})
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  opts: UsePersistentStateOptions<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    // The lazy initializer runs once on mount, so reading the mount-time `key`,
    // `initial`, and `opts.validate` directly is correct — there is no need to keep
    // them in refs (validation only applies to the one read from storage).
    //
    // Sentinel distinguishes "stored null" from "absent": readJson returns the
    // fallback for an absent/unparseable key, so a unique sentinel lets a
    // legitimately stored `null` through the validator instead of being lost.
    const sentinel = Symbol('miss');
    const stored = readJson<T | typeof sentinel>(key, sentinel);
    if (stored === sentinel) return initial;
    if (opts.validate && !opts.validate(stored)) return initial;
    return stored;
  });

  // Persist on change. writeJson is side-effect-only (no setState), so it cannot
  // cause the cascading render that `react-hooks/set-state-in-effect` guards
  // against; it is a plain "mirror state to storage" effect.
  useEffect(() => {
    writeJson(key, value);
  }, [key, value]);

  return [value, setValue];
}
