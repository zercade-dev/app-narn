/**
 * Which glossary the Glossaries tour shows being enabled: one whose terms
 * appear in the project's entries, so enabling it finds matches the person
 * can see. Pure, so the choice is tested without the tab.
 */
import { glossaryScanText, isComplete, type Glossary } from '@zercade-dev/narn-shared';
import { matchesAny, termMatchers } from '../glossary-match.js';

/** Picked when no glossary matches anything: everyday words most projects can use. */
export const FALLBACK_GLOSSARY_ID = 'genshin-phrases';

export interface GlossaryPick {
  id: string;
  name: string;
  /** Entries whose source text contains one of its usable terms. */
  matches: number;
  enabled: boolean;
}

export interface PickOptions {
  /**
   * The tour resumes past its enable step: it shows a glossary that is on
   * already, the one the person enabled in it (`enabledId`) while that one
   * still is, else the one on with the most matches.
   */
  resumedPastEnable?: boolean;
  /** The glossary the person enabled in an earlier visit to the tour. */
  enabledId?: string | null;
}

/**
 * The terms the glossary actually applies: a read-only glossary leaves out
 * terms missing a translation for one of the project's target languages
 * (constant terms excepted), as the tab and the server do.
 */
function usableTerms(glossary: Glossary, targetLanguages: string[]): string[] {
  return glossary.terms
    .filter((t) => !glossary.readOnly || t.constant || isComplete(t, targetLanguages))
    .map((t) => t.source);
}

/** Of `scanTexts` (already `glossaryScanText`ed), how many hold one of `matchers`. */
function countScanned(matchers: readonly RegExp[], scanTexts: readonly string[]): number {
  if (matchers.length === 0) return 0;
  let n = 0;
  for (const text of scanTexts) if (matchesAny(matchers, text)) n++;
  return n;
}

export function countMatches(
  glossary: Glossary,
  sourceTexts: readonly string[],
  targetLanguages: string[],
): number {
  return countScanned(
    termMatchers(usableTerms(glossary, targetLanguages)),
    sourceTexts.map(glossaryScanText),
  );
}

/**
 * A glossary not yet enabled comes first: the tour enables it. Among those,
 * the one matching the most entries (list order breaks a tie); with no
 * matches anywhere, Common Phrases, else the first one. When every glossary
 * is already enabled, the one with the most matches, shown as already on.
 * Resumed past the enable step, one already on (see {@link PickOptions}).
 */
export function pickTourGlossary(
  glossaries: readonly Glossary[],
  sourceTexts: readonly string[],
  targetLanguages: string[],
  { resumedPastEnable = false, enabledId = null }: PickOptions = {},
): GlossaryPick | null {
  // Placeholders stripped once per text, not once per text per term.
  const scanTexts = sourceTexts.map(glossaryScanText);
  const scored = glossaries.map((g) => ({
    id: g.id,
    name: g.name,
    matches: countScanned(termMatchers(usableTerms(g, targetLanguages)), scanTexts),
    enabled: g.enabled !== false,
  }));
  const best = (list: GlossaryPick[]) =>
    list.reduce<GlossaryPick | null>((top, g) => (top && top.matches >= g.matches ? top : g), null);
  if (resumedPastEnable) {
    const on = scored.filter((g) => g.enabled);
    const theirs = on.find((g) => g.id === enabledId) ?? best(on);
    if (theirs) return theirs;
  }
  const off = scored.filter((g) => !g.enabled);
  const bestOff = best(off);
  if (bestOff && bestOff.matches > 0) return bestOff;
  if (off.length > 0) return off.find((g) => g.id === FALLBACK_GLOSSARY_ID) ?? off[0] ?? null;
  return best(scored);
}
