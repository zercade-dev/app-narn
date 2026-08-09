import type { LogEntry } from './types.js';
import { LOG_PRESENTERS } from './registry.js';

/**
 * A run of adjacent, equivalent entries shown as one row. `count` keeps
 * counting past the retained-member cap, so the badge stays truthful for a
 * flood without pinning every entry.
 */
export interface LogGroup {
  head: LogEntry;
  count: number;
  members: LogEntry[];
}

export const MAX_GROUP_MEMBERS = 50;

/**
 * Identity for folding. Entries carrying a stack get a unique signature: each
 * stack differs, so collapsing them would hide the only detail that matters.
 */
export function groupSignature(entry: LogEntry): string {
  if (entry.metadata?.stack) return `unique ${entry.id}`;
  const presenter = LOG_PRESENTERS[entry.message];
  const extra = presenter?.groupKey?.(entry.metadata ?? {}) ?? '';
  return `${entry.level} ${entry.message} ${extra}`;
}

/**
 * Fold runs of adjacent equivalent entries. Adjacent-only: cheap,
 * order-preserving, and a group is always a contiguous slice of the timeline.
 */
export function groupEntries(entries: LogEntry[]): LogGroup[] {
  const groups: LogGroup[] = [];
  let currentSignature: string | null = null;
  for (const entry of entries) {
    const signature = groupSignature(entry);
    const last = groups[groups.length - 1];
    if (last && signature === currentSignature) {
      last.count += 1;
      if (last.members.length < MAX_GROUP_MEMBERS) last.members.push(entry);
      continue;
    }
    groups.push({ head: entry, count: 1, members: [entry] });
    currentSignature = signature;
  }
  return groups;
}
