import type { Request } from 'express';
import { isTrustProxyClientIp, getProxyClientIpHeader, getTrustedProxyIps } from '../config/env.js';

/**
 * The true client IP, used as the rate-limit / lockout key.
 *
 * Behind a CDN or reverse proxy the socket peer is the edge, so the real client
 * arrives in a header (`PROXY_CLIENT_IP_HEADER`; the unset default matches
 * one CDN's specific spelling, not every proxy's).
 * Any header is forgeable by whoever can reach the origin directly, so it is
 * honored ONLY when BOTH hold:
 *   1. `TRUST_PROXY_CLIENT_IP=1`, AND
 *   2. the request's immediate socket peer (`req.socket.remoteAddress`) matches an
 *      entry in `TRUSTED_PROXY_IPS` — the operator's comma-separated list of the
 *      proxy's egress IPs/CIDRs.
 *
 * The peer check is the load-bearing half. Without it a directly reachable origin
 * would let a forged header set an arbitrary client identity, which is the key for
 * lockout and rate-limit buckets. The two settings are coupled by design:
 * `TRUST_PROXY_CLIENT_IP` alone grants nothing.
 *
 * When the header is not honored we return the socket peer itself — never a raw
 * `X-Forwarded-For` or an unverified proxy header, both of which are caller-controlled.
 */
export function clientIp(req: Request): string {
  const peer = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  if (isTrustProxyClientIp() && isTrustedProxyPeer(req.socket?.remoteAddress)) {
    const forwarded = req.headers?.[getProxyClientIpHeader()];
    if (typeof forwarded === 'string' && forwarded.trim() !== '') return forwarded.trim();
  }
  return peer;
}

/**
 * True when `peer` (the immediate socket address) matches an entry in
 * `TRUSTED_PROXY_IPS` (comma-separated IPs/CIDRs, IPv4 or IPv6). Unset/empty →
 * false (no peer is ever trusted, so the proxy header is never honored). Read
 * fresh each call so tests can stub the env; the list is tiny.
 */
function isTrustedProxyPeer(peer: string | undefined): boolean {
  if (!peer) return false;
  const raw = getTrustedProxyIps();
  if (!raw) return false;
  for (const entry of raw.split(',')) {
    const cidr = entry.trim();
    if (cidr !== '' && ipMatchesCidr(peer, cidr)) return true;
  }
  return false;
}

/**
 * Dependency-free CIDR / single-IP match (IPv4 + IPv6). `cidr` may be a bare
 * address (treated as a /full-length match) or `addr/prefix`. Returns false for
 * any malformed input or a family mismatch rather than throwing — a bad
 * `TRUSTED_PROXY_IPS` entry must never widen trust or crash the request path.
 *
 * IPv4-mapped IPv6 peers (`::ffff:a.b.c.d`, what Node reports for a v4 socket on a
 * dual-stack listener) are normalized to their dotted-quad before matching, so an
 * IPv4 CIDR matches them.
 */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const slash = cidr.indexOf('/');
  const network = slash === -1 ? cidr : cidr.slice(0, slash);
  const prefixStr = slash === -1 ? undefined : cidr.slice(slash + 1);

  const ipBytes = ipToBytes(normalizeMapped(ip));
  const netBytes = ipToBytes(normalizeMapped(network));
  if (!ipBytes || !netBytes || ipBytes.length !== netBytes.length) return false;

  const fullBits = ipBytes.length * 8;
  let prefix = fullBits;
  if (prefixStr !== undefined) {
    if (!/^\d+$/.test(prefixStr)) return false;
    prefix = Number(prefixStr);
    if (prefix > fullBits) return false;
  }

  let bitsLeft = prefix;
  for (let i = 0; i < ipBytes.length && bitsLeft > 0; i++) {
    const take = Math.min(8, bitsLeft);
    const mask = take === 8 ? 0xff : (0xff << (8 - take)) & 0xff;
    if ((ipBytes[i] & mask) !== (netBytes[i] & mask)) return false;
    bitsLeft -= take;
  }
  return true;
}

/** Strip an IPv4-mapped-IPv6 prefix so `::ffff:1.2.3.4` is matched as IPv4. */
function normalizeMapped(addr: string): string {
  const m = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(addr);
  return m ? m[1] : addr;
}

/** Parse a v4 or v6 address into its raw bytes (4 or 16), or null if malformed. */
function ipToBytes(addr: string): Uint8Array | null {
  if (addr.includes(':')) return ipv6ToBytes(addr);
  if (addr.includes('.')) return ipv4ToBytes(addr);
  return null;
}

function ipv4ToBytes(addr: string): Uint8Array | null {
  const parts = addr.split('.');
  if (parts.length !== 4) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    if (!/^\d{1,3}$/.test(parts[i])) return null;
    const n = Number(parts[i]);
    if (n > 255) return null;
    out[i] = n;
  }
  return out;
}

function ipv6ToBytes(addr: string): Uint8Array | null {
  // Reject more than one `::` (zero-run elision can appear at most once).
  const halves = addr.split('::');
  if (halves.length > 2) return null;

  const expand = (s: string): string[] => (s === '' ? [] : s.split(':'));
  const head = expand(halves[0]);
  const tail = halves.length === 2 ? expand(halves[1]) : [];

  let groups: string[];
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array.from({ length: fill }, () => '0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const g = groups[i];
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    const n = Number.parseInt(g, 16);
    out[i * 2] = (n >> 8) & 0xff;
    out[i * 2 + 1] = n & 0xff;
  }
  return out;
}
