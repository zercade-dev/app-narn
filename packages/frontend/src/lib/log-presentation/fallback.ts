import type { LogMeta } from './types.js';

/** `namespace:rest-of-key`, all lowercase — the shape server log keys use. */
const EVENT_KEY_RE = /^[a-z][a-z0-9-]*:[a-z0-9:-]+$/;

/**
 * Human labels for event-key namespaces whose mechanical humanisation reads
 * badly ("Lqa", "Tm"). Anything absent is humanised mechanically.
 */
const NAMESPACE_LABELS: Record<string, string> = {
  'category-gen': 'Category generation',
  'glossary-assign': 'Glossary assignment',
  'glossary-gen': 'Glossary generation',
  'source-review': 'Source review',
  'stage-details': 'Stage details',
  lqa: 'Quality check',
  tm: 'Translation memory',
};

/**
 * Correlation fields that mean nothing to a reader. Hidden from the collapsed
 * row on the fallback path only — a mapped presenter controls its own output,
 * and the expanded row and the export both show everything.
 */
const HIDDEN_META_FIELDS = new Set([
  'runId',
  'entryId',
  'entryIds',
  'jobId',
  'tenantId',
  'requestId',
  'correlationId',
  'sessionId',
  'id',
]);

export function isEventKey(message: string): boolean {
  return EVENT_KEY_RE.test(message);
}

/** `save-suggestions-failed` -> `save suggestions failed`. */
function humanise(segment: string): string {
  return segment.replace(/[:-]/g, ' ').trim();
}

/** `orphan` -> `Orphan`. Only applied to the namespace label, never the rest. */
function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Mechanical, English-only humanisation for an event key with no presenter.
 * Prose messages (client notifications, `Unhandled error`) pass through
 * untouched.
 */
export function fallbackText(message: string): string {
  if (!isEventKey(message)) return message;
  const colon = message.indexOf(':');
  const namespace = message.slice(0, colon);
  const rest = message.slice(colon + 1);
  const label = NAMESPACE_LABELS[namespace] ?? capitalize(humanise(namespace));
  return `${label} — ${humanise(rest)}`;
}

/** Metadata pairs worth showing on a collapsed fallback row. */
export function visibleMeta(meta: LogMeta | undefined): [string, unknown][] {
  if (!meta) return [];
  return Object.entries(meta).filter(([k]) => k !== 'stack' && !HIDDEN_META_FIELDS.has(k));
}
