import type { CopilotClient } from '@zercade-dev/narn-module-copilot';
import { getCopilotClient } from '@zercade-dev/narn-module-copilot';

const IDLE_TIMEOUT_MS = 30_000;

interface PoolEntry {
  /**
   * In-flight or resolved client. Memoized synchronously so concurrent
   * `acquire(sameToken)` calls share one client instead of each racing the
   * factory (which would leak every loser of the race).
   */
  client: Promise<CopilotClient>;
  refCount: number;
  idleTimer?: NodeJS.Timeout;
}

export class CopilotClientPool {
  private readonly entries = new Map<string, PoolEntry>();
  private readonly factory: (token: string) => Promise<CopilotClient>;

  constructor(factory: (token: string) => Promise<CopilotClient> = getCopilotClient) {
    this.factory = factory;
  }

  async acquire(token: string): Promise<CopilotClient> {
    let entry = this.entries.get(token);
    if (!entry) {
      // Insert the in-flight promise into the map *before* awaiting the factory,
      // so a second concurrent acquire(token) reuses it instead of building (and
      // then leaking) a duplicate client.
      const client = this.factory(token);
      const created: PoolEntry = { client, refCount: 0 };
      this.entries.set(token, created);
      // If the factory rejects, evict the failed entry so a later acquire retries
      // instead of being stuck with a permanently-rejected memoized promise.
      client.catch(() => {
        if (this.entries.get(token) === created) this.entries.delete(token);
      });
      entry = created;
    }
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = undefined;
    }
    entry.refCount++;
    try {
      return await entry.client;
    } catch (err) {
      // Factory failed: undo our refCount bump (the entry itself is evicted by
      // the catch above) so a successful retry starts from a clean slate.
      entry.refCount = Math.max(0, entry.refCount - 1);
      throw err;
    }
  }

  async release(token: string): Promise<void> {
    const entry = this.entries.get(token);
    if (!entry) return;
    entry.refCount = Math.max(0, entry.refCount - 1);
    if (entry.refCount === 0) {
      const tokenRef = token;
      entry.idleTimer = setTimeout(() => {
        const e = this.entries.get(tokenRef);
        if (e?.refCount === 0) {
          this.entries.delete(tokenRef);
          // The client promise is always settled by now (idle implies a prior
          // successful acquire), but guard against a rejected/throwing destroy.
          void e.client.then((c) => c.destroy?.()).catch(() => {});
        }
      }, IDLE_TIMEOUT_MS);
    }
  }

  /**
   * Tear down the single pooled client for exactly one token (the copilot
   * GITHUB_TOKEN value that keys the map), leaving every OTHER token's client
   * untouched. This is the tenant-scoped teardown used when ONE session is
   * locked/evicted: `destroyAll()` would kill every tenant's live client and
   * fail their in-flight batches, which is wrong for a per-session event. A
   * best-effort destroy that never blocks (same non-awaited pattern as
   * `destroyAll`): a still-building client is cleaned up if/when it resolves,
   * and a rejected/throwing destroy is swallowed.
   */
  async destroyByToken(token: string): Promise<void> {
    const entry = this.entries.get(token);
    if (!entry) return;
    this.entries.delete(token);
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    void entry.client.then((client) => client.destroy?.()).catch(() => {});
  }

  async destroyAll(): Promise<void> {
    const all = [...this.entries.values()];
    this.entries.clear();
    await Promise.all(
      all.map((entry) => {
        if (entry.idleTimer) clearTimeout(entry.idleTimer);
        // Best-effort destroy that never blocks teardown: if a factory promise
        // is still pending (e.g. a hung getCopilotClient with no timeout),
        // awaiting it here would hang destroyAll() forever. Attach the destroy
        // to the promise instead and don't wait on it — a still-building client
        // is cleaned up if/when it ever resolves, and a failed/throwing destroy
        // is swallowed.
        void entry.client.then((client) => client.destroy?.()).catch(() => {});
        return Promise.resolve();
      }),
    );
  }

  /** For testing: check current pool size. */
  get size(): number {
    return this.entries.size;
  }
}

export const copilotClientPool = new CopilotClientPool();
