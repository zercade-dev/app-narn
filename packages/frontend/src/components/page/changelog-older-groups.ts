/**
 * Pure helper for the changelog's "older" tier: groups consecutive loaded
 * rows (newest-first) that share a release date under one day block — the
 * same idea as ChangelogView's `buildBlocks` for the recent tier, but
 * scoped to loaded rows only (pending/error rows stay flat in
 * ChangelogView itself; their transient state shouldn't split a day
 * group). Rows with no parsed date (legacy un-backfilled entries) collect
 * into a single trailing `date: null` group instead of each splitting the
 * grouping on their own.
 */

export interface OlderRow {
  version: string;
  date: string | undefined;
}

export interface OlderDayGroup {
  date: string | null;
  rows: OlderRow[];
}

/** Groups consecutive rows by day (input is newest-first); date-less rows go last. */
export function buildOlderDayGroups(rows: OlderRow[]): OlderDayGroup[] {
  const dated: OlderDayGroup[] = [];
  const undated: OlderRow[] = [];
  for (const row of rows) {
    if (!row.date) {
      undated.push(row);
      continue;
    }
    const last = dated[dated.length - 1];
    if (last && last.date === row.date) {
      last.rows.push(row);
    } else {
      dated.push({ date: row.date, rows: [row] });
    }
  }
  return undated.length ? [...dated, { date: null, rows: undated }] : dated;
}
