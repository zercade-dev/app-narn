/**
 * Pure window/reset arithmetic for Freeway quota buckets. Minute windows
 * (rpm/tpm) are zone-independent; day and month windows follow the
 * provider's reset time zone from the free-tier snapshot.
 */
import type { FreewayWindowKind } from './free-tier-snapshot.js';

const MINUTE_MS = 60_000;

/** Y/M/D of `at` as observed in `timeZone`. */
function zonedDate(at: number, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(at));
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/**
 * Epoch ms of local midnight (y, m, d in `timeZone`). Computed by probing:
 * start from the UTC timestamp of that Y/M/D and shift by the zone offset,
 * iterating twice to absorb DST-boundary offset changes.
 */
function zonedMidnightUtc(y: number, m: number, d: number, timeZone: string): number {
  let guess = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 2; i++) {
    const seen = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const get = (type: string): number =>
      Number(seen.find((p) => p.type === type)?.value ?? Number.NaN);
    const dayDeltaMs = Date.UTC(get('year'), get('month') - 1, get('day')) - Date.UTC(y, m - 1, d);
    const deltaMs = dayDeltaMs + (get('hour') * 60 + get('minute')) * MINUTE_MS;
    guess -= deltaMs;
    if (deltaMs === 0) break;
  }
  return guess;
}

export function windowStart(kind: FreewayWindowKind, at: number, timeZone: string): number {
  switch (kind) {
    case 'rpm':
    case 'tpm':
      return Math.floor(at / MINUTE_MS) * MINUTE_MS;
    case 'rpd': {
      const { y, m, d } = zonedDate(at, timeZone);
      return zonedMidnightUtc(y, m, d, timeZone);
    }
    case 'monthly_chars': {
      const { y, m } = zonedDate(at, timeZone);
      return zonedMidnightUtc(y, m, 1, timeZone);
    }
  }
}

export function nextReset(kind: FreewayWindowKind, at: number, timeZone: string): number {
  switch (kind) {
    case 'rpm':
    case 'tpm':
      return windowStart(kind, at, timeZone) + MINUTE_MS;
    case 'rpd': {
      const { y, m, d } = zonedDate(at, timeZone);
      return zonedMidnightUtc(y, m, d + 1, timeZone);
    }
    case 'monthly_chars': {
      const { y, m } = zonedDate(at, timeZone);
      return zonedMidnightUtc(y, m + 1, 1, timeZone);
    }
  }
}
