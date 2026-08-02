/**
 * Canonical loopback host/hostname allow-list shared by the security
 * middleware (host-guard, csrf-guard). Keeping a single source of truth
 * prevents the guards from drifting out of sync.
 */
export const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

/** Returns true if `hostname` is a loopback name (case-insensitive). */
export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}
