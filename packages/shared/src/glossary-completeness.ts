/**
 * Glossary-term completeness helpers.
 *
 * Used to auto-ignore incomplete terms in READ-ONLY glossaries (typically the
 * global/shared reference glossaries under
 * `server/src/data/global-glossaries/`, but any glossary with `readOnly:
 * true` qualifies): a read-only glossary's terms are only surfaced/used once
 * every one of the project's configured target languages has a non-empty
 * translation. Editable (non-read-only) glossaries are unaffected — they keep
 * showing/using every term regardless of completeness, same as before this
 * helper existed.
 */
import type { GlossaryTerm } from './types/glossary.js';
import type { Project } from './types/project.js';
import { PSEUDO_LANGUAGE_CODE } from './types/language.js';

/**
 * The project's configured target languages for completeness purposes: every
 * active language except the source language and the synthetic pseudo-test
 * language (which never carries a real glossary translation — M7 special-cases
 * pseudo jobs so they never reach glossary lookups at all).
 */
export function projectTargetLanguages(
  project: Pick<Project, 'activeLanguages' | 'sourceLanguage'>,
): string[] {
  return project.activeLanguages.filter(
    (l) => l !== project.sourceLanguage && l !== PSEUDO_LANGUAGE_CODE,
  );
}

/**
 * Whether `term` has a non-empty translation for every one of `targetLanguages`.
 * An empty `targetLanguages` list is vacuously complete (nothing to check).
 */
export function isComplete(term: GlossaryTerm, targetLanguages: string[]): boolean {
  return targetLanguages.every((lang) => {
    const v = term.translations[lang];
    return typeof v === 'string' && v.length > 0;
  });
}
