/**
 * Shared config-coercion + baseURL-validation helpers for the AI SDK provider
 * layer. First written inline in the generic-ai module, lifted here as the
 * single canonical definition — generic-ai (and any other module/server
 * consumer) imports these rather than keeping local copies.
 */

/**
 * Loopback hosts that are exempt from the plain-HTTP rejection in
 * {@link validateBaseURL} (e.g. a local Ollama / LM Studio endpoint). Stored
 * de-bracketed so an IPv6 literal like `[::1]` and its bare form `::1` both
 * match the de-bracketed hostname.
 */
export const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * True for cloud-metadata / link-local / unique-local hosts that a server-side
 * request must not reach (SSRF): the AWS/GCP/Azure metadata IP `169.254.169.254`
 * and the rest of the IPv4 link-local block `169.254.0.0/16`, the GCP metadata
 * hostname, the unspecified address `0.0.0.0`, and IPv6 link-local (`fe80::/10`)
 * / unique-local (`fc00::/7`) ranges. `host` is expected de-bracketed + lowercased
 * (as {@link validateBaseURL} produces). Loopback is intentionally NOT covered
 * here — it is the supported local-LLM endpoint and is allow-listed separately.
 *
 * Spellings: the WHATWG URL parser canonicalises hosts before this check, so the
 * denylist must catch every canonical form of the addresses it intends to block —
 * a trailing-dot FQDN (`metadata.google.internal.`), the IPv6 unspecified address
 * `::` (sibling of `0.0.0.0`), and the IPv4-mapped-IPv6 / NAT64 spelling of the
 * link-local block (e.g. `::ffff:a9fe:a9fe`), folded to the embedded IPv4 by
 * {@link canonicalizeMappedIpv4Host}, not only the bare IPv4/hostname forms.
 */
/**
 * Canonicalize an IPv4-mapped-IPv6 (`::ffff:a.b.c.d`) or NAT64
 * (`64:ff9b::a.b.c.d`) host down to the embedded 32-bit IPv4 as dotted-decimal,
 * so the dotted-decimal range checks ({@link isPrivateOrCgnatHost} /
 * {@link isInternalHost}) catch it. The WHATWG URL parser compresses these to
 * their hex spelling (e.g. `http://[::ffff:10.0.0.1]` → `::ffff:a00:1`,
 * `http://[64:ff9b::10.0.0.1]` → `64:ff9b::a00:1`), which no dotted regex matched
 * — so the embedded private/CGNAT/metadata address slipped past the SSRF guard.
 * Both prefixes place the embedded IPv4 in the final two hextets; this reads
 * those out (whether the parser left them dotted or, as it normally does,
 * compressed to hex) and renders the dotted form. A host that is not one of
 * these mapped forms is returned UNCHANGED, so plain dotted-decimal, hostnames,
 * loopback (`::1`), the unspecified address (`::`), and IPv6 link-local/ULA all
 * pass through untouched. `host` is expected de-bracketed + lowercased.
 */
export function canonicalizeMappedIpv4Host(host: string): string {
  // Embedded as dotted-decimal (the parser sometimes preserves this spelling).
  // The third prefix `::` is the deprecated IPv4-COMPATIBLE IPv6 form
  // (`::a.b.c.d`, no `ffff`) the parser also accepts and compresses; it embeds
  // the IPv4 in the same trailing two hextets as the mapped/NAT64 forms.
  const dotted = host.match(/^(?:::ffff:|::|64:ff9b::)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return dotted[1];
  // Embedded as the two trailing hex hextets (the parser's usual canonical form).
  // The `::` branch requires TWO colon-separated hextets after the prefix, so
  // loopback `::1` (rest `1`, no colon) and the unspecified address `::` (no
  // trailing hextets) do NOT match here and are returned unchanged.
  const hex = host.match(/^(?:::ffff:|::|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
  }
  return host;
}

export function isInternalHost(host: string): boolean {
  // A FQDN trailing dot resolves identically but dodges an exact compare.
  const stripped = host.endsWith('.') ? host.slice(0, -1) : host;
  // Fold IPv4-mapped-IPv6 / NAT64 down to the embedded IPv4 so the dotted-decimal
  // checks below catch e.g. the metadata IP spelled `::ffff:a9fe:a9fe` /
  // `64:ff9b::169.254.169.254`. A non-mapped host is returned unchanged.
  const h = canonicalizeMappedIpv4Host(stripped);
  if (h === 'metadata.google.internal') return true;
  // Unspecified address in both families: IPv4 0.0.0.0 and IPv6 `::`.
  if (h === '0.0.0.0' || h === '::') return true;
  // IPv4 link-local 169.254.0.0/16 (includes the cloud metadata IP).
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  // IPv6 link-local fe80::/10 (fe80–febf) and unique-local fc00::/7 (fc/fd).
  if (/^fe[89ab][0-9a-f]:/.test(h) || /^f[cd][0-9a-f]{2}:/.test(h)) return true;
  return false;
}

/**
 * Coerce a boolean-ish config value to a real boolean. Per-project config is
 * persisted as a record of unknowns, so a UI toggle can arrive as the string
 * "true"/"false". Treat literal `true` and the string "true" as true; anything
 * else (false, "false", undefined, other) as false — matching a `=== true` check
 * while also accepting the stringified form.
 */
export function coerceBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

/**
 * Coerce a boolean-ish config value to a real boolean, defaulting to `true`.
 * The inverse of {@link coerceBoolean}: only an explicit `false`/"false" is
 * false; an omitted value (and anything else) is true. For config fields whose
 * documented manifest default is `true` (e.g. generic-ai's `free`), so the
 * default-true intent reads at the call site instead of as an inline negation
 * that looks like the default-false {@link coerceBoolean}.
 */
export function coerceBooleanDefaultTrue(value: unknown): boolean {
  return value !== false && value !== 'false';
}

/**
 * Operator escape hatch (ENVIRONMENT-ONLY) for allowing a link-local/metadata
 * baseURL host past the SSRF guard in {@link validateBaseURL}.
 *
 * SECURITY: this override is deliberately NOT sourced from module config. A
 * per-project / global-config blob can arrive from an untrusted import, restore,
 * or bulk `PUT` (its `config` is an open `record(string, unknown)`), so reading
 * the override from that same blob would let the data being imported turn off
 * the SSRF guard for the baseURL it ships alongside. Sourcing it from the
 * environment means only the machine operator — never imported data — can widen
 * the guard.
 *
 * Read via `globalThis` so this is type-safe without @types/node in scope and
 * inert if the module is ever bundled into a non-Node (frontend) context, where
 * `process` is undefined.
 */
export function operatorAllowsInternalLLMHosts(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.ALLOW_INTERNAL_LLM_HOSTS === 'true';
}

/**
 * True for IPv4 RFC-1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`,
 * `192.168.0.0/16`) and CGNAT (`100.64.0.0/10`). Unlike {@link isInternalHost}
 * these are LEGITIMATE targets on a self-hosted single-user box (a LAN Ollama /
 * LM Studio), so they are NOT always blocked — {@link validateBaseURL} rejects
 * them only in a multi-tenant cloud deployment (see {@link cloudDeploymentActive}),
 * where a tenant-configured baseURL could otherwise reach services on the
 * internal network. `host` is expected de-bracketed + lowercased.
 */
export function isPrivateOrCgnatHost(host: string): boolean {
  const stripped = host.endsWith('.') ? host.slice(0, -1) : host;
  // Fold IPv4-mapped-IPv6 / NAT64 down to the embedded IPv4 so the dotted-decimal
  // range checks catch a private/CGNAT host spelled `::ffff:a00:1` /
  // `64:ff9b::10.0.0.5`. A non-mapped host is returned unchanged.
  const h = canonicalizeMappedIpv4Host(stripped);
  // 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  // 172.16.0.0/12 (second octet 16–31)
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  // 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  // CGNAT 100.64.0.0/10 (second octet 64–127)
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

/**
 * The shared-layer proxy for `isCloudMode()`. The server's identity registry
 * (which owns the canonical `isCloudMode()`) must NOT be imported here — this is
 * the lowest layer — so the deployment announces itself with a single explicit
 * signal, `CLOUD_MULTI_TENANT`, set by whatever composition root runs the app in
 * a multi-tenant configuration.
 *
 * When set, a tenant-configured baseURL could otherwise reach services on the
 * internal network, so RFC-1918 / CGNAT egress is refused and redirect targets
 * are re-resolved before each hop. Read via `globalThis` so this stays type-safe
 * without @types/node and inert if bundled into a non-Node context.
 */
export function cloudDeploymentActive(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return Boolean(env?.CLOUD_MULTI_TENANT?.trim());
}

/**
 * The single SSRF decision for an already-de-bracketed + lowercased host: returns
 * a human-readable reason fragment when the host must be refused, or `undefined`
 * when it is allowed. Loopback is always allowed (the supported local-LLM
 * endpoint) and the operator's `ALLOW_INTERNAL_LLM_HOSTS` env override always
 * permits. Otherwise a link-local/metadata host is refused everywhere, and an
 * RFC-1918 / CGNAT host is refused only in a multi-tenant cloud deployment (where
 * a tenant-set target could reach internal services). Shared by
 * {@link validateBaseURL} (literal host) and {@link createSsrfGuardedFetch}
 * (redirect target) so both hold every host to the same rule.
 */
export function ssrfBlockReasonForHost(host: string): string | undefined {
  if (operatorAllowsInternalLLMHosts() || LOOPBACK_HOSTS.has(host)) return undefined;
  if (isInternalHost(host)) return 'is a link-local/metadata address';
  if (cloudDeploymentActive() && isPrivateOrCgnatHost(host)) {
    return 'is a private/CGNAT address in a multi-tenant deployment';
  }
  return undefined;
}

/**
 * Credential / secret request headers that must never ride a CROSS-ORIGIN
 * redirect hop — the BYOK auth token and the per-provider key/version headers
 * (anthropic uses `x-api-key` + any `anthropic-*`, google `x-goog-api-key`,
 * azure/openai-compatible `api-key`, everyone else `authorization`). Lowercased;
 * matched case-insensitively. `anthropic-*` is matched by prefix.
 */
const CREDENTIAL_HEADER_NAMES = new Set([
  'authorization',
  'x-api-key',
  'x-goog-api-key',
  'api-key',
]);

function isCredentialHeader(name: string): boolean {
  const n = name.toLowerCase();
  return CREDENTIAL_HEADER_NAMES.has(n) || n.startsWith('anthropic-');
}

/** A fetch-compatible function (the AI SDK's `FetchFunction` shape). */
export type GuardedFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * Maximum redirect hops to follow before giving up — a small bound that defeats a
 * redirect loop while leaving room for the occasional legitimate hop (e.g. an
 * http→https or trailing-slash bounce). Matches the spirit of the default global
 * fetch's 20-hop ceiling without being unboundedly generous.
 */
const MAX_REDIRECT_HOPS = 5;

/**
 * Resolve a hostname to its IP-address strings. Injectable so the DNS-rebinding
 * guard is unit-testable without real DNS; the default lazily imports
 * `node:dns` (so this module stays bundler-safe for non-Node contexts) and is
 * failure-tolerant — an unresolvable host yields `[]` (nothing to block; the
 * request is left to fail at the socket).
 */
export type HostResolver = (host: string) => Promise<string[]>;

async function defaultResolveHost(host: string): Promise<string[]> {
  try {
    const dns = await import('node:dns/promises');
    const records = await dns.lookup(host, { all: true });
    return records.map((r) => r.address);
  } catch {
    return [];
  }
}

/**
 * DNS-rebinding backstop. {@link validateBaseURL} and the redirect guard vet
 * the host STRING, but the socket re-resolves DNS at connect time — a hostname that
 * passes the string check can still resolve to an internal IP. Before each request
 * this resolves the host and runs every resolved IP through
 * {@link ssrfBlockReasonForHost}, refusing the request if any resolves to a blocked
 * address. Cloud-gated (RFC-1918 is a legitimate LAN target on a single-user local
 * box) and skips loopback / the operator override. This narrows but cannot fully
 * close the sub-second rebind window (the socket re-resolves independently); fully
 * pinning the resolved IP would require a custom undici connect dispatcher.
 */
async function assertResolvedHostSafe(host: string, resolve: HostResolver): Promise<void> {
  if (!cloudDeploymentActive()) return;
  if (operatorAllowsInternalLLMHosts() || LOOPBACK_HOSTS.has(host)) return;
  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    return; // unresolvable → leave it to fail at the socket; do not block
  }
  for (const address of addresses) {
    const ip = address.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
    const reason = ssrfBlockReasonForHost(ip);
    if (reason) {
      throw new Error(
        `Refusing request to "${host}": it resolves to ${address}, which ${reason} ` +
          `and is blocked as an SSRF risk (DNS-rebinding guard).`,
      );
    }
  }
}

/**
 * Wrap a base fetch so it cannot be used to reach an internal/metadata host via a
 * redirect. {@link validateBaseURL} only vets the LITERAL configured baseURL;
 * the AI SDK then drives requests through the DEFAULT global fetch, which FOLLOWS
 * redirects — so a baseURL whose literal host passes can still bounce the request
 * onward, with the BYOK credential header attached, to an internal target. This
 * wrapper closes that TOCTOU gap: every request is issued with
 * `redirect:'manual'`, and on a 3xx the resolved (canonicalized per
 * {@link canonicalizeMappedIpv4Host}) Location host is re-validated through
 * {@link ssrfBlockReasonForHost} BEFORE the hop is followed — an
 * internal/private/metadata target is refused (throws). On a CROSS-ORIGIN
 * redirect the credential/secret headers ({@link isCredentialHeader}) are stripped
 * before following, so a BYOK key is never sent to a host other than the one it
 * was configured for. A non-redirect response (or a body-less 3xx with no
 * Location) is returned unchanged.
 *
 * `baseFetch` defaults to `globalThis.fetch`; pass a fake to unit-test.
 */
export function createSsrfGuardedFetch(
  baseFetch?: GuardedFetch,
  resolveHost: HostResolver = defaultResolveHost,
): GuardedFetch {
  // Resolve the base fetch lazily (per call) when none is injected, so a test that
  // stubs `globalThis.fetch` AFTER this wrapper is built — and the live process,
  // where nothing reassigns it — both see the current global rather than a copy
  // captured at construction time.
  const doFetch: GuardedFetch = (input, requestInit) =>
    (baseFetch ?? (globalThis as { fetch: GuardedFetch }).fetch)(input, requestInit);

  return async function guardedFetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    let currentUrl = input instanceof Request ? input.url : input.toString();
    // Forward the caller's headers in their ORIGINAL shape (plain record, tuple
    // array, or Headers) on the first hop, untouched — the wrapper stays a
    // transparent pass-through when no redirect occurs (the overwhelmingly common
    // case). Only once a cross-origin redirect actually requires stripping do we
    // normalize to a Headers object and drop the credential headers.
    // `RequestInit['headers']` (≡ HeadersInit) avoids relying on the DOM global
    // `HeadersInit` name, which isn't in this package's tsc lib scope.
    let headers: RequestInit['headers'] =
      init?.headers ?? (input instanceof Request ? input.headers : undefined);

    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      // DNS-rebinding backstop: resolve-and-validate the current host before
      // issuing the request, so a hostname that passed the string check but resolves
      // to an internal IP is refused before any connection is made.
      const currentHost = new URL(currentUrl).hostname
        .toLowerCase()
        .replace(/^\[/, '')
        .replace(/\]$/, '');
      // Cloud-gated so the local single-user path keeps its zero-overhead, fully
      // synchronous fetch dispatch (no DNS round-trip, no extra microtask).
      if (cloudDeploymentActive()) {
        await assertResolvedHostSafe(currentHost, resolveHost);
      }

      // redirect:'manual' makes the underlying fetch surface the 3xx instead of
      // transparently following it — that is the whole point of the guard.
      const res = await doFetch(currentUrl, { ...init, headers, redirect: 'manual' });

      // Not a redirect → done. (A 3xx with no Location can't be followed either.)
      const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!location) return res;

      if (hop === MAX_REDIRECT_HOPS) {
        throw new Error(`Too many redirects (>${MAX_REDIRECT_HOPS}) following "${currentUrl}".`);
      }

      // Resolve a relative Location against the current URL, then re-validate.
      const target = new URL(location, currentUrl);
      const targetHost = target.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
      const blocked = ssrfBlockReasonForHost(targetHost);
      if (blocked) {
        throw new Error(
          `Refusing redirect to "${target.hostname}": it ${blocked} and is blocked as an SSRF risk.`,
        );
      }

      // Cross-origin hop → strip the BYOK credential/secret headers so the key is
      // never sent anywhere but its configured origin. Same-origin keeps them.
      const fromOrigin = new URL(currentUrl).origin;
      if (target.origin !== fromOrigin) {
        const next = new Headers();
        new Headers(headers).forEach((value, key) => {
          if (!isCredentialHeader(key)) next.set(key, value);
        });
        headers = next;
      }

      currentUrl = target.toString();
    }

    // Unreachable: the loop always returns or throws within MAX_REDIRECT_HOPS+1
    // iterations. Present so the function is total for the type checker.
    throw new Error('redirect handling exhausted');
  };
}

/**
 * Validate that a custom baseURL is an absolute http(s) URL and does not use
 * plain HTTP for a remote host. localhost / loopback addresses are exempted
 * (e.g. a local Ollama endpoint), as is an explicit `allowInsecureHttp` opt-in.
 * Throws on a relative/unparseable URL, a non-http(s) scheme, or insecure remote
 * HTTP; a falsy `baseURL` is a no-op (use the provider default).
 *
 * The link-local/metadata SSRF block can only be widened by the operator's
 * `ALLOW_INTERNAL_LLM_HOSTS` environment variable (see
 * {@link operatorAllowsInternalLLMHosts}) — never by a caller-supplied flag, so
 * an untrusted config blob cannot disable the guard on its own baseURL.
 *
 * DNS-rebinding: this function vets the literal host STRING, not the address it
 * resolves to. The resolve-then-check backstop lives in
 * {@link createSsrfGuardedFetch}, which re-resolves the host before every request
 * in a multi-tenant deployment. On a single-user local box it is deliberately
 * skipped: the async validation is disproportionate there, and reaching that case
 * already requires control of both the configured baseURL and DNS for its name.
 */
export function validateBaseURL(baseURL: string | undefined, allowInsecureHttp?: boolean): void {
  if (!baseURL) return;

  // The configured apiKey credential is sent as an Authorization header to this
  // URL, so a relative or unparseable value must not slip through to the provider
  // unchecked — reject it here rather than silently letting it be used.
  let url: URL;
  try {
    url = new URL(baseURL);
  } catch {
    throw new Error(`baseURL is not a valid absolute URL: "${baseURL}".`);
  }

  // Only http/https are meaningful for an HTTP API endpoint; reject other schemes
  // (file:, gopher:, …) that could be abused to send the credential elsewhere.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`baseURL must use http(s); got "${url.protocol}".`);
  }

  const host = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');

  // SSRF guard (checked before the scheme rule so an internal host is reported as
  // the real risk regardless of http/https): the configured credential is sent as
  // an Authorization header to this URL, so a mistyped/pasted/IMPORTED endpoint
  // must not be able to reach a cloud metadata / link-local address (e.g.
  // 169.254.169.254) or — in a multi-tenant deployment — an internal RFC-1918 /
  // CGNAT service. The exact same predicate vets redirect targets in
  // {@link createSsrfGuardedFetch}, so both the literal host and any host a
  // 3xx hop points at are held to one rule.
  const blocked = ssrfBlockReasonForHost(host);
  if (blocked) {
    throw new Error(
      `baseURL host "${url.hostname}" ${blocked} and is blocked as an SSRF risk. ` +
        `Set the ALLOW_INTERNAL_LLM_HOSTS=true environment variable (operator-only) to override.`,
    );
  }

  // A `user:pass@host` baseURL embeds the credential in the URL itself, where it
  // would ride into logs / error messages (which bypass the credential masker) and is
  // the wrong channel anyway — the apiKey field carries the secret. Checked AFTER the
  // SSRF guard so a userinfo-obfuscated internal host (e.g.
  // `http://evil.com@169.254.169.254/`) still reports the more important SSRF reason.
  if (url.username || url.password) {
    throw new Error(
      'baseURL must not embed credentials in its userinfo (user:pass@host); ' +
        'put the key in the apiKey field instead.',
    );
  }

  // Plain HTTP to a remote host would expose the credential on the wire. Allowed
  // only for loopback (e.g. a local Ollama endpoint) or when the operator has
  // explicitly opted in via allowInsecureHttp.
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(host) && !allowInsecureHttp) {
    throw new Error(
      `Non-TLS baseURL is not allowed for remote endpoints. Use https:// for "${url.hostname}".`,
    );
  }
}

/**
 * Strip any `user:pass@` userinfo from a URL string so it is safe to log.
 * Defense-in-depth scrub for the bare `console.*` sites in the provider layer
 * (which bypass the M16 credential masker). Returns the input unchanged when it has
 * no userinfo or is not a parseable URL — never throws.
 */
export function redactUrlUserinfo(u: string): string {
  try {
    const url = new URL(u);
    if (!url.username && !url.password) return u;
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return u;
  }
}
