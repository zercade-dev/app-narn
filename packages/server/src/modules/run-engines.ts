/**
 * The seven background-run engine singletons, as ONE shared list so every caller
 * that must fan an operation across all of them (the runs cancel route, the
 * account-deletion drain) stays in sync — adding a new engine here wires it
 * into both at once.
 *
 * All seven expose the same `cancel(runId)` / `cancelAllForProject(projectId)`
 * surface (M9 TranslationEngine re-implements the lifecycle; the other six
 * extend BackgroundRunEngine), so they share the structural {@link ProjectRunEngine}
 * type without a common base class.
 */
import { translationEngine } from './M9-translation-engine.js';
import { judgeEngine } from './M25-judge-engine.js';
import { sourceReviewEngine } from './M26-source-review-engine.js';
import { glossaryGenEngine } from './M28-glossary-gen-engine.js';
import { categoryGenEngine } from './M29-category-gen-engine.js';
import { relinkRetranslateEngine } from './M30-relink-retranslate-engine.js';
import { stageDetailsEngine } from './M31-stage-details-engine.js';

/** Structural surface every background-run engine shares (cancel + project drain). */
export interface ProjectRunEngine {
  /** Idempotent per-run cancel (no-op for unknown/terminal ids). */
  cancel(runId: string): Promise<void>;
  /**
   * Cancel every non-terminal run for a project and await their real
   * settlement, bounded by `timeoutMs`. Never throws; times out to
   * `{ timedOut: true }` rather than hanging.
   */
  cancelAllForProject(
    projectId: string,
    opts?: { timeoutMs?: number },
  ): Promise<{ cancelled: string[]; timedOut: boolean }>;
}

/**
 * Every background-run engine singleton. Order is not significant (all are asked
 * concurrently). Adding an engine here extends both the cancel route and the
 * account-deletion drain.
 */
export const backgroundRunEngines: readonly ProjectRunEngine[] = [
  translationEngine,
  judgeEngine,
  sourceReviewEngine,
  glossaryGenEngine,
  categoryGenEngine,
  relinkRetranslateEngine,
  stageDetailsEngine,
];
