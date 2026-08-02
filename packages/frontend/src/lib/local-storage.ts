/**
 * Tiny safe localStorage JSON helpers. Both swallow errors (unavailable
 * storage, quota, malformed JSON) so callers can treat the cache as
 * best-effort: a read falls back to a default, a write is a no-op on failure.
 * Callers keep their own domain-specific shape validation on the parsed value.
 */

/** Reads and parses a JSON value from localStorage, or returns `fallback`. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Serializes and stores a value in localStorage. Returns true on success and
 * false (no-op) when storage is unavailable (private mode, quota, SSR), so
 * callers can gate follow-up work (e.g. notifying peers) on a real write.
 */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
