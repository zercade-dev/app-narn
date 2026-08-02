/**
 * Single indirection for SPA-level auth redirects (cloud mode). Wrapping
 * `window.location.assign` here lets the fetch interceptor stay testable —
 * tests mock this module and assert the target without navigating jsdom.
 *
 * INERT IN OPEN-CORE: the interceptor only calls these targets on cloud-only
 * response bodies (`unauthenticated` → /login, `device-not-enrolled` → /vault),
 * which the open-core server never sends; `/login` and `/vault` exist only in
 * cloud mode.
 */
export function redirectTo(path: string): void {
  globalThis.location.assign(path);
}

/**
 * Cloud mode: navigates to the /vault device-enrollment/unlock page, carrying
 * a same-origin `?return=` so the user lands back where they were. Shared by
 * VaultUnlockDialog's setup-redirect button and WelcomeView's "Set up vault"
 * button so the target URL is built in exactly one place.
 */
export function goToVaultSetup(): void {
  redirectTo('/vault?return=' + encodeURIComponent(location.pathname + location.search));
}

/**
 * Cloud sign-out: best-effort clear of the session + refresh cookies via the
 * cloud composition root's POST /auth/logout (a /auth/* route, NOT under
 * /api — so a plain fetch, not apiRequest), then navigate to the login page.
 * The redirect runs even when the POST fails, so a network error never
 * strands a signed-out user. Inert in open-core (no /auth/logout or /login
 * there).
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/auth/logout', { method: 'POST' });
  } catch {
    // best-effort — redirect regardless
  }
  redirectTo('/login');
}
