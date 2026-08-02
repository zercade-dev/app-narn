/**
 * Localized "Achievement" origin labels.
 *
 * The game's reference localization export (`other/references/*.csv`) carries a
 * "Source" column that categorizes each string (Tab, Custom Variable,
 * Achievement, UI Control Group, Node Graph, …) — and that column is LOCALIZED
 * per language. On import the Source column becomes {@link StringEntry.sources}.
 *
 * To recognise achievement-origin entries regardless of which language a
 * project's imported source labels are in, this is the set of words that mean
 * "Achievement" across all 15 reference languages, extracted directly from the
 * Source column of the reference CSVs. Matching is case-insensitive.
 *
 * Recognition itself is delegated to the canonical {@link SOURCE_LABELS}
 * catalog (which carries the same "Achievement" variant set, including the
 * singular/plural inflections); this module only exposes the achievement-
 * specific helpers and the per-language display labels.
 */

import { getSourceLabelDef } from './source-labels.js';

/**
 * Canonical (display) forms of the "Achievement" Source label per language,
 * extracted verbatim from the reference CSVs' Source column.
 */
export const ACHIEVEMENT_SOURCE_LABELS: readonly string[] = [
  'Achievement', // English (and Indonesian, which kept the English word)
  '成就', // Simplified & Traditional Chinese
  '업적', // Korean
  'アチーブメント', // Japanese
  'Logros', // Spanish
  'Succès', // French
  'Достижение', // Russian
  'ความสำเร็จ', // Thai
  'Thành Tựu', // Vietnamese
  'Errungenschaften', // German
  'Conquista', // Portuguese
  'Başarım', // Turkish
  'Obiettivi', // Italian
];

/** True when a single source label means "Achievement" (case-insensitive). */
export function isAchievementSourceLabel(source: string): boolean {
  // Recognition is delegated to the canonical {@link SOURCE_LABELS} catalog so
  // the localized "Achievement" variant set (incl. singular/plural inflections)
  // lives in exactly one place; an entry is an achievement origin iff its
  // resolved catalog def is the canonical "Achievement" one.
  return getSourceLabelDef(source)?.en === 'Achievement';
}

/** True when any of an entry's `sources` is a localized "Achievement" label. */
export function isAchievementSource(sources: readonly string[] | undefined): boolean {
  return (sources ?? []).some(isAchievementSourceLabel);
}
