/**
 * Authoritative usage probes for free-tier providers that expose their own
 * usage endpoint (DeepL, OpenRouter). The engine's own dispatch accounting
 * only sees requests NARN itself made, so it can drift from the provider's
 * real day-scale counter — a call made outside NARN, or a bucket wired up
 * mid-window. This is a best-effort correction: it overwrites the ledger's
 * current window with ground truth from the provider, and never throws.
 * Callers race it against a short timeout (see M9's freeway resolution
 * hook) so a slow/unreachable provider never stalls run start.
 */
import type { FreeTierProvider, FreewayWindowKind } from '@zercade-dev/narn-shared';
import { getFreeTierSnapshot, windowStart } from '@zercade-dev/narn-shared';
import type { FreewayLedgerStore } from '../../storage/types.js';
import { getFreewayLedgerStore } from '../../storage/registry.js';
import { freewayBucketKey } from './bucket-source.js';

/** Vault key each probe reads — mirrors the module's manifest `requiredEnvVars`. */
const DEEPL_ENV_VAR = 'DEEPL_API_KEY';
const OPENROUTER_ENV_VAR = 'OPENROUTER_API_KEY';

export interface AuthoritativeUsageDeps {
  ledger?: FreewayLedgerStore;
  fetchImpl?: typeof fetch;
  /**
   * Reads a module's credential by its manifest env-var name. Vault-backed
   * credentials (M16 CredentialStore) are exposed only per-session, so this
   * is a dependency rather than a module-level default: M9 passes a
   * session-scoped closure (`credentialStore.getOptional(envVar, sessionId)`)
   * at the freeway resolution hook. Absent here ⇒ no credential for any
   * provider ⇒ every probe skips — never reads `process.env`.
   */
  credentialFor?: (moduleId: string, envVar: string) => string | undefined;
}

type CredentialFor = (moduleId: string, envVar: string) => string | undefined;

/** Shape of the DeepL `/v2/usage` response this probe cares about. */
interface DeepLUsageResponse {
  character_count?: unknown;
  character_limit?: unknown;
}

/** Shape of the OpenRouter `/api/v1/key` response this probe cares about. */
interface OpenRouterKeyResponse {
  data?: {
    usage?: unknown;
    limit?: unknown;
  };
}

/**
 * Sync authoritative usage for every probe-capable free-tier provider
 * (DeepL, OpenRouter) that has a credential available. Best-effort and
 * time-unbounded on its own (the caller races it against a timeout): a
 * missing credential, network error, non-2xx response, or unrecognized
 * payload shape is a silent skip for that one provider, never a failure for
 * the run.
 */
export async function syncAuthoritativeUsage(
  now: number,
  deps?: AuthoritativeUsageDeps,
): Promise<void> {
  const ledger = deps?.ledger ?? getFreewayLedgerStore();
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const credentialFor: CredentialFor = deps?.credentialFor ?? (() => undefined);
  const snapshot = getFreeTierSnapshot();
  const probes = Object.values(snapshot.providers)
    .filter((provider) => provider.probe !== undefined)
    .map((provider) => probeProvider(provider, now, ledger, fetchImpl, credentialFor));
  await Promise.allSettled(probes);
}

/** Dispatches to the right probe by kind; swallows anything that one provider throws. */
async function probeProvider(
  provider: FreeTierProvider,
  now: number,
  ledger: FreewayLedgerStore,
  fetchImpl: typeof fetch,
  credentialFor: CredentialFor,
): Promise<void> {
  try {
    if (provider.probe === 'deepl-usage') {
      await probeDeepL(provider, now, ledger, fetchImpl, credentialFor);
    } else if (provider.probe === 'openrouter-key') {
      await probeOpenRouter(provider, now, ledger, fetchImpl, credentialFor);
    }
  } catch {
    // Best-effort: never let one provider's probe failure affect another's,
    // or escape to the caller.
  }
}

/**
 * DeepL: `GET https://api-free.deepl.com/v2/usage` with
 * `Authorization: DeepL-Auth-Key <key>` → `{ character_count, character_limit }`,
 * overwriting the provider's single `monthly_chars`-governed model bucket.
 * The free-endpoint host is used unconditionally — a paid-shape key (no
 * `:fx` suffix) simply won't have a free bucket to correct, so the call is
 * still best-effort and a non-2xx response is just skipped.
 */
async function probeDeepL(
  provider: FreeTierProvider,
  now: number,
  ledger: FreewayLedgerStore,
  fetchImpl: typeof fetch,
  credentialFor: CredentialFor,
): Promise<void> {
  const key = credentialFor(provider.moduleId, DEEPL_ENV_VAR);
  if (!key) return;
  const model = provider.models.find((m) => m.limits.some((l) => l.window === 'monthly_chars'));
  if (!model) return;
  const res = await fetchImpl('https://api-free.deepl.com/v2/usage', {
    headers: { Authorization: `DeepL-Auth-Key ${key}` },
  });
  if (!res.ok) return;
  const body = (await res.json()) as DeepLUsageResponse;
  if (typeof body.character_count !== 'number') return;
  const bucketKey = freewayBucketKey(provider.moduleId, model.id);
  const start = windowStart('monthly_chars', now, provider.resetTimeZone);
  await ledger.syncAuthoritativeUsage(
    bucketKey,
    { kind: 'monthly_chars', start },
    { chars: body.character_count },
  );
}

/**
 * OpenRouter: `GET https://openrouter.ai/api/v1/key` with
 * `Authorization: Bearer <key>` → account-level `data.usage`/`data.limit`.
 * Free `:free` models share ONE account-wide daily request pool and the
 * endpoint has no per-model breakdown, so the count is attributed to a single
 * canonical bucket (the provider's first `rpd`-governed model) rather than
 * written to each sibling: pool headroom is derived by SUMMING the provider's
 * buckets, so fanning the same total out would count it once per model and
 * drain the pool N times over.
 *
 * The siblings' own cells are RESET to zero in the same pass, because the
 * account total already includes every request NARN spent on them — left
 * standing they would be counted twice by that sum. The invariant this
 * establishes: after a probe the canonical cell carries the authoritative
 * account total, every sibling cell is zero, and later per-sibling dispatches
 * accumulate on top of that total, so the pool sum stays exact. (It also
 * clears a stale total from a bucket that used to be canonical, should the
 * snapshot's model order ever change.)
 *
 * A provider without a shared pool has genuinely independent per-model
 * counters, so it keeps the fan-out.
 *
 * The endpoint's documented shape carries `usage`/`limit` as dollar-credit
 * figures, not a request count, and it has changed shape before — so this
 * only maps when `usage` is itself shaped as a daily request count (an
 * object carrying a numeric `requests` field), and skips silently otherwise
 * rather than guessing that a bare number is a request tally.
 */
async function probeOpenRouter(
  provider: FreeTierProvider,
  now: number,
  ledger: FreewayLedgerStore,
  fetchImpl: typeof fetch,
  credentialFor: CredentialFor,
): Promise<void> {
  const key = credentialFor(provider.moduleId, OPENROUTER_ENV_VAR);
  if (!key) return;
  const rpdModels = provider.models.filter((m) => m.limits.some((l) => l.window === 'rpd'));
  if (rpdModels.length === 0) return;
  const res = await fetchImpl('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return;
  const body = (await res.json()) as OpenRouterKeyResponse;
  const requests = dailyRequestCount(body.data?.usage);
  if (requests === undefined) return;
  const kind: FreewayWindowKind = 'rpd';
  const start = windowStart(kind, now, provider.resetTimeZone);
  const pooled = provider.sharedLimits?.some((l) => l.window === kind) === true;
  // Pooled: the total lands on the canonical bucket and every other sibling is
  // zeroed. Unpooled: each model's own counter is independent, so all get it.
  const writes = rpdModels.map((model, index) => ({
    bucketKey: freewayBucketKey(provider.moduleId, model.id),
    requests: !pooled || index === 0 ? requests : 0,
  }));
  await Promise.all(
    writes.map((write) =>
      ledger.syncAuthoritativeUsage(write.bucketKey, { kind, start }, { requests: write.requests }),
    ),
  );
}

/** Extracts a daily request count from an OpenRouter `usage` field, or undefined when the shape isn't a usable request count. */
function dailyRequestCount(usage: unknown): number | undefined {
  if (typeof usage !== 'object' || usage === null) return undefined;
  const requests = (usage as { requests?: unknown }).requests;
  return typeof requests === 'number' ? requests : undefined;
}
