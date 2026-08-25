/**
 * Per-dispatch provider-call counter.
 *
 * The quota ledger debits once per engine dispatch on the assumption that one
 * dispatch is one provider request. That assumption is false: `splitAndRetry`
 * halves a failing batch and issues a fresh call per half, recursively, all
 * inside a single dispatch — so a ledger built on it reads LOW against what the
 * provider actually counted, and keeps dispatching against quota that is
 * already spent.
 *
 * Counting lives at the guarded-fetch seam rather than in any one feature,
 * because that seam is the single place every provider HTTP call passes: batch
 * splits, transient retries, redirect hops, and whatever multi-call path is
 * added next are all counted without knowing they exist.
 *
 * AsyncLocalStorage rather than a module-level counter: dispatches run
 * concurrently on the bounded queue, and each needs its own tally.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<{ calls: number }>();

/**
 * Runs `fn` with a fresh tally and reports how many provider calls it made.
 * Callers outside a scope are unaffected — {@link countProviderCall} is a no-op
 * with no store, so nothing has to know it is being counted.
 */
export async function runCountingProviderCalls<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; calls: number }> {
  const ctx = { calls: 0 };
  const result = await storage.run(ctx, fn);
  return { result, calls: ctx.calls };
}

/** Records one outbound provider request against the enclosing scope, if any. */
export function countProviderCall(): void {
  const ctx = storage.getStore();
  if (ctx) ctx.calls += 1;
}
