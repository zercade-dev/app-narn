/**
 * Assembles the enriched per-entry context the AI generators (M28 glossary,
 * M29 category) optionally add to their prompts. Single source of truth for
 * WHAT context is and HOW it is filtered and bounded; the prompt builders only
 * render the result. Translations are limited to finished records
 * (translated/reviewed).
 */
import type {
  EntryContext,
  EntryContextOptions,
  EntryContextSource,
} from '../types/entry-context.js';

export const MAX_CONTEXT_CHARS = 300;
export const MAX_TRANSLATION_CHARS = 300;
export const MAX_CONTEXT_LABELS = 16;

/** Translation statuses whose text is allowed into the prompt as context. */
const USABLE_TRANSLATION_STATUSES = new Set(['translated', 'reviewed']);

function clamp(text: string, max: number): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

function labels(values: readonly string[] | undefined): string[] {
  return (values ?? [])
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_CONTEXT_LABELS);
}

export function collectEntryContext(
  entry: EntryContextSource,
  opts: EntryContextOptions,
): EntryContext | undefined {
  const out: EntryContext = {};

  if (opts.fields.includes('context')) {
    const ctx = clamp(entry.context ?? '', MAX_CONTEXT_CHARS);
    if (ctx) out.context = ctx;
  }
  if (opts.fields.includes('sources')) {
    const src = labels(entry.sources);
    if (src.length > 0) out.sources = src;
  }
  if (opts.fields.includes('categories')) {
    const cat = labels(entry.categories);
    if (cat.length > 0) out.categories = cat;
  }
  if (opts.languages.length > 0 && entry.translations) {
    const tr: Record<string, string> = {};
    for (const lang of opts.languages) {
      const record = entry.translations[lang];
      if (!record || !USABLE_TRANSLATION_STATUSES.has(record.status)) continue;
      const text = clamp(record.text ?? '', MAX_TRANSLATION_CHARS);
      if (text) tr[lang] = text;
    }
    if (Object.keys(tr).length > 0) out.translations = tr;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}
