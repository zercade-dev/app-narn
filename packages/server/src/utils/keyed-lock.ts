/**
 * In-process async mutual-exclusion locks for serializing read-modify-write
 * sequences against the same resource. The server is single-process and
 * single-user (no cross-process coordination), so an in-memory promise chain
 * is sufficient to prevent two concurrent async operations from interleaving a
 * load→mutate→`atomicWrite` and clobbering each other's update.
 *
 * The canonical pattern — duplicated across the storage modules before this was
 * extracted — is: while a lock for the key is held, await it; then install a
 * fresh lock promise; run the work; and in `finally` remove the entry and
 * resolve the promise so the next waiter proceeds. The `finally` guarantees the
 * lock is always released, so a rejecting `fn` never deadlocks subsequent
 * callers.
 */

/**
 * Serializes async work per string key. Operations for distinct keys run
 * concurrently; operations for the same key run one at a time in the order they
 * acquire the lock.
 *
 * DEPLOY INVARIANT — SINGLE SERVER REPLICA. This lock is in-process memory:
 * it serializes writers inside ONE Node process only. Every store that
 * guards a Postgres read-modify-write with it (pg-string-store
 * setTranslation/updateEntry, pg-run-store updateRun, pg-glossary-store,
 * pg-project-store, pg-template-store) silently loses updates the day the
 * cloud deployment scales past one replica. Before running >1 replica,
 * replace these call sites with DB-level serialization (SELECT … FOR UPDATE
 * row locks or pg_advisory_xact_lock — see pg-translation-memory.record()
 * for the pattern).
 */
export class KeyedAsyncLock {
  private readonly locks = new Map<string, Promise<void>>();

  /**
   * Runs `fn` while holding the lock for `key`, releasing it (even on
   * rejection) once `fn` settles. Returns whatever `fn` returns.
   */
  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let unlock!: () => void;
    const lock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    this.locks.set(key, lock);
    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      unlock();
    }
  }
}

/**
 * Single-key convenience: serializes all work through one lock. Equivalent to a
 * {@link KeyedAsyncLock} with a fixed key, for resources backed by a single
 * file (e.g. the global config or the translation-memory store).
 */
export class SingleAsyncLock {
  private current: Promise<void> | undefined;

  /**
   * Runs `fn` while holding the lock, releasing it (even on rejection) once
   * `fn` settles. Returns whatever `fn` returns.
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    while (this.current) {
      await this.current;
    }
    let unlock!: () => void;
    const lock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    this.current = lock;
    try {
      return await fn();
    } finally {
      this.current = undefined;
      unlock();
    }
  }
}
