/**
 * Registry of all global read-only glossaries.
 *
 * Global glossaries are shared across every project and served directly from
 * this module — they are never written to project directories.
 *
 * ## Adding a new global glossary
 *
 * 1. Create a JSON file in this directory following `glossary-template.schema.json`.
 * 2. Add one import line below and one entry to the `registry` array.
 *    That's it — no other TypeScript file needs to change.
 */
import type { Glossary } from '@zercade-dev/narn-shared';
import genshinCreationsData from './genshin-creations.json' with { type: 'json' };
import genshinCreationFactionsData from './genshin-creation-factions.json' with { type: 'json' };
import genshinElementsData from './genshin-elements.json' with { type: 'json' };
import genshinDefaultData from './genshin-default.json' with { type: 'json' };
import genshinPhrasesData from './genshin-phrases.json' with { type: 'json' };
import genshinStatsData from './genshin-stats.json' with { type: 'json' };
import genshinSkillsData from './genshin-skills.json' with { type: 'json' };
import genshinReactionsData from './genshin-reactions.json' with { type: 'json' };
import genshinNationsData from './genshin-nations.json' with { type: 'json' };
import genshinRanksData from './genshin-ranks.json' with { type: 'json' };
import genshinCharactersData from './genshin-characters.json' with { type: 'json' };
import milistraDictData from './miliastra-terms.json' with { type: 'json' };

/** A global glossary template — has no projectId of its own. */
export type GlobalGlossaryTemplate = Omit<Glossary, 'projectId'>;

const registry: GlobalGlossaryTemplate[] = [
  genshinElementsData as GlobalGlossaryTemplate,
  genshinStatsData as GlobalGlossaryTemplate,
  genshinSkillsData as GlobalGlossaryTemplate,
  genshinReactionsData as GlobalGlossaryTemplate,
  genshinNationsData as GlobalGlossaryTemplate,
  genshinRanksData as GlobalGlossaryTemplate,
  genshinCharactersData as GlobalGlossaryTemplate,
  genshinCreationsData as GlobalGlossaryTemplate,
  genshinCreationFactionsData as GlobalGlossaryTemplate,
  genshinDefaultData as GlobalGlossaryTemplate,
  genshinPhrasesData as GlobalGlossaryTemplate,
  milistraDictData as GlobalGlossaryTemplate,
];

/** IDs of all registered global glossaries. */
export const globalGlossaryIds: ReadonlySet<string> = new Set(registry.map((g) => g.id));

/**
 * Return a global glossary projected into a specific project context.
 * Returns `undefined` when no global glossary exists for the given id.
 */
export function getGlobalGlossary(id: string, projectId: string): Glossary | undefined {
  const template = registry.find((g) => g.id === id);
  if (!template) return undefined;
  return { ...template, terms: [...template.terms], projectId, enabled: false };
}

/**
 * Return all global glossaries projected into a specific project context.
 */
export function listGlobalGlossaries(projectId: string): Glossary[] {
  return registry.map((template) => ({
    ...template,
    terms: [...template.terms],
    projectId,
    enabled: false,
  }));
}
