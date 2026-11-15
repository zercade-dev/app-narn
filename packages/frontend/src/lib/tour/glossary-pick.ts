/**
 * Which glossary the Glossaries tour shows being enabled: one whose terms
 * appear in the project's entries, so enabling it finds matches the person
 * can see. Pure, so the choice is tested without the tab.
 */
import { isComplete, termMatchesText, type Glossary } from '@zercade-dev/narn-shared';

/** Picked when no glossary matches anything: everyday words most projects can use. */
export const FALLBACK_GLOSSARY_ID = 'genshin-phrases';

export interface GlossaryPick {
  id: string;
  name: string;
  /** Entries whose source text contains one of its usable terms. */
  matches: number;
  enabled: boolean;
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

export function countMatches(
  glossary: Glossary,
  sourceTexts: readonly string[],
  targetLanguages: string[],
): number {
  const terms = usableTerms(glossary, targetLanguages);
  return sourceTexts.filter((text) => terms.some((term) => termMatchesText(term, text))).length;
}

/**
 * A glossary not yet enabled comes first: the tour enables it. Among those,
 * the one matching the most entries (list order breaks a tie); with no
 * matches anywhere, Common Phrases, else the first one. When every glossary
 * is already enabled, the one with the most matches, shown as already on.
 */
export function pickTourGlossary(
  glossaries: readonly Glossary[],
  sourceTexts: readonly string[],
  targetLanguages: string[],
): GlossaryPick | null {
  const scored = glossaries.map((g) => ({
    id: g.id,
    name: g.name,
    matches: countMatches(g, sourceTexts, targetLanguages),
    enabled: g.enabled !== false,
  }));
  const best = (list: GlossaryPick[]) =>
    list.reduce<GlossaryPick | null>((top, g) => (top && top.matches >= g.matches ? top : g), null);
  const off = scored.filter((g) => !g.enabled);
  const bestOff = best(off);
  if (bestOff && bestOff.matches > 0) return bestOff;
  if (off.length > 0) return off.find((g) => g.id === FALLBACK_GLOSSARY_ID) ?? off[0] ?? null;
  return best(scored);
}
