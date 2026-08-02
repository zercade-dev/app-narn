import type { Application } from 'express';

/**
 * Route-injection seam (open-core).
 *
 * The public app mounts only its own `/api` routers and the SPA. A cloud
 * composition root can inject additional same-origin routes — e.g. the cloud
 * auth handlers — by calling {@link registerRoutes} BEFORE the server's
 * `index.ts` runs {@link applyRegisteredRoutes}, which `index.ts` invokes once,
 * immediately before `mountSpa`. That ordering means injected routes are
 * matched AFTER the `/api` routers but BEFORE the SPA static/fallback/404
 * handlers.
 *
 * With no registrar set, {@link applyRegisteredRoutes} is a no-op, so the
 * single-user app is unaffected: a cloud composition root is the only caller
 * of {@link registerRoutes}.
 */
export type RouteRegistrar = (app: Application) => void;

let registrar: RouteRegistrar | undefined;

/**
 * Register a cloud composition root's route-mounting callback. The latest
 * call wins.
 */
export function registerRoutes(fn: RouteRegistrar): void {
  registrar = fn;
}

/** Apply the registered routes onto `app`. No-op when no registrar is set. */
export function applyRegisteredRoutes(app: Application): void {
  registrar?.(app);
}

/**
 * Early-middleware seam (open-core). Same single-slot registrar pattern as
 * {@link registerRoutes}, but applied by `index.ts` BEFORE CORS/identity/CSRF
 * and every router — so a cloud composition root can observe every request
 * (e.g. HTTP timing metrics). With no registrar set it is a no-op and the
 * single-user app is unaffected.
 */
let earlyMiddlewareRegistrar: RouteRegistrar | undefined;

/**
 * Register a cloud composition root's early-middleware callback. The latest
 * call wins.
 */
export function registerEarlyMiddleware(fn: RouteRegistrar): void {
  earlyMiddlewareRegistrar = fn;
}

/** Apply the registered early middleware onto `app`. No-op when unset. */
export function applyRegisteredEarlyMiddleware(app: Application): void {
  earlyMiddlewareRegistrar?.(app);
}

/** Test-only: clear any registered registrar so suites don't leak across tests. */
export function __resetRoutesForTests(): void {
  registrar = undefined;
  earlyMiddlewareRegistrar = undefined;
}
