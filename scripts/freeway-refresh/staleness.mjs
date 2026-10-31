/**
 * Staleness check for the bundled free-tier snapshot, printed by release-prep.
 *
 * Local only: reads the snapshot and asks git for its last commit, never the
 * network, and never fails the caller. The live check is `make freeway-refresh`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SNAPSHOT_PATH = 'packages/shared/src/freeway/free-tier-data.json';
const MAX_AGE_DAYS = 30;
const DAY_MS = 86_400_000;

function ageInDays(value, now) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : (now.getTime() - time) / DAY_MS;
}

/**
 * Fresh if the later of lastCheckedAt and generatedAt is recent. The file's last
 * commit only counts when neither date is readable, since unrelated edits to the
 * snapshot say nothing about whether the model list was checked.
 *
 * @param {{generatedAt: unknown, lastCheckedAt?: unknown, lastChange: string | null, now: Date}} input
 * @returns {string | null} the warning, or null when the snapshot is recent.
 */
export function freeTierStalenessWarning({ generatedAt, lastCheckedAt, lastChange, now }) {
  const dated = [lastCheckedAt, generatedAt]
    .filter((value) => typeof value === 'string' && ageInDays(value, now) !== undefined)
    .sort((a, b) => ageInDays(a, now) - ageInDays(b, now));
  const latest =
    dated[0] ?? (lastChange && ageInDays(lastChange, now) !== undefined ? lastChange : undefined);
  if (latest !== undefined && ageInDays(latest, now) <= MAX_AGE_DAYS) return null;
  const problem =
    latest === undefined
      ? 'its dates cannot be read'
      : `it was last checked or changed on ${latest.slice(0, 10)}`;
  return (
    `Warning: the Freeway free-tier snapshot may be stale (older than ${MAX_AGE_DAYS} days): ` +
    `${problem}. Run \`make freeway-refresh\` to check it against the providers.`
  );
}

function lastCommitDate() {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', SNAPSHOT_PATH], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Prints the warning if there is one. Resolves paths from cwd, like release-prep. */
export function warnIfFreeTierStale(now = new Date()) {
  try {
    const { generatedAt, lastCheckedAt } = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    const warning = freeTierStalenessWarning({
      generatedAt,
      lastCheckedAt,
      lastChange: lastCommitDate(),
      now,
    });
    if (warning) console.warn(`\n${warning}`);
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    console.warn(
      `\nWarning: could not read ${SNAPSHOT_PATH} to check its age. Run \`make freeway-refresh\`.`,
    );
  }
}
