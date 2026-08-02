/**
 * Parse the TRUST_PROXY env var into an Express `trust proxy` setting.
 *
 * Express accepts boolean | number (hop count) | string (IP/CIDR/list or a
 * preset like 'loopback'). Default (unset/empty) is `false` — identical to the
 * former hard-coded `app.set('trust proxy', false)`, so local behavior is
 * unchanged. The cloud parent sets this so `req.secure`/`req.protocol` reflect
 * the proxy's `X-Forwarded-Proto` (which engages the Secure cookie flag).
 * Pair with origin lockdown.
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
  const v = value?.trim();
  if (!v) return false;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}
