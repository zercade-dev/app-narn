import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHANGELOG_VERSIONS } from '../guide/changelog-registry.js';
import { splitEntry } from '../guide/changelog-entry.js';
import { renderMarkdown } from '../guide/markdown.js';
import { buildOlderDayGroups } from './changelog-older-groups.js';

const PAGE_SIZE = 5;

const INTRO_MD = `# Changelog

Release history, newest first, grouped by day. See the About Narn tab for the exact build version.`;

type Row =
  | { kind: 'pending'; version: string }
  | { kind: 'error'; version: string }
  | { kind: 'entry'; version: string; date: string | null; highlight: string; detailsMd: string };

type EntryRow = Extract<Row, { kind: 'entry' }>;
type DayBlock = { kind: 'day'; date: string; group: EntryRow[] };

type OlderEntry = { version: string; date: string | null; highlight: string; detailsMd: string };
type OlderPending = { version: string; md: string | null | undefined };

/**
 * Groups consecutive loaded entries that share a date under one day block.
 * Pending/error rows and entries whose header didn't parse pass through as
 * standalone rows (a pending row can transiently split a day while its chunk
 * is still in flight; the blocks merge on the next render once it lands).
 */
function buildBlocks(rows: Row[]): (Row | DayBlock)[] {
  const blocks: (Row | DayBlock)[] = [];
  for (const row of rows) {
    if (row.kind === 'entry' && row.date !== null) {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === 'day' && last.date === row.date) {
        last.group.push(row);
        continue;
      }
      blocks.push({ kind: 'day', date: row.date, group: [row] });
      continue;
    }
    blocks.push(row);
  }
  return blocks;
}

/** `1.2.3 … 1.2.9` (oldest … newest) for a multi-version day, else the single version. */
function versionRange(group: EntryRow[]): string {
  const newest = group[0].version.replace(/^v/, '');
  const oldest = group[group.length - 1].version.replace(/^v/, '');
  return group.length > 1 ? `${oldest} … ${newest}` : newest;
}

/**
 * Changelog page (sidebar Page group). Versions come from the lazy
 * changelog registry — each entry is its own code-split chunk. Two tiers:
 * the newest `PAGE_SIZE` releases render in full immediately (grouped by
 * release day, each entry split into a bold highlight lead + detail
 * bullets via `splitEntry`); everything older folds behind a single
 * "Show older releases" toggle and is only fetched once that toggle opens,
 * rendered as one-line highlight rows that individually re-expand to their
 * own detail bullets.
 */
export function ChangelogView() {
  const { t } = useTranslation('common');
  const recentVersions = CHANGELOG_VERSIONS.slice(0, PAGE_SIZE);
  const olderVersions = CHANGELOG_VERSIONS.slice(PAGE_SIZE);

  // version → markdown, or null when its chunk failed to load; a version
  // missing from the map is still in flight (or not yet requested).
  const [entries, setEntries] = useState<Record<string, string | null>>({});
  const [olderOpen, setOlderOpen] = useState(false);
  const [openOlderRows, setOpenOlderRows] = useState<Set<string>>(new Set());

  // Versions whose chunk has been requested (in flight or landed). A ref, not
  // state: the fetch effects must never re-request an in-flight/landed
  // version when `entries` changes.
  const requestedRef = useRef<Set<string>>(new Set());

  // Recent tier: always fetched, right away — it's a fixed-size slice (never
  // grows), so there's nothing to gate on scroll/visibility.
  useEffect(() => {
    for (const { version, load } of CHANGELOG_VERSIONS.slice(0, PAGE_SIZE)) {
      if (requestedRef.current.has(version)) continue;
      requestedRef.current.add(version);
      load().then(
        (md) => setEntries((prev) => ({ ...prev, [version]: md })),
        () => setEntries((prev) => ({ ...prev, [version]: null })),
      );
    }
  }, []);

  // Older tier: only fetched once the "Show older releases" toggle opens.
  useEffect(() => {
    if (!olderOpen) return;
    for (const { version, load } of CHANGELOG_VERSIONS.slice(PAGE_SIZE)) {
      if (requestedRef.current.has(version)) continue;
      requestedRef.current.add(version);
      load().then(
        (md) => setEntries((prev) => ({ ...prev, [version]: md })),
        () => setEntries((prev) => ({ ...prev, [version]: null })),
      );
    }
  }, [olderOpen]);

  function toggleOlderRow(version: string) {
    setOpenOlderRows((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  }

  const rows: Row[] = recentVersions.map(({ version }) => {
    const md = entries[version];
    if (md === undefined) return { kind: 'pending', version };
    if (md === null) return { kind: 'error', version };
    const { date, highlight, detailsMd } = splitEntry(md);
    return { kind: 'entry', version, date, highlight, detailsMd };
  });

  function renderEntry(row: EntryRow) {
    return (
      <section key={row.version} data-testid={`changelog-entry-${row.version}`}>
        <p className="mt-3 mb-1.5 font-semibold text-foreground">{row.highlight}</p>
        {row.detailsMd !== '' && renderMarkdown(row.detailsMd)}
      </section>
    );
  }

  function renderOlderRow(entry: OlderEntry) {
    const { version, highlight, detailsMd } = entry;
    const hasDetails = detailsMd !== '';
    const rowOpen = openOlderRows.has(version);
    const label = `${version} · ${highlight}`;
    return (
      <li key={version}>
        {hasDetails ? (
          <button
            type="button"
            data-testid={`changelog-older-row-${version}`}
            aria-expanded={rowOpen}
            className="w-full py-1 text-left text-sm hover:text-foreground"
            onClick={() => toggleOlderRow(version)}
          >
            {label}
          </button>
        ) : (
          <p
            className="py-1 text-sm text-foreground/90"
            data-testid={`changelog-older-row-${version}`}
          >
            {label}
          </p>
        )}
        {hasDetails && rowOpen && (
          <div className="pl-4" data-testid={`changelog-older-detail-${version}`}>
            {renderMarkdown(detailsMd)}
          </div>
        )}
      </li>
    );
  }

  // Only loaded rows are day-grouped; pending/error rows are transient (the
  // chunk loads fast) and keep the flat rendering, appended after the
  // groups so they don't jitter the grouping while in flight.
  const olderEntryByVersion = new Map<string, OlderEntry>();
  const olderPending: OlderPending[] = [];
  for (const { version } of olderVersions) {
    const md = entries[version];
    if (md === undefined || md === null) {
      olderPending.push({ version, md });
      continue;
    }
    const { date, highlight, detailsMd } = splitEntry(md);
    olderEntryByVersion.set(version, { version, date, highlight, detailsMd });
  }
  const olderDayGroups = buildOlderDayGroups(
    Array.from(olderEntryByVersion.values()).map(({ version, date }) => ({
      version,
      date: date ?? undefined,
    })),
  );

  return (
    <main className="flex-1 overflow-auto px-6 py-8" data-testid="changelog-view">
      <div className="mx-auto max-w-[72ch]">
        {renderMarkdown(INTRO_MD)}
        {buildBlocks(rows).map((block) => {
          if (block.kind === 'day') {
            return (
              <section
                key={`day-${block.date}-${block.group[0].version}`}
                data-testid={`changelog-day-${block.date}`}
              >
                <h2 className="text-lg font-semibold mt-8 pb-1.5 border-b border-border">
                  {block.date}
                </h2>
                <p
                  className="mt-1.5 text-sm text-muted-foreground"
                  data-testid={`changelog-day-versions-${block.date}`}
                >
                  {versionRange(block.group)}
                </p>
                {block.group.map(renderEntry)}
              </section>
            );
          }
          if (block.kind === 'pending') {
            return (
              <p
                key={block.version}
                className="my-3 text-muted-foreground"
                data-testid={`changelog-loading-${block.version}`}
              >
                {t('loading')}
              </p>
            );
          }
          if (block.kind === 'error') {
            return (
              <p
                key={block.version}
                className="my-3 text-destructive"
                data-testid={`changelog-error-${block.version}`}
              >
                {t('changelogEntryError')}
              </p>
            );
          }
          return renderEntry(block);
        })}
        {olderVersions.length > 0 && (
          <div className="mt-8">
            <button
              type="button"
              data-testid="changelog-older-toggle"
              aria-expanded={olderOpen}
              className="text-sm font-medium text-primary underline underline-offset-2"
              onClick={() => setOlderOpen((open) => !open)}
            >
              {t('changelogShowOlder', { count: olderVersions.length })}
            </button>
            {olderOpen && (
              <div className="mt-3">
                {olderDayGroups.map((group) => (
                  <section
                    key={`older-day-${group.date}-${group.rows[0]?.version ?? 'undated'}`}
                    data-testid={`changelog-older-day-${group.date}`}
                  >
                    <h3 className="mt-4 text-sm font-semibold text-foreground">
                      {group.date ?? '—'}
                    </h3>
                    <ul className="space-y-1.5">
                      {group.rows.map(({ version }) =>
                        renderOlderRow(olderEntryByVersion.get(version)!),
                      )}
                    </ul>
                  </section>
                ))}
                {olderPending.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {olderPending.map(({ version, md }) =>
                      md === undefined ? (
                        <li
                          key={version}
                          className="text-muted-foreground text-sm"
                          data-testid={`changelog-loading-${version}`}
                        >
                          {t('loading')}
                        </li>
                      ) : (
                        <li
                          key={version}
                          className="text-destructive text-sm"
                          data-testid={`changelog-error-${version}`}
                        >
                          {t('changelogEntryError')}
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
