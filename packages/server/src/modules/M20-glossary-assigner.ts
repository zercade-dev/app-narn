import {
  type StringEntry,
  type Glossary,
  toErrorMessage,
  isComplete,
  projectTargetLanguages,
} from '@zercade-dev/narn-shared';
import { getGlossaryStore, getProjectStore } from '../storage/registry.js';
import { logger } from './M15-console-logger.js';
import { wordBoundaryRegExp } from './M10/types.js';

/**
 * Auto-assign applicable glossaries to the provided entries based on source text matching.
 * This should be called whenever new strings are imported or when glossaries are toggled.
 */
export async function assignGlossaryIds(
  projectId: string,
  entries: StringEntry[],
): Promise<{ glossariesSkipped: number }> {
  let glossaries: Glossary[];
  try {
    const glossaryStore = getGlossaryStore();
    const summaries = await glossaryStore.listGlossaries(projectId);
    glossaries = await Promise.all(
      summaries.map((s) => glossaryStore.getGlossary(projectId, s.id)),
    );
  } catch (err) {
    // Best-effort: if glossaries can't be loaded, skip assignment. Control
    // flow is unchanged, but log the load failure instead of silently returning
    // {glossariesSkipped:0} — otherwise a glossary-store outage looks identical to
    // "this project has no glossaries", masking why auto-assignment did nothing.
    logger.warn('glossary-assign:load-failed', {
      projectId,
      error: toErrorMessage(err),
    });
    return { glossariesSkipped: 0 };
  }
  const allCount = glossaries.length;
  glossaries = glossaries.filter((g) => g.enabled !== false);
  const glossariesSkipped = allCount - glossaries.length;
  if (glossaries.length === 0) {
    // No enabled glossary can contribute a match, but a manual assignment is
    // a deliberate override — it survives even here (see manualGlossaryIds's
    // doc comment on StringEntry).
    for (const entry of entries) {
      const manual = entry.manualGlossaryIds ?? [];
      entry.assignedGlossaryIds = manual.length > 0 ? [...manual] : undefined;
    }
    return { glossariesSkipped };
  }

  // Read-only glossaries (global reference glossaries, or any project
  // glossary created with `readOnly: true`) auto-ignore incomplete
  // NON-CONSTANT terms — ones missing a translation for one of the project's
  // configured target languages — so an incomplete term can never drive
  // glossary assignment. Constant (do-not-translate) terms are exempt: they
  // routinely carry no/sparse translations by design and still need to be
  // matchable so the entry gets assigned to the glossary that will mask them.
  // The project is only loaded when a read-only glossary is actually present.
  let targetLanguages: string[] = [];
  if (glossaries.some((g) => g.readOnly)) {
    try {
      targetLanguages = projectTargetLanguages(await getProjectStore().loadProject(projectId));
    } catch (err) {
      // Best-effort: if the project can't be loaded, `targetLanguages` stays
      // empty, which makes `isComplete` vacuously true for every term — i.e.
      // fail OPEN (read-only glossaries behave as before this feature) rather
      // than silently dropping every read-only term's contribution.
      logger.warn('glossary-assign:project-load-failed', {
        projectId,
        error: toErrorMessage(err),
      });
    }
  }

  // Precompile each term's matcher once (O(terms)) instead of per entry × term.
  // The regexes carry no `g`/`y` flag so `.test()` is stateless and reusable.
  // Case-insensitive, Unicode-aware whole-word matching (M10's canonical helper).
  const matchersByGlossary = glossaries.map((g) => {
    const eligibleTerms = g.readOnly
      ? g.terms.filter((t) => t.constant || isComplete(t, targetLanguages))
      : g.terms;
    return {
      id: g.id,
      matchers: eligibleTerms.filter((t) => t.source).map((t) => wordBoundaryRegExp(t.source)),
    };
  });

  for (const entry of entries) {
    const matched: string[] = [];
    for (const g of matchersByGlossary) {
      if (g.matchers.some((re) => re.test(entry.sourceText))) matched.push(g.id);
    }
    // Each glossary contributes its id at most once (one matcher set per
    // glossary), so `matched` is already duplicate-free — no Set needed.
    const manual = [...(entry.manualGlossaryIds ?? [])];
    const union = Array.from(new Set([...matched, ...manual]));
    entry.assignedGlossaryIds = union.length > 0 ? union : undefined;
  }
  return { glossariesSkipped };
}
