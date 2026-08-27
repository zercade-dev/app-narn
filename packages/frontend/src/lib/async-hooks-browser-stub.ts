/**
 * Browser stub for `node:async_hooks`.
 *
 * The frontend imports the shared root barrel, which re-exports
 * `runCountingProviderCalls` from `ai-sdk-provider/provider-call-counter.ts`;
 * that module imports `AsyncLocalStorage` from `node:async_hooks`, and the
 * guarded-fetch seam (`ai-sdk-provider/config-coerce.ts`) imports its
 * `countProviderCall` sibling. So the module lands in the browser graph even
 * though no frontend code path ever calls either function.
 *
 * The production build tree-shakes it away, but Vite's dev server does not: it
 * replaces `node:async_hooks` with a shim that THROWS on any property access —
 * including reading the named import binding — which took the whole module
 * graph down and left `pnpm dev` serving a permanent "Loading…" screen.
 * Deferring the construction does not help; the throw is at the import.
 *
 * This restores dev/prod parity by giving that import something inert to
 * resolve to. It is deliberately a stub and not an implementation: if frontend
 * code ever genuinely needs async context tracking, this is the wrong tool.
 *
 * The underlying issue is that the shared ROOT barrel mixes server-only modules
 * with browser-safe ones. Splitting it (or moving the counter behind a
 * registration seam the server fills in) is the real fix and is a larger change
 * than unbreaking the dev server warrants.
 */
export class AsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, fn: () => R): R {
    const previous = this.store;
    this.store = store;
    try {
      return fn();
    } finally {
      this.store = previous;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }
}
