/**
 * Vault store — tracks whether the encrypted credential vault is unlocked for
 * the current browser session. Backed by `/api/vault/status`. The actual
 * password and derived key never leave the server, so this store only mirrors
 * server-side state plus transient UI flags.
 */
import { create } from 'zustand';
import { apiRequest, ApiError } from '../hooks/use-api.js';
import { getPasswordPolicyMessages } from '../lib/password-policy.js';
import { getErrorMessage } from '../lib/utils.js';
import { vaultLockedEvent } from '../lib/vault-events.js';
import { runAction } from './store-helpers.js';

export interface VaultStatus {
  unlocked: boolean;
  hasVault: boolean;
  keys: string[];
  /**
   * Cloud mode: the current device has no enrolled vault row, so the user must
   * complete device enrollment on /vault instead of the open-core unlock UI.
   * Absent/false in open-core (the field is fail-soft from /api/vault/status).
   */
  setupRequired?: boolean;
  /**
   * Cloud mode: the server manages the device-bound vault, so credential
   * management / passphrase change happen on the /vault page, not via the
   * open-core /api/vault/* routes. Absent/false in open-core (server sets it
   * on /api/vault/status). No client cloud-mode flag — purely server-derived.
   */
  cloudManaged?: boolean;
  /**
   * Optional user-chosen display name for this vault. Plaintext, non-secret
   * metadata surfaced by `/api/vault/status` even while the vault is locked
   * (set at creation time; absent for vaults created before this field existed).
   */
  name?: string;
}

interface UnlockResponse {
  unlocked: boolean;
  keys: string[];
  name?: string;
}

interface VaultStore extends VaultStatus {
  loading: boolean;
  error: string | null;
  /** Password-policy requirement messages from a rejected unlock, if any. */
  errorDetails: string[] | null;
  lockoutMs: number | null;
  remainingAttempts: number | null;
  /** True once the initial vault-status fetch has been kicked off this session. */
  statusFetched: boolean;

  refresh: () => Promise<VaultStatus>;
  /**
   * Fetches vault status exactly once per store lifetime (the first caller wins).
   * Convenience for mount-time hooks; the flag lives in the store so it is
   * observable and resets with the store rather than per JS-module load.
   */
  refreshStatusOnce: () => void;
  unlock: (password: string, name?: string) => Promise<{ unlocked: boolean }>;
  /**
   * Proactively re-reads `/vault/status` and, if the server now reports the
   * vault locked while this client still believed it was unlocked, dispatches
   * the same `vault:locked` event a live 423 would — surfacing the unlock
   * prompt instead of leaving the app parked with a silently-dead session.
   * A no-op (skips the network call) when the client already believes the
   * vault is locked — there is nothing to detect an eviction against.
   */
  checkEviction: () => Promise<void>;
  lock: () => Promise<void>;
  updateCredentials: (
    updates: Record<string, string | null>,
    password: string,
  ) => Promise<{ keys: string[] }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
}

export const useVaultStore = create<VaultStore>()((set, get) => ({
  unlocked: false,
  hasVault: false,
  keys: [],
  setupRequired: false,
  cloudManaged: false,
  name: undefined,
  loading: false,
  error: null,
  errorDetails: null,
  lockoutMs: null,
  remainingAttempts: null,
  statusFetched: false,

  refresh: async () =>
    (await runAction<VaultStore, VaultStatus>(
      set,
      async () => {
        set({ errorDetails: null });
        const res = await apiRequest<VaultStatus>('/vault/status');
        set(res);
        return res;
      },
      { loading: true, rethrow: true },
    ))!,

  refreshStatusOnce: () => {
    if (get().statusFetched) return;
    set({ statusFetched: true });
    void get()
      .refresh()
      .catch(() => {
        // Surfaced via the store's `error`; the one-shot guard stays set so the
        // mount effect doesn't loop. Callers can still `refresh()` to retry.
      });
  },

  unlock: async (password: string, name?: string) => {
    set({ loading: true, error: null, errorDetails: null, lockoutMs: null });
    try {
      const res = await apiRequest<UnlockResponse>('/vault/unlock', {
        method: 'POST',
        // `name` only matters on first unlock (vault creation); the server
        // ignores it once a vault already exists.
        body: JSON.stringify(name ? { password, name } : { password }),
      });
      set({
        unlocked: res.unlocked,
        keys: res.keys,
        hasVault: true,
        ...(res.name !== undefined ? { name: res.name } : {}),
        loading: false,
      });
      return { unlocked: res.unlocked };
    } catch (err) {
      const data =
        err instanceof ApiError
          ? (err.data as { lockoutMs?: number; remaining?: number } | undefined)
          : undefined;
      const isLockout =
        (err instanceof ApiError && err.status === 429) || (data?.lockoutMs ?? 0) > 0;
      if (isLockout) {
        set({
          loading: false,
          error: 'too-many-attempts',
          errorDetails: null,
          lockoutMs: data?.lockoutMs ?? 0,
          remainingAttempts: null,
        });
      } else {
        set({
          loading: false,
          error: getErrorMessage(err),
          errorDetails: getPasswordPolicyMessages(err),
          remainingAttempts: data?.remaining ?? null,
          lockoutMs: null,
        });
      }
      throw err;
    }
  },

  checkEviction: async () => {
    if (!get().unlocked) return;
    try {
      const status = await apiRequest<VaultStatus>('/vault/status');
      set(status);
      if (!status.unlocked) {
        globalThis.dispatchEvent(vaultLockedEvent({}));
      }
    } catch {
      // Network hiccup or transient failure — leave state as-is; the caller
      // (SSE backoff and/or the next periodic check) will retry later.
    }
  },

  lock: async () => {
    await runAction<VaultStore, void>(
      set,
      async () => {
        await apiRequest('/vault/lock', { method: 'POST' });
        // Only reflect a locked vault when the server confirmed the lock; a
        // failed request must not mask itself as success (credentials may still
        // be live).
        set({ unlocked: false, keys: [] });
      },
      { loading: true, rethrow: true },
    );
  },

  updateCredentials: async (updates, password) =>
    (await runAction<VaultStore, { keys: string[] }>(
      set,
      async () => {
        const res = await apiRequest<{ keys: string[] }>('/vault/credentials', {
          method: 'PUT',
          headers: { 'x-vault-password': password },
          body: JSON.stringify({ updates }),
        });
        set({ keys: res.keys });
        return res;
      },
      { loading: true, rethrow: true },
    ))!,

  changePassword: async (currentPassword, newPassword) => {
    await runAction<VaultStore, void>(
      set,
      async () => {
        await apiRequest('/vault/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
      },
      { loading: true, rethrow: true },
    );
  },

  clearError: () =>
    set({ error: null, errorDetails: null, lockoutMs: null, remainingAttempts: null }),
}));
