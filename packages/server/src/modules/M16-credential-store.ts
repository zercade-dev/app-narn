/**
 * M16 — CredentialStore
 *
 * Session-keyed in-memory store of decrypted credentials. The encrypted
 * source-of-truth lives in the vault file (see M18-vault) and is decrypted
 * exactly once per browser session by `routes/vault.ts`, which calls
 * `unlock(sessionId, credentials)` with the plaintext map.
 *
 * Until a session is unlocked, `get()` (and `validateRequiredVars()`) throw
 * a typed `VaultLockedError` mapped to HTTP 423 by the error handler.
 *
 * Logging policy: callers MUST pass values through `maskSecret()` before
 * including them in log metadata. M15 ConsoleLogger does NOT auto-mask;
 * masking is the caller's responsibility.
 */

import { maskSecret } from '@zercade-dev/narn-shared';
import { MissingCredentialError, VaultLockedError } from '../types/errors.js';
import { logger } from './M15-console-logger.js';
import { copilotClientPool } from './copilot-client-pool.js';
import { createHash } from 'node:crypto';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
/** Idle lifetime of unlocked credentials; also drives the session cookie Max-Age. */
export const CREDENTIAL_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Depth cap for `sanitizeLogObject`'s recursive walk — a backstop against a
 * very deep (but non-circular) metadata object, alongside the WeakSet cycle
 * guard. Log metadata is never legitimately this deep, so hitting the cap
 * means truncating a pathological input, not a real payload.
 */
const MAX_SANITIZE_DEPTH = 20;

/**
 * Hard cap on the lockouts map as an OOM backstop. Once a public origin is
 * reachable, each distinct client IP that fails an unlock creates a bucket; the
 * periodic eviction below clears expired ones, but this cap bounds the map even
 * under a burst that outpaces that sweep — when exceeded, the oldest
 * (least-recently-touched) buckets are dropped first.
 */
const LOCKOUT_MAP_MAX = 10_000;

/**
 * How long a credential's REDACTION material lingers after its session is
 * locked/evicted. Decoupled from {@link CREDENTIAL_TTL_MS}: it does NOT keep the
 * credential usable (only `sessions` backs `get()`), it only keeps the log
 * scrubber able to redact a secret that a still-in-flight run's provider error
 * echoes just after a mid-run TTL eviction. Bounded — the material expires and
 * is pruned, so it never grows without limit.
 */
const REDACTION_GRACE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * OOM backstop on the recently-seen-secrets map (mirrors {@link LOCKOUT_MAP_MAX}).
 * The grace expiry normally keeps this tiny, but a burst of evictions could
 * outpace the periodic prune; when over the cap the soonest-to-expire entries
 * are dropped first (they protect the least remaining lifetime).
 */
const RECENT_SECRETS_MAX = 1_000;

interface LockoutState {
  count: number;
  lockoutUntil?: number;
  /**
   * When this bucket was last recorded/updated (ms). Drives eviction ordering
   * (oldest-first when over the cap) and staleness pruning of zero-count entries
   * that never reached the lockout threshold.
   */
  lastSeen: number;
}

/**
 * A credential is "present" only when it is a non-empty string; an empty value
 * counts as absent (same as a missing key). Single source of truth for that
 * rule, shared by the lookup/validation methods.
 */
function isPresent(v: string | undefined): v is string {
  return v !== undefined && v !== '';
}

export class CredentialStore {
  private readonly sessions = new Map<string, Map<string, string>>();
  private readonly sessionCreated = new Map<string, number>();
  private readonly lockouts = new Map<string, LockoutState>();
  private readonly cleanupInterval: NodeJS.Timeout;
  /**
   * Memoized SHA-256 hashes of every stored credential value, used by
   * `sanitizeLogObject` for exact-value redaction. Rebuilt lazily only when the
   * credential set actually changes (unlock/lock/setCredentials/eviction), so a
   * hot logging path doesn't re-hash every secret on every call.
   */
  private credentialHashes: Set<string> | null = null;
  /**
   * Plaintext credential values of RECENTLY locked/evicted sessions mapped to
   * their grace-period expiry (ms). Consulted by the scrubber IN ADDITION to the
   * live sessions, so redaction survives a mid-run TTL eviction. Never read by
   * `get()` — this lingers only for log redaction, it does NOT extend the
   * credential's usable lifetime. Entries expire ({@link REDACTION_GRACE_MS}) and
   * are pruned/capped, so the set is bounded.
   */
  private readonly recentSecrets = new Map<string, number>();

  constructor() {
    // Cleanup credentials every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredCredentials();
      },
      5 * 60 * 1000,
    );
    this.cleanupInterval.unref();
  }

  /** Install plaintext credentials for a session id (called by /api/vault/unlock). */
  unlock(sessionId: string, credentials: Record<string, string>): void {
    const map = new Map<string, string>();
    for (const [k, v] of Object.entries(credentials)) {
      if (typeof v === 'string' && v !== '') map.set(k, v);
    }
    this.sessions.set(sessionId, map);
    this.sessionCreated.set(sessionId, Date.now());
    this.credentialHashes = null;
  }

  /** Drop the credentials for a session (called by /api/vault/lock or on logout). */
  lock(sessionId: string): void {
    const map = this.sessions.get(sessionId);
    // Retain this session's secrets for the redaction grace window BEFORE the
    // plaintext is dropped, so a log line emitted just after the lock still
    // scrubs them (see recentSecrets).
    this.rememberSecrets(map);
    // Tear down this session's copilot client(s) ONLY, SCOPED by token
    // (destroyByToken) — mirrors the TTL-eviction sweep below. A single
    // tenant locking their vault (or logging out, which also calls lock())
    // must not kill every OTHER tenant's live copilot client mid-batch, which
    // the shared pool's full-teardown method would (this used to be called
    // unconditionally from routes/vault.ts `/lock` — moved here so it's
    // scoped to the session actually being locked, covering the logout path
    // for free).
    if (map) {
      for (const token of new Set(map.values())) {
        void copilotClientPool.destroyByToken(token);
      }
    }
    this.sessions.delete(sessionId);
    this.sessionCreated.delete(sessionId);
    this.credentialHashes = null;
  }

  isUnlocked(sessionId: string | undefined): boolean {
    if (!sessionId) return false;
    return this.sessions.has(sessionId);
  }

  /**
   * Sliding expiry: refresh the session's TTL window. Called when a vault-
   * guarded route is actually used, so an active translation run never
   * relocks mid-flight while an idle machine still relocks after the TTL.
   * (Deliberately not called from isUnlocked() — the frontend polls
   * /api/vault/status, which must not count as activity.)
   */
  touch(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.sessionCreated.set(sessionId, Date.now());
    }
  }

  /** List the credential keys currently stored for a session (names only). */
  listKeys(sessionId: string): string[] {
    const map = this.sessions.get(sessionId);
    if (!map) return [];
    return Array.from(map.keys()).sort();
  }

  /**
   * Union of credential key names across all unlocked sessions (names only,
   * never values). Lets log redaction cover user-defined credential names —
   * e.g. a custom key for the generic-ai module — that no static list knows.
   */
  listAllCredentialKeys(): string[] {
    const keys = new Set<string>();
    for (const map of this.sessions.values()) {
      for (const k of map.keys()) keys.add(k);
    }
    return Array.from(keys).sort();
  }

  /** Snapshot the session's credentials (e.g. for vault re-encryption on update). */
  snapshot(sessionId: string): Record<string, string> {
    const map = this.sessions.get(sessionId);
    if (!map) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of map) out[k] = v;
    return out;
  }

  /**
   * Returns the credential for the given key, or throws.
   *
   * Throws `VaultLockedError` when the session is not unlocked, and
   * `MissingCredentialError` when the session is unlocked but the key is absent.
   */
  get(key: string, sessionId: string | undefined): string {
    const map = this.requireSession(sessionId);
    const value = map.get(key);
    if (!isPresent(value)) {
      throw new MissingCredentialError(key);
    }
    return value;
  }

  getOptional(key: string, sessionId: string | undefined): string | undefined {
    if (!sessionId) return undefined;
    const map = this.sessions.get(sessionId);
    if (!map) return undefined;
    const value = map.get(key);
    return isPresent(value) ? value : undefined;
  }

  /** Mutate credentials in-place for an already-unlocked session. */
  setCredentials(sessionId: string, updates: Record<string, string | null>): void {
    const map = this.requireSession(sessionId);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') map.delete(k);
      else map.set(k, v);
    }
    this.credentialHashes = null;
  }

  validateRequiredVars(requiredEnvVars: string[], sessionId: string | undefined): void {
    const map = this.requireSession(sessionId);
    const missing: string[] = [];
    for (const name of requiredEnvVars) {
      if (!isPresent(map.get(name))) missing.push(name);
    }
    if (missing.length > 0) {
      throw new MissingCredentialError(missing);
    }
  }

  hasAll(requiredEnvVars: string[], sessionId: string | undefined): boolean {
    // A module that requires no credentials is always satisfied — even when
    // the vault is locked (no session), since there is nothing to look up.
    if (requiredEnvVars.length === 0) return true;
    if (!sessionId) return false;
    const map = this.sessions.get(sessionId);
    if (!map) return false;
    return requiredEnvVars.every((name) => isPresent(map.get(name)));
  }

  /** Track failed unlock attempts per origin (typically the true `clientIp`). */
  recordFailedUnlock(origin: string): { remaining: number; lockoutMs?: number } {
    const now = Date.now();
    const state = this.lockouts.get(origin) ?? { count: 0, lastSeen: now };
    if (state.lockoutUntil && state.lockoutUntil <= now) {
      state.count = 0;
      state.lockoutUntil = undefined;
    }
    state.count += 1;
    state.lastSeen = now;
    if (state.count >= LOCKOUT_THRESHOLD) {
      state.lockoutUntil = now + LOCKOUT_WINDOW_MS;
    }
    this.lockouts.set(origin, state);
    // OOM backstop: a flood of distinct origins could grow the map faster
    // than the periodic sweep clears it. Cap the size by dropping the oldest
    // (least-recently-seen) buckets — never the one we just touched.
    this.enforceLockoutCap();
    return {
      remaining: Math.max(0, LOCKOUT_THRESHOLD - state.count),
      lockoutMs: state.lockoutUntil ? state.lockoutUntil - now : undefined,
    };
  }

  resetFailedUnlock(origin: string): void {
    this.lockouts.delete(origin);
  }

  /** Returns remaining lockout ms or undefined when not currently locked out. */
  getLockoutMs(origin: string): number | undefined {
    const state = this.lockouts.get(origin);
    if (!state?.lockoutUntil) return undefined;
    const remaining = state.lockoutUntil - Date.now();
    return remaining > 0 ? remaining : undefined;
  }

  /**
   * Cleanup expired credentials (past {@link CREDENTIAL_TTL_MS}) AND stale
   * lockout buckets. The lockout sweep is the periodic time-based reclaim for
   * `lockouts` — without it an idle bucket from a failed `/unlock` would sit
   * resident until the {@link LOCKOUT_MAP_MAX} write-path cap evicted it.
   */
  private cleanupExpiredCredentials(): void {
    const now = Date.now();
    const thirtyMinutes = CREDENTIAL_TTL_MS;

    // Copilot pool keys are the GITHUB_TOKEN credential VALUES. Collect only the
    // tokens of the sessions we actually evict, so teardown is scoped to those
    // (see below) instead of nuking every tenant's live client.
    const evictedTokens = new Set<string>();
    for (const [sessionId, createdAt] of this.sessionCreated.entries()) {
      if (now - createdAt > thirtyMinutes) {
        const map = this.sessions.get(sessionId);
        // Keep the secrets redactable for the grace window, and remember this
        // session's token values for the scoped copilot teardown, BEFORE dropping
        // the plaintext.
        this.rememberSecrets(map);
        if (map) for (const v of map.values()) evictedTokens.add(v);
        this.sessions.delete(sessionId);
        this.sessionCreated.delete(sessionId);
        this.credentialHashes = null;
        // `sessionId` IS the raw `translator_session` bearer token — its key name
        // doesn't match CREDENTIAL_KEY_PATTERN, so sanitizeLogObject would not
        // catch it. Mask it explicitly so the bearer token never lands in logs.
        logger.info('credentials:evicted', { sessionId: maskSecret(sessionId), reason: 'timeout' });
      }
    }

    // A TTL relock drops the plaintext credentials, but an idle copilot client
    // (whose plaintext token is its pool-map key) can otherwise linger until the
    // 30s idle-evict window — tear down the evicted sessions' clients so the
    // token never outlives the unlocked session. SCOPED to the evicted tokens
    // (destroyByToken) so a single idle tenant's TTL eviction does NOT kill every
    // OTHER tenant's live client mid-batch, which `destroyAll()` would.
    for (const token of evictedTokens) {
      void copilotClientPool.destroyByToken(token);
    }

    this.cleanupExpiredLockouts(now);
    this.pruneExpiredRecentSecrets(now);
  }

  /**
   * Copy a session's plaintext credential values into {@link recentSecrets} with
   * a fresh grace expiry, so the scrubber keeps redacting them for
   * {@link REDACTION_GRACE_MS} after the session is gone. Bounded by an OOM cap.
   */
  private rememberSecrets(map: Map<string, string> | undefined): void {
    if (!map) return;
    const expiry = Date.now() + REDACTION_GRACE_MS;
    for (const v of map.values()) {
      if (typeof v === 'string' && v !== '') this.recentSecrets.set(v, expiry);
    }
    this.enforceRecentSecretsCap();
  }

  /** Drop recently-seen secrets whose grace window has fully passed. */
  private pruneExpiredRecentSecrets(now: number): void {
    for (const [secret, expiry] of this.recentSecrets) {
      if (expiry <= now) this.recentSecrets.delete(secret);
    }
  }

  /**
   * Hard size backstop on {@link recentSecrets}: when over the cap, drop the
   * soonest-to-expire entries first (least remaining redaction lifetime). Sorting
   * only happens on the rare over-cap call.
   */
  private enforceRecentSecretsCap(): void {
    if (this.recentSecrets.size <= RECENT_SECRETS_MAX) return;
    const bySoonest = [...this.recentSecrets.entries()].sort((a, b) => a[1] - b[1]);
    const dropCount = this.recentSecrets.size - RECENT_SECRETS_MAX;
    for (let i = 0; i < dropCount; i++) {
      this.recentSecrets.delete(bySoonest[i][0]);
    }
  }

  /** Non-expired recently-seen secret plaintexts (grace-window redaction material). */
  private liveRecentSecrets(now: number): string[] {
    const out: string[] = [];
    for (const [secret, expiry] of this.recentSecrets) {
      if (expiry > now && secret !== '') out.push(secret);
    }
    return out;
  }

  /**
   * Evict lockout buckets that no longer protect anything:
   *   - a locked bucket whose `lockoutUntil` window has fully passed, and
   *   - a stale bucket that never reached the threshold (no `lockoutUntil`) and
   *     hasn't been touched within the lockout window — its failure tally would
   *     have been reset on the next attempt anyway, so it carries no state worth
   *     keeping resident.
   * Anything inside an active window (or recently active) is retained so the
   * lockout still fires. The hard-cap backstop runs on the write path; this is
   * the periodic time-based reclaim.
   */
  private cleanupExpiredLockouts(now: number): void {
    for (const [origin, state] of this.lockouts.entries()) {
      const windowPassed = state.lockoutUntil !== undefined && state.lockoutUntil <= now;
      const staleZero =
        state.lockoutUntil === undefined && now - state.lastSeen > LOCKOUT_WINDOW_MS;
      if (windowPassed || staleZero) {
        this.lockouts.delete(origin);
      }
    }
  }

  /**
   * Hard size backstop invoked on the lockout write path: if the map
   * exceeds `LOCKOUT_MAP_MAX`, drop the oldest (least-recently-seen) buckets
   * until it fits. Sorting only happens on the rare over-cap call, so the common
   * path stays O(1).
   */
  private enforceLockoutCap(): void {
    if (this.lockouts.size <= LOCKOUT_MAP_MAX) return;
    const byOldest = [...this.lockouts.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const dropCount = this.lockouts.size - LOCKOUT_MAP_MAX;
    for (let i = 0; i < dropCount; i++) {
      this.lockouts.delete(byOldest[i][0]);
    }
  }

  /**
   * Memoized SHA-256 hashes of every stored credential value. Rebuilt only when
   * the credential set was invalidated (see `credentialHashes`), so the hot
   * logging path reuses the set instead of re-hashing every secret per call.
   *
   * Hashes are used instead of storing plaintext so the redaction comparison
   * never holds an extra copy of a credential value in memory.
   */
  private getLiveCredentialHashes(): Set<string> {
    if (this.credentialHashes) return this.credentialHashes;
    const hashes = new Set<string>();
    for (const sessionMap of this.sessions.values()) {
      for (const v of sessionMap.values()) {
        // The exact-value match must cover *every* stored credential regardless
        // of length — a 3-char secret is still a secret. (The length floor only
        // applies to the heuristic key-pattern path.) Empty values are never
        // stored, so the guard is defensive.
        if (typeof v === 'string' && v !== '') {
          hashes.add(createHash('sha256').update(v).digest('hex'));
        }
      }
    }
    this.credentialHashes = hashes;
    return hashes;
  }

  /**
   * The exact-value hash set the scrubber matches against: the memoized LIVE
   * session hashes UNION the non-expired recently-evicted secrets (grace window).
   * The recent contribution is computed fresh (bounded, time-limited) rather than
   * folded into the memo, so grace expiry takes effect without a memo bust and
   * the live-session fast path stays allocation-free when nothing was recently
   * evicted (the common case).
   */
  private getCredentialHashes(): Set<string> {
    const live = this.getLiveCredentialHashes();
    const recent = this.liveRecentSecrets(Date.now());
    if (recent.length === 0) return live;
    const combined = new Set(live);
    for (const secret of recent) combined.add(createHash('sha256').update(secret).digest('hex'));
    return combined;
  }

  /**
   * Distinct stored credential plaintexts long enough to scrub as substrings.
   * Length-floored at 8 so a tiny "secret" can't blanket-mask normal log text.
   */
  private credentialValuesForSubstring(): string[] {
    const out = new Set<string>();
    for (const m of this.sessions.values()) {
      for (const v of m.values()) if (v.length >= 8) out.add(v);
    }
    // Recently-evicted secrets stay scrubbable for the grace window too, so a
    // provider error echoing a key just after a mid-run TTL eviction is still
    // masked as a substring.
    for (const v of this.liveRecentSecrets(Date.now())) if (v.length >= 8) out.add(v);
    return [...out];
  }

  /**
   * Defense-in-depth: replace any stored credential plaintext that appears as a
   * SUBSTRING of `value` (e.g. a provider error echoing the key) with
   * `maskSecret()`. Compares against the live plaintext values, length-floored,
   * so a credential embedded in prose under a non-credential-shaped key (the
   * exact-hash / key-pattern checks miss those) is still scrubbed.
   */
  private redactCredentialSubstrings(value: string): string {
    let scrubbed = value;
    for (const secret of this.credentialValuesForSubstring()) {
      if (scrubbed.includes(secret)) scrubbed = scrubbed.split(secret).join(maskSecret(secret));
    }
    return scrubbed;
  }

  /**
   * Scrub a bare string that has no owning key (e.g. an array/Set element):
   * exact-hash match → full mask, otherwise the substring scan. There is no
   * key-pattern check because a leaf has no key.
   */
  private scrubLeafString(value: string, credentialHashes: Set<string>): string {
    if (value === '' || credentialHashes.size === 0) return value;
    const valueHash = createHash('sha256').update(value).digest('hex');
    if (credentialHashes.has(valueHash)) return maskSecret(value);
    return this.redactCredentialSubstrings(value);
  }

  /**
   * Returns a shallow copy of `obj` in which any string value matching a known
   * credential (across all unlocked sessions) or sitting under a credential-shaped
   * key is replaced by `maskSecret()`.
   *
   * Uses SHA-256 hashes for credential comparison to avoid storing plaintext
   * credential values in memory during the sanitization process.
   *
   * `seen`/`depth` are internal-only (defaulted, so every external call site —
   * `sanitizeLogObject(x)` — is unaffected): `seen` is a per-ANCESTOR-PATH guard
   * (added before recursing into a container, removed once it returns) against a
   * circular object, which would otherwise recurse until a `RangeError` escapes
   * the log call; `depth` is a backstop cap against a very deep (but
   * non-circular) structure. Error/Date have no enumerable own properties, so
   * without the explicit branches below they would collapse to `{}`.
   */
  sanitizeLogObject<T>(obj: T, seen: WeakSet<object> = new WeakSet(), depth = 0): T {
    if (obj === null || obj === undefined || typeof obj !== 'object') return obj;

    if (obj instanceof Date) {
      return obj.toISOString() as unknown as T;
    }
    if (obj instanceof Error) {
      const credentialHashes = this.getCredentialHashes();
      return {
        name: obj.name,
        message: this.scrubLeafString(obj.message, credentialHashes),
        ...(obj.stack ? { stack: this.scrubLeafString(obj.stack, credentialHashes) } : {}),
      } as unknown as T;
    }
    if (depth > MAX_SANITIZE_DEPTH) {
      return '[Truncated: max depth exceeded]' as unknown as T;
    }
    if (seen.has(obj as object)) {
      return '[Circular]' as unknown as T;
    }
    seen.add(obj as object);
    try {
      if (Array.isArray(obj)) {
        const credentialHashes = this.getCredentialHashes();
        return obj.map((v) =>
          typeof v === 'string'
            ? this.scrubLeafString(v, credentialHashes)
            : this.sanitizeLogObject(v, seen, depth + 1),
        ) as unknown as T;
      }

      const credentialHashes = this.getCredentialHashes();

      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof value === 'string') {
          // Exact-value match (any stored credential, any length) by hash, then
          // fall back to the heuristic key-pattern match. A credential-shaped key
          // (`password`, `token`, `api_key`, …) signals the value is a secret
          // regardless of length, so it is masked with NO length floor — this is
          // the (single) redaction layer of record since M15's second pass was
          // dropped, and a short secret is still a secret. `maskSecret` collapses
          // short/empty values to a full `••••` placeholder, so it never leaks.
          // Skip the SHA-256 entirely when there are no stored credentials to
          // match against (vault locked / no creds — the common case in tests and
          // before unlock). The key-pattern path below is unaffected.
          const valueHash =
            value !== '' && credentialHashes.size > 0
              ? createHash('sha256').update(value).digest('hex')
              : '';
          if (valueHash !== '' && credentialHashes.has(valueHash)) {
            out[key] = maskSecret(value);
          } else if (value !== '' && CREDENTIAL_KEY_PATTERN.test(key)) {
            out[key] = maskSecret(value);
          } else if (value !== '' && credentialHashes.size > 0) {
            // Defense-in-depth: redact a stored credential appearing as a
            // SUBSTRING of a larger string (e.g. a provider error echoing the
            // key). Compare against live plaintext values, length-floored.
            out[key] = this.redactCredentialSubstrings(value);
          } else {
            out[key] = value;
          }
        } else if (value && typeof value === 'object') {
          // Normalize Map/Set before recursing: `Object.entries(map)` is empty, so
          // a credential held inside a Map/Set value would otherwise pass through
          // unscrubbed. A Map becomes a plain object (keys/values recursed), a Set
          // an array (elements recursed). Cycle-check the ORIGINAL Map/Set too —
          // `Object.fromEntries`/`[...set]` produce a fresh object each call, so
          // without this a self-referential Map/Set would recurse forever despite
          // the outer `seen` guard (each conversion is a new, never-before-seen
          // reference).
          if (seen.has(value)) {
            out[key] = '[Circular]';
          } else if (value instanceof Map) {
            seen.add(value);
            out[key] = this.sanitizeLogObject(Object.fromEntries(value), seen, depth + 1);
            seen.delete(value);
          } else if (value instanceof Set) {
            seen.add(value);
            out[key] = this.sanitizeLogObject([...value], seen, depth + 1);
            seen.delete(value);
          } else {
            out[key] = this.sanitizeLogObject(value, seen, depth + 1);
          }
        } else {
          out[key] = value;
        }
      }
      return out as unknown as T;
    } finally {
      seen.delete(obj as object);
    }
  }

  /** Test-only: reset all sessions, lockouts, and session timestamps. */
  __resetForTests(): void {
    this.sessions.clear();
    this.sessionCreated.clear();
    this.lockouts.clear();
    this.recentSecrets.clear();
    this.credentialHashes = null;
  }

  /** Test-only: number of live (non-expired) recently-seen redaction secrets. */
  __recentSecretsCountForTests(): number {
    return this.liveRecentSecrets(Date.now()).length;
  }

  /** Test-only: number of live lockout buckets (asserts the eviction sweep). */
  __lockoutCountForTests(): number {
    return this.lockouts.size;
  }

  /** Test-only: run the periodic sweep on demand (sessions + lockout eviction). */
  __runCleanupForTests(): void {
    this.cleanupExpiredCredentials();
  }

  private requireSession(sessionId: string | undefined): Map<string, string> {
    if (!sessionId) throw new VaultLockedError();
    const map = this.sessions.get(sessionId);
    if (!map) throw new VaultLockedError();
    return map;
  }
}

// Single key-pattern list of record for log redaction. `token` already covers
// access-/refresh-/auth-token; `secret`/`password` cover api-secret/api-password.
// `credential` and private/public-key are folded in so the M15 second pass can
// be dropped without losing any key that was previously masked.
const CREDENTIAL_KEY_PATTERN =
  /(api[_-]?key|secret|token|password|authorization|bearer|credential|private[_-]?key|public[_-]?key)/i;

export const credentialStore = new CredentialStore();

// Re-export the shared masking primitive so server callers keep importing
// `maskSecret` from M16, while the actual implementation is unified in
// @zercade-dev/narn-shared (see src/mask.ts).
export { maskSecret } from '@zercade-dev/narn-shared';

export function sanitizeLogObject<T>(obj: T): T {
  return credentialStore.sanitizeLogObject(obj);
}
