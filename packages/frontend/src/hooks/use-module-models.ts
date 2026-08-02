/**
 * Generalized hook for fetching live model listings (with billing metadata) from
 * the server for any module that exposes a `/modules/:moduleId/models` route.
 *
 * Returns an empty array when the vault is locked or no credentials are
 * configured, so callers can fall back to static manifest suggestions.
 *
 * Models are cached in localStorage so the last-known list is shown
 * immediately on mount while a background refresh is in progress.
 * Call `refetch()` to force a server-side cache bypass (passes ?refresh=true).
 */
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { ModelInfo } from '@zercade-dev/narn-shared';
import { apiRequest, ApiError } from './use-api';
import { useVaultStore } from '../stores/vault-store.js';
import { readJson, writeJson } from '../lib/local-storage.js';
import { errorMessage, randomId } from '../lib/utils.js';
import { vaultLockedEvent } from '../lib/vault-events.js';

/** Must match the server-side TTL in routes/modules.ts. */
const MODELS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * How long a failed auto-fetch latches off further auto-fetches before one is
 * allowed to retry. The latch exists to stop an infinite reload loop when the
 * server is persistently failing, but a *permanent* latch (the original
 * behavior) meant a single transient error on first mount wedged every later
 * mount of that module into the cached-error state until a manual refresh or
 * vault toggle — even after the network recovered. With a TTL, auto-fetch
 * recovers on its own once the window elapses.
 * @internal exported for unit-testing
 */
export const RETRY_LATCH_TTL_MS = 60 * 1000; // 1 minute

interface ModelsLocalCache {
  models: ModelInfo[];
  updatedAt: string;
}

/**
 * Coerces an already-parsed localStorage value into the models cache structure.
 * Supports both the legacy plain-array format and the current {models, updatedAt} format.
 */
function coerceModelsCache(parsed: unknown): { models: ModelInfo[]; updatedAt: Date | null } {
  // Support both the old plain-array format and the new {models, updatedAt} format.
  if (Array.isArray(parsed)) {
    return { models: parsed as ModelInfo[], updatedAt: null };
  }
  const cache = parsed as Partial<ModelsLocalCache> | null;
  return {
    models: cache && Array.isArray(cache.models) ? cache.models : [],
    updatedAt: cache && cache.updatedAt ? new Date(cache.updatedAt) : null,
  };
}

/**
 * Parses a raw localStorage value into the models cache structure.
 * Supports both the legacy plain-array format and the current {models, updatedAt} format.
 * @internal exported for unit-testing
 */
export function parseModelsCache(raw: string | null): {
  models: ModelInfo[];
  updatedAt: Date | null;
} {
  if (!raw) return { models: [], updatedAt: null };
  try {
    return coerceModelsCache(JSON.parse(raw));
  } catch {
    return { models: [], updatedAt: null };
  }
}

export interface UseModuleModelsResult {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  /** Timestamp of the most recent successful fetch, or null if never loaded. */
  cachedAt: Date | null;
  refetch: () => void;
}

function loadLocalCache(moduleId: string): { models: ModelInfo[]; updatedAt: Date | null } {
  return coerceModelsCache(readJson<unknown>(`models-cache:${moduleId}`, null));
}

/** Shared context so sibling/child components can read the same fetch state. */
export const ModuleModelsContext = createContext<UseModuleModelsResult | null>(null);

/** Shared record tracking sequential loading errors. Reset on success, manual refresh, 401, or 423. */
export const retryCounters: Record<string, number> = {};

/**
 * Last fetch error per module, kept alongside `retryCounters` so a selector
 * that mounts after the retry limit was reached still shows the error instead
 * of a misleading "no models available" state.
 */
export const lastErrors: Record<string, string | null> = {};

/** Shared record tracking in-flight model list fetch requests to deduplicate parallel mounts. */
export const activeFetches: Record<string, Promise<ModelInfo[]>> = {};

/**
 * Timestamp (ms) of the most recent auto-fetch failure per module, paired with
 * `retryCounters`. Lets the retry latch expire after `RETRY_LATCH_TTL_MS` so a
 * transient error doesn't wedge auto-fetch off forever.
 */
export const lastErrorAt: Record<string, number> = {};

/**
 * Whether auto-fetch is currently latched off for `moduleId`: it failed at least
 * once and the latch window has not yet elapsed. After the TTL, auto-fetch is
 * allowed to retry again (which, on a fresh failure, re-arms the latch).
 */
function isRetryLatched(moduleId: string): boolean {
  if ((retryCounters[moduleId] ?? 0) < 1) return false;
  const at = lastErrorAt[moduleId];
  return at !== undefined && Date.now() - at < RETRY_LATCH_TTL_MS;
}

/**
 * @param moduleId module (or instance) whose `/models` route is fetched.
 * @param enabled When `false`, the hook performs no `/models` request and
 *   exposes an empty, non-loading, error-free state. Used to avoid a wasted
 *   request — and the legitimate `401`/`423` it returns (logged as console
 *   noise) — for a module that is not globally enabled, or whose vault is
 *   still locked. Defaults to `true` for back-compat.
 */
export function useModuleModels(moduleId: string, enabled = true): UseModuleModelsResult {
  const MODELS_CACHE_KEY = `models-cache:${moduleId}`;
  const MODELS_UPDATED_EVENT = `models-updated:${moduleId}`;

  // Lazy initializer: parses the localStorage cache once, on the initial
  // render, instead of on every render (a plain `loadLocalCache(moduleId)`
  // call here would re-parse on each re-render even though only the mount
  // value is ever used to seed state).
  const [initial] = useState(() => loadLocalCache(moduleId));
  const [models, setModels] = useState<ModelInfo[]>(initial.models);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<Date | null>(initial.updatedAt);
  const [tick, setTick] = useState(0);
  const forceRefreshRef = useRef(false);
  // Render-safe mirror of forceRefreshRef: true while a manual refresh is pending.
  const [manualRefreshPending, setManualRefreshPending] = useState(false);
  const vaultUnlocked = useVaultStore((s) => s.unlocked);
  const hasVault = useVaultStore((s) => s.hasVault);

  const hasExceededRetries = !manualRefreshPending && isRetryLatched(moduleId);
  const effectiveLoading = hasExceededRetries ? false : loading;

  useEffect(() => {
    let cancelled = false;
    const isManualRefresh = forceRefreshRef.current;

    // Disabled (e.g. module not globally enabled, or vault still locked): skip
    // the request entirely and present a clean empty state. This avoids the
    // legitimate 401/423 the route returns when credentials are unavailable,
    // which would otherwise spam the console for every not-enabled module.
    // The reset is intentionally synchronous (there is deliberately no request
    // to await) and only runs when `enabled` flips, so it does not cascade on
    // every render — the dependency array gates re-runs.
    if (!enabled) {
      forceRefreshRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      setError(null);
      setModels([]);
      return;
    }

    // Reject automatic fetches while the retry latch is active to prevent
    // infinite reload loops. The latch expires after RETRY_LATCH_TTL_MS, so a
    // later mount (or the cache-TTL tick) can auto-recover once the window
    // elapses instead of staying wedged until a manual refresh / vault toggle.
    if (!isManualRefresh && isRetryLatched(moduleId)) {
      setError(lastErrors[moduleId] ?? null);
      return;
    }

    setLoading(true);
    const url = isManualRefresh
      ? `/modules/${moduleId}/models?refresh=true`
      : `/modules/${moduleId}/models`;
    forceRefreshRef.current = false;

    let fetchPromise = activeFetches[moduleId];
    if (isManualRefresh || !fetchPromise) {
      fetchPromise = apiRequest<ModelInfo[]>(url);
      activeFetches[moduleId] = fetchPromise;
    }

    fetchPromise
      .then((data) => {
        if (cancelled) return;
        retryCounters[moduleId] = 0; // Reset retry count on success
        lastErrors[moduleId] = null;
        delete lastErrorAt[moduleId];
        const list = Array.isArray(data) ? data : [];
        const now = new Date();
        setModels(list);
        setCachedAt(now);
        setError(null);
        const payload: ModelsLocalCache = { models: list, updatedAt: now.toISOString() };
        if (writeJson(MODELS_CACHE_KEY, payload)) {
          // Notify other hook instances that fresh model data is now cached.
          window.dispatchEvent(new CustomEvent(MODELS_UPDATED_EVENT));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 423)) {
          retryCounters[moduleId] = 0; // Reset lock-related events
          // Fallback path: if manual refresh reports 401 while we already know a vault
          // exists and is locked, open the same unlock dialog flow used by 423 responses.
          if (err.status === 401 && isManualRefresh && hasVault && !vaultUnlocked) {
            const retryId = randomId();
            const retry = async () => {
              forceRefreshRef.current = true;
              setManualRefreshPending(true);
              setTick((t) => t + 1);
            };
            globalThis.dispatchEvent(vaultLockedEvent({ retry, retryId }));
          }
          // No token / vault locked — treat as empty, not an error.
          lastErrors[moduleId] = null;
          delete lastErrorAt[moduleId];
          setModels([]);
          setError(null);
          return;
        }
        // Increment retry counter on each network or connection error and stamp
        // the failure time so the latch can expire after RETRY_LATCH_TTL_MS.
        retryCounters[moduleId] = (retryCounters[moduleId] ?? 0) + 1;
        lastErrorAt[moduleId] = Date.now();
        const message = errorMessage(err, 'Failed to load models');
        lastErrors[moduleId] = message;
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setManualRefreshPending(false);
        }
        if (activeFetches[moduleId] === fetchPromise) {
          delete activeFetches[moduleId];
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tick, enabled, vaultUnlocked, hasVault, moduleId, MODELS_CACHE_KEY, MODELS_UPDATED_EVENT]);

  // When auto-fetch is latched off by a prior failure, schedule a single tick
  // for the moment the latch window expires so the list auto-recovers without
  // needing a fresh mount, navigation, or vault toggle. `error` is in the deps so
  // this re-runs the moment a failed fetch records `lastErrorAt` (the fetch's
  // catch calls setError) — not just on the mount render, when lastErrorAt isn't
  // set yet — and again on success (latch cleared ⇒ early return).
  useEffect(() => {
    const at = lastErrorAt[moduleId];
    if ((retryCounters[moduleId] ?? 0) < 1 || at === undefined) return;
    const remainingMs = RETRY_LATCH_TTL_MS - (Date.now() - at);
    if (remainingMs <= 0) return; // already expired — the mount fetch covers it
    const id = setTimeout(() => setTick((t) => t + 1), remainingMs);
    return () => clearTimeout(id);
  }, [tick, moduleId, error]);

  // Sync with other hook instances: when any other instance writes fresh model data
  // to the shared localStorage cache, reload the state so all components reflect
  // the same up-to-date model list immediately.
  useEffect(() => {
    const handleModelsUpdated = () => {
      const { models: latestModels, updatedAt: latestUpdatedAt } = loadLocalCache(moduleId);
      setModels(latestModels);
      if (latestUpdatedAt) setCachedAt(latestUpdatedAt);
    };
    window.addEventListener(MODELS_UPDATED_EVENT, handleModelsUpdated);
    return () => window.removeEventListener(MODELS_UPDATED_EVENT, handleModelsUpdated);
  }, [moduleId, MODELS_UPDATED_EVENT]);

  // Silently re-fetch when the cached data reaches its TTL so the list
  // stays fresh in long-running sessions without user interaction.
  useEffect(() => {
    if (!cachedAt) return;
    const expiresInMs = MODELS_CACHE_TTL_MS - (Date.now() - cachedAt.getTime());
    if (expiresInMs <= 0) return; // already stale — the mount fetch covers it
    const id = setTimeout(() => setTick((t) => t + 1), expiresInMs);
    return () => clearTimeout(id);
  }, [cachedAt]);

  const refetch = useCallback(() => {
    forceRefreshRef.current = true;
    setManualRefreshPending(true);
    retryCounters[moduleId] = 0; // Reset retry count on manual refresh
    delete lastErrorAt[moduleId];
    setTick((t) => t + 1);
  }, [moduleId]);

  // After the vault transitions from locked to unlocked, force-refresh the model
  // list. While locked, the server has no credentials so it returns 401/empty
  // (and any transient non-auth error trips the retry guard above), leaving the
  // displayed list stale or empty until the user clicks refresh by hand. Pulling
  // automatically on unlock — via the same force path as the manual button, so it
  // resets the retry guard and bypasses the server's 1-hour cache — keeps the
  // Global Config model pickers current the moment credentials become available.
  const prevUnlockedRef = useRef(vaultUnlocked);
  useEffect(() => {
    const wasUnlocked = prevUnlockedRef.current;
    prevUnlockedRef.current = vaultUnlocked;
    if (!wasUnlocked && vaultUnlocked) {
      refetch();
    } else if (wasUnlocked && !vaultUnlocked) {
      // On lock, clear this module's shared fetch state so a later unlock (or a
      // fresh mount in between) starts clean instead of inheriting a stale
      // `lastErrors`/`retryCounters` entry that would short-circuit the refetch.
      retryCounters[moduleId] = 0;
      lastErrors[moduleId] = null;
      delete lastErrorAt[moduleId];
      delete activeFetches[moduleId];
    }
  }, [vaultUnlocked, refetch, moduleId]);

  return { models, loading: effectiveLoading, error, cachedAt, refetch };
}
