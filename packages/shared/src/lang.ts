import { LANGUAGE_REGISTRY } from './types/language.js';

/**
 * Human-readable language names keyed by the language code used throughout the
 * project. Codes follow `LANGUAGE_REGISTRY` (e.g. `en`, `zh-hans`, `pt-br`).
 * The record is frozen at module load so callers can safely treat it as
 * read-only.
 */
export const LANG_NAMES: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(LANGUAGE_REGISTRY.map((l) => [l.code, l.name])),
);
