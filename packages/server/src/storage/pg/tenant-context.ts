import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The ambient tenant for the current request/run. `userId` is the RLS tenant
 * (issued as `app.user_id`); `sessionId` rides along for the M16 BYOK lookup
 * that some detached bodies still need. Established at exactly two kinds of
 * seam: the HTTP middleware, and each detached background-run body.
 * `deviceId` rides along for the per-device cloud vault lookup; undefined in
 * local mode.
 */
export interface TenantContext {
  readonly userId: string;
  readonly sessionId?: string;
  readonly deviceId?: string;
}

export class NoTenantContextError extends Error {
  constructor() {
    super('no tenant context — storage access requires runWithTenant(...) (fail-closed)');
    this.name = 'NoTenantContextError';
  }
}

const als = new AsyncLocalStorage<TenantContext>();

/**
 * Test-only fallback: unit tests that do not wrap each call in runWithTenant
 * get a default tenant via the harness. Never set in production, so
 * production stays fail-closed. An explicit runWithTenant always wins.
 */
let testDefault: TenantContext | undefined;

/** Establish the tenant for the synchronous + async duration of `fn`. */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return als.run(ctx, fn);
}

/** The active tenant (ALS context, else the test default), or undefined. */
export function getCurrentTenant(): TenantContext | undefined {
  return als.getStore() ?? testDefault;
}

/** The active tenant or throw — the app-layer fail-closed gate. */
export function requireTenant(): TenantContext {
  const ctx = getCurrentTenant();
  if (!ctx) throw new NoTenantContextError();
  return ctx;
}

/** Test seam — the harness sets a default 'local' tenant per test. */
export function __setTestTenant(ctx: TenantContext | undefined): void {
  testDefault = ctx;
}
export function __clearTestTenant(): void {
  testDefault = undefined;
}
