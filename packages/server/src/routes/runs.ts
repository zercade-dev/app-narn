import { Router } from 'express';
import { z } from 'zod';
import { RunStatusCode, hasRunDetailsKind } from '@zercade-dev/narn-shared';
import { getProjectStore, getRunStore, getStringStore } from '../storage/registry.js';
import type { SourceReviewRecord } from '../storage/types.js';
import { logger } from '../modules/M15-console-logger.js';
import {
  translationEngine,
  type ResumeWithModuleResult,
} from '../modules/M9-translation-engine.js';
import { judgeEngine } from '../modules/M25-judge-engine.js';
import { sourceReviewEngine } from '../modules/M26-source-review-engine.js';
import { backgroundRunEngines } from '../modules/run-engines.js';
import { validateBody } from '../middleware/validate.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { getSessionId } from '../middleware/session.js';
import { asyncHandler, enqueueRun } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';
import { assertRunVisible, assertProjectAccess } from '../middleware/authz.js';
import { requireTenant } from '../storage/pg/tenant-context.js';

export const runsRouter: Router = Router();

// Validate the project id against path traversal for every route below — runs
// whenever `:projectId` is matched so no handler can reach a store with a
// hostile id (matches the classify/orphans routers).
runsRouter.param('projectId', projectIdParam);

/**
 * Best-effort persistence of the last-used review selection onto the project so
 * it becomes the default for the next run. Only the fields actually supplied in
 * the request are merged (a body-less run leaves the saved config untouched).
 * Runs after the engine enqueue succeeds — a started run must never fail because
 * this save failed, hence the swallowed error.
 */
async function rememberReviewSelection(
  projectId: string,
  field: 'judgeConfig' | 'sourceReviewConfig',
  selection: { moduleId?: string; model?: string; reasoningEffort?: string },
): Promise<void> {
  const config: { moduleId?: string; model?: string; reasoningEffort?: string } = {};
  if (selection.moduleId) config.moduleId = selection.moduleId;
  if (selection.model) config.model = selection.model;
  if (selection.reasoningEffort) config.reasoningEffort = selection.reasoningEffort;
  // Nothing explicit was selected — leave the saved default untouched.
  if (Object.keys(config).length === 0) return;
  try {
    const existing = await getProjectStore().loadProject(projectId);
    await getProjectStore().updateProject(projectId, {
      [field]: { ...(existing[field] ?? {}), ...config },
    });
  } catch (err) {
    logger.warn('runs: failed to persist last-used review selection', {
      projectId,
      field,
      ...(err instanceof Error ? { error: err.message } : {}),
    });
  }
}

const reorderSchema = z.object({
  runIds: z.array(z.string()).min(1),
});

/**
 * Optional per-run module/model selection for an AI review. Defaults to `{}`
 * so a body-less POST (legacy callers) still validates and falls back to the
 * project's judge config.
 */
const judgeSchema = z
  .object({
    moduleId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    reasoningEffort: z.string().min(1).optional(),
    verbose: z.boolean().optional(),
    // Language the AI writes its findings in (LANGUAGE_REGISTRY code). Affects
    // only the natural-language output; absent or 'en' = default English.
    responseLanguage: z.string().min(1).optional(),
    // Target-language subset picked in the AI-review dialog (JudgeOverride
    // .languages). validateBody replaces req.body with the parsed result, so a
    // field absent from this schema is silently stripped — it must be listed
    // here to reach the engine. Non-empty when present; absent = review every
    // language the source run covered.
    languages: z.array(z.string().min(1)).min(1).optional(),
    // Per-run related-entry grouping override (absent = project/workspace setting).
    batchGrouping: z.enum(['none', 'category', 'glossary', 'both']).optional(),
    ignoreBatchSizeLimit: z.boolean().optional(),
    /**
     * Per-run override of how many items each provider call holds. `0` means
     * unlimited. Mutually exclusive with `batchGrouping`/`ignoreBatchSizeLimit`.
     */
    customBatchSize: z.number().int().min(0).optional(),
    /**
     * Opt-in quality checks (typo/grammar/clarity/unsafe on the translated
     * text; terminology is a no-op, kept for parity with the source-review
     * checks shape). Absent = every check off (today's default behavior).
     */
    checks: z
      .object({
        typo: z.boolean().optional(),
        grammar: z.boolean().optional(),
        terminology: z.boolean().optional(),
        clarity: z.boolean().optional(),
        unsafe: z.boolean().optional(),
      })
      .optional(),
  })
  .default({});

/**
 * Body for starting a source-language AI review. `checks` toggles the finding
 * categories; at least one must be enabled (enforced in the handler so the
 * error is a clear 400). All other fields are optional overrides.
 */
const sourceReviewSchema = z.object({
  entryIds: z.array(z.string()).optional(),
  checks: z.object({
    typo: z.boolean().optional(),
    grammar: z.boolean().optional(),
    terminology: z.boolean().optional(),
    clarity: z.boolean().optional(),
    unsafe: z.boolean().optional(),
  }),
  batchSize: z.number().int().positive().optional(),
  moduleId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  reasoningEffort: z.string().min(1).optional(),
  /** Language code the AI should write its finding `detail` text in. */
  responseLanguage: z.string().min(1).optional(),
  verbose: z.boolean().optional(),
  // Per-run related-entry grouping override (absent = project/workspace setting).
  batchGrouping: z.enum(['none', 'category', 'glossary', 'both']).optional(),
  ignoreBatchSizeLimit: z.boolean().optional(),
  /**
   * Per-run override of how many items each provider call holds. `0` means
   * unlimited. Mutually exclusive with `batchGrouping`/`ignoreBatchSizeLimit`.
   */
  customBatchSize: z.number().int().min(0).optional(),
});

/**
 * POST /api/projects/:projectId/runs/queue/reorder
 * Reorders the project's pending (queued) runs. Body: { runIds: string[] }.
 * Returns the queued runs in their new order.
 *
 * Owner-only (`manage`): reordering the shared project queue is a queue
 * mutation, not a read — a read-only collaborator must not be able to reprioritize
 * the owner's runs. Matches the `source-review` enqueue gate below.
 */
runsRouter.post(
  '/:projectId/runs/queue/reorder',
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const { runIds } = req.body as z.infer<typeof reorderSchema>;
    const queue = await translationEngine.reorderQueue(projectId, runIds);
    res.json(queue);
  }),
);

/**
 * GET /api/projects/:projectId/runs
 * Returns all runs for the project. Collaborators see only the runs they
 * themselves started — same own-run rule as {@link assertRunVisible},
 * applied here as a list filter instead of a per-run 404 (a legacy run with no
 * `createdBy` is treated as the owner's, so it's filtered out for collaborators
 * too). Owners see every run, unfiltered.
 */
runsRouter.get(
  '/:projectId/runs',
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const access = await assertProjectAccess(projectId, { type: 'read' });
    const runs = await getRunStore().listRuns(projectId);
    const visible =
      access.role === 'collaborator'
        ? runs.filter((r) => r.createdBy === requireTenant().userId)
        : runs;
    // Sort by startedAt descending (most recent first)
    visible.sort((a, b) => b.startedAt - a.startedAt);
    res.json(visible);
  }),
);

/**
 * GET /api/projects/:projectId/runs/:runId/verdicts
 * Returns the per-(string, language) verdicts recorded for an AI-review run
 * (score, verdict, typed issues, suggestion) — the disaggregated detail behind
 * the run's average score. Empty array for non-judge runs or runs with no
 * recorded detail. Read-only stored data, so no vault gate.
 */
runsRouter.get(
  '/:projectId/runs/:runId/verdicts',
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    await assertRunVisible(projectId, runId);
    const verdicts = await getRunStore().getVerdicts(projectId, runId);
    res.json(verdicts);
  }),
);

/**
 * Body for the on-demand "generate suggestion" action: the target language of
 * the verdict to (re-)suggest. The entry id and run id come from the path.
 */
const suggestVerdictSchema = z.object({
  targetLanguage: z.string().min(1),
  /** Optional reviewer guidance forwarded into the forced-suggestion prompt. */
  instructions: z.string().trim().min(1).max(2000).optional(),
});

/**
 * POST /api/projects/:projectId/runs/:runId/verdicts/:entryId/suggest
 * Re-runs the judge on a single (entry, targetLanguage) with the
 * forced-suggestion prompt, persists the generated suggestion onto the run's
 * stored verdict, and returns the updated verdict record. Vault-gated (the
 * re-run reads credentials); 409 (JudgeNotPossibleError) propagates from the
 * judge engine when the run/entry/translation is missing or no judge module is
 * available.
 */
runsRouter.post(
  '/:projectId/runs/:runId/verdicts/:entryId/suggest',
  requireUnlockedVault,
  validateBody(suggestVerdictSchema),
  asyncHandler(async (req, res) => {
    const { projectId, runId, entryId } = req.params;
    await assertRunVisible(projectId, runId);
    const sessionId = getSessionId(res);
    const { targetLanguage, instructions } = req.body as z.infer<typeof suggestVerdictSchema>;
    // JudgeNotPossibleError (404/409) propagates to the central error handler.
    const updated = await judgeEngine.suggestVerdict(
      projectId,
      runId,
      entryId,
      targetLanguage,
      sessionId,
      instructions,
    );
    res.json(updated);
  }),
);

/** Body for discarding a stored suggestion: the verdict's target language. */
const discardSuggestionSchema = z.object({ targetLanguage: z.string().min(1) });

/**
 * DELETE /api/projects/:projectId/runs/:runId/verdicts/:entryId/suggestion
 * Removes the stored suggestion from the run's verdict for the given target
 * language and returns the updated verdict record. Stored-data edit only (no
 * AI call), so unlike the suggest route there is no vault gate.
 * JudgeNotPossibleError (404/409) propagates from the judge engine.
 */
runsRouter.delete(
  '/:projectId/runs/:runId/verdicts/:entryId/suggestion',
  validateBody(discardSuggestionSchema),
  asyncHandler(async (req, res) => {
    const { projectId, runId, entryId } = req.params;
    await assertRunVisible(projectId, runId);
    const { targetLanguage } = req.body as z.infer<typeof discardSuggestionSchema>;
    const updated = await judgeEngine.discardSuggestion(projectId, runId, entryId, targetLanguage);
    res.json(updated);
  }),
);

/**
 * GET /api/projects/:projectId/runs/:runId/source-review
 * Returns the per-entry source-review records (source text + typed findings)
 * recorded for a source-review run — the disaggregated detail behind the run's
 * findings summary. Shape: `{ records: SourceReviewRecord[] }`. Empty for
 * non-source-review runs or runs with no recorded detail. Read-only stored
 * data, so no vault gate.
 */
runsRouter.get(
  '/:projectId/runs/:runId/source-review',
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    await assertRunVisible(projectId, runId);
    const records = await getRunStore().getSourceReview(projectId, runId);
    res.json({ records });
  }),
);

/** Body for approving a source-review entry: the only accepted disposition. */
const sourceReviewApproveSchema = z.object({ approved: z.literal(true) });

/**
 * Mirrors a source-review disposition onto the entry's own `sourceReview`
 * field — only when that stored review came from the SAME run (an older or
 * newer run's per-entry state must not be clobbered by this run's view).
 * Best-effort: a missing entry (e.g. deleted since the run) is not an error.
 */
async function mirrorSourceReviewDisposition(
  projectId: string,
  runId: string,
  entryId: string,
  action: 'approve' | 'ignore',
): Promise<void> {
  let entry;
  try {
    entry = await getStringStore().getById(projectId, entryId);
  } catch {
    return;
  }
  const current = entry.sourceReview;
  if (!current || current.runId !== runId) return;
  const next =
    action === 'approve'
      ? { ...current, approved: true }
      : // Ignore keeps the "reviewed" stamp (so the entry does not resurface in
        // a never-reviewed-only run) but drops the findings and suggestion.
        {
          findings: [],
          reviewedAt: current.reviewedAt,
          ...(current.runId !== undefined ? { runId: current.runId } : {}),
        };
  await getStringStore().updateEntry(projectId, entryId, { sourceReview: next });
}

/**
 * PATCH /api/projects/:projectId/runs/:runId/source-review/:entryId
 * Marks one source-review record approved (body: `{ approved: true }`), so the
 * approval survives reloads. Also mirrored onto the entry's `sourceReview`
 * when that review came from this run. 404 when the run has no record for the
 * entry. No vault gate — stored data only.
 */
runsRouter.patch(
  '/:projectId/runs/:runId/source-review/:entryId',
  validateBody(sourceReviewApproveSchema),
  asyncHandler(async (req, res) => {
    const { projectId, runId, entryId } = req.params;
    await assertRunVisible(projectId, runId);
    // Atomic read-modify-write under the store's per-project write lock, so a
    // concurrent approve/ignore of another entry can't clobber this one.
    let record: SourceReviewRecord | undefined;
    await getRunStore().updateSourceReview(projectId, runId, (records) => {
      record = records.find((r) => r.entryId === entryId);
      if (!record) return undefined; // no record → no write (404 below)
      record.approved = true;
      return records;
    });
    if (!record) {
      res.status(404).json({ error: 'no source-review record for this entry in this run' });
      return;
    }
    await mirrorSourceReviewDisposition(projectId, runId, entryId, 'approve');
    res.json({ record });
  }),
);

/**
 * DELETE /api/projects/:projectId/runs/:runId/source-review/:entryId
 * Removes one source-review record from the run ("ignore"). The entry's own
 * `sourceReview` keeps its reviewedAt/runId stamp (still counts as reviewed)
 * but loses its findings/suggestion — when that review came from this run.
 * 404 when the run has no record for the entry. No vault gate.
 */
runsRouter.delete(
  '/:projectId/runs/:runId/source-review/:entryId',
  asyncHandler(async (req, res) => {
    const { projectId, runId, entryId } = req.params;
    await assertRunVisible(projectId, runId);
    // Atomic read-modify-write under the store's per-project write lock, so a
    // concurrent approve/ignore of another entry can't clobber this removal.
    let removed = false;
    await getRunStore().updateSourceReview(projectId, runId, (records) => {
      const remaining = records.filter((r) => r.entryId !== entryId);
      if (remaining.length === records.length) return undefined; // nothing removed → no write
      removed = true;
      return remaining;
    });
    if (!removed) {
      res.status(404).json({ error: 'no source-review record for this entry in this run' });
      return;
    }
    await mirrorSourceReviewDisposition(projectId, runId, entryId, 'ignore');
    res.json({ removed: true });
  }),
);

/**
 * GET /api/projects/:projectId/runs/:runId/details
 * Returns the per-run detail recorded for a translation run: which entries were
 * translated (source text + target language), retry counts, and character
 * totals (input/output, everything vs source/used). `null` for runs with no
 * recorded detail. Read-only stored data, so no vault gate.
 */
runsRouter.get(
  '/:projectId/runs/:runId/details',
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    await assertRunVisible(projectId, runId);
    const details = await getRunStore().getRunDetails(projectId, runId);
    res.json(details);
  }),
);

/**
 * GET /api/projects/:projectId/runs/:runId/logs
 * Returns the verbose prompt/response log captured for an AI-review run (only
 * present when the review was started with verbose on). Empty array otherwise.
 * Read-only stored data, so no vault gate.
 */
runsRouter.get(
  '/:projectId/runs/:runId/logs',
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    await assertRunVisible(projectId, runId);
    const logs = await getRunStore().getJudgeLogs(projectId, runId);
    res.json(logs);
  }),
);

/**
 * POST /api/projects/:projectId/runs/:runId/cancel
 * Cancels the specified run (translation or AI-review; each engine ignores
 * unknown run ids).
 *
 * After asking both engines to cancel, force the persisted record to a
 * terminal state as a safety net. This is what lets a "stuck"/corrupted run be
 * cancelled even when neither engine still holds it in memory — e.g. a run left
 * `running`/`paused` in runs.json after a server restart, which the engines'
 * in-memory `cancel` silently ignores. `forceCancel` is a no-op once the run is
 * already terminal, so it never clobbers a genuinely finished run.
 */
runsRouter.post(
  '/:projectId/runs/:runId/cancel',
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    // Cross-tenant gate: the engines key their in-memory runs by `runId` alone
    // (no membership check), and this route is mounted UNGATED — so without this
    // the path `:projectId` was validated for traversal then ignored, letting a
    // tenant cancel another tenant's run by its UUID. Confirm the run is visible
    // under `:projectId` via the RLS-scoped store (404 otherwise) BEFORE acting.
    await assertRunVisible(projectId, runId);
    // Every engine's `cancel` is idempotent/no-op for unknown ids, so asking all
    // of them concurrently is safe; a new background engine only needs to be
    // added to `backgroundRunEngines` (shared with the account-deletion drain).
    await Promise.all(backgroundRunEngines.map((engine) => engine.cancel(runId)));
    await getRunStore().forceCancel(projectId, runId);
    res.json({ success: true });
  }),
);

/**
 * POST /api/projects/:projectId/runs/:runId/retry
 * Re-enqueues exactly the (entry, language) pairs that failed in the given run
 * as a fresh translation run. Vault-gated (the re-run reads credentials), so a
 * locked vault yields 423; 409 when the run has no failed entries to retry.
 */
runsRouter.post(
  '/:projectId/runs/:runId/retry',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    // Cross-tenant gate: retryFailed falls back to the process-global in-memory
    // run map keyed by runId ALONE (no membership check), and vault-unlock is not
    // membership — confirm the run is visible under `:projectId` (404 otherwise)
    // before re-enqueuing, so a tenant can't retry another tenant's run by its UUID.
    await assertRunVisible(projectId, runId);
    const sessionId = getSessionId(res);
    const result = await translationEngine.retryFailed(projectId, runId, sessionId);
    if (!result) {
      res.status(409).json({ error: 'Run has no failed entries to retry' });
      return;
    }
    res.status(202).json(result);
  }),
);

/**
 * POST /api/projects/:projectId/runs/:runId/judge
 * Starts a report-only AI review (LLM-as-judge) of everything the given
 * translation run translated. 423 when the vault is locked, 409 when the
 * source run cannot be judged or no judge-capable module is available.
 */
runsRouter.post(
  '/:projectId/runs/:runId/judge',
  requireUnlockedVault,
  validateBody(judgeSchema),
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    await assertRunVisible(projectId, runId);
    const sessionId = getSessionId(res);
    const override = req.body as z.infer<typeof judgeSchema>;
    // JudgeNotPossibleError (404/409) propagates to the central error handler.
    await enqueueRun(res, async () => {
      const result = await judgeEngine.enqueue(projectId, runId, sessionId, override);
      // Remember the explicit selection as this project's translation-review
      // default. Best-effort and fire-and-forget (it swallows its own errors),
      // after the run already started — so it never delays the 202 response.
      void rememberReviewSelection(projectId, 'judgeConfig', override);
      return result;
    });
  }),
);

/**
 * POST /api/projects/:projectId/runs/:runId/judge/retry
 * Re-runs the judge on only the failed (entry, language) pairs of a terminal
 * judge run. 202 with the new run; 409 when there are no failed reviews.
 */
runsRouter.post(
  '/:projectId/runs/:runId/judge/retry',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    // Cross-tenant gate: judgeEngine.retryFailed falls back to the process-global
    // in-memory run map keyed by runId ALONE (no membership check), and vault-unlock
    // is not membership — confirm the run is visible under `:projectId` (404 else)
    // before re-running, so a tenant can't retry another tenant's judge run by UUID.
    await assertRunVisible(projectId, runId);
    const sessionId = getSessionId(res);
    const result = await judgeEngine.retryFailed(projectId, runId, sessionId);
    if (!result) {
      res.status(409).json({ error: 'no-failed-reviews' });
      return;
    }
    res.status(202).json(result);
  }),
);

/**
 * POST /api/projects/:projectId/judge
 * Starts a report-only AI review (LLM-as-judge) of every currently-translated
 * entry in the project — independent of any translation run, so imported
 * translations that never went through M9 TranslationEngine are reviewable.
 * 423 when the vault is locked, 409 when there's nothing to review or no
 * judge-capable module is available.
 */
runsRouter.post(
  '/:projectId/judge',
  requireUnlockedVault,
  validateBody(judgeSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const sessionId = getSessionId(res);
    const override = req.body as z.infer<typeof judgeSchema>;
    // JudgeNotPossibleError (404/409) propagates to the central error handler.
    await enqueueRun(res, async () => {
      const result = await judgeEngine.enqueue(projectId, undefined, sessionId, override);
      void rememberReviewSelection(projectId, 'judgeConfig', override);
      return result;
    });
  }),
);

/**
 * POST /api/projects/:projectId/source-review
 * Starts a report-only AI review of the SOURCE text (typos, grammar,
 * terminology, clarity). 423 when the vault is locked, 400 when no check is
 * enabled, 409 when no source-review-capable module is available. Returns 202
 * `{ runId, total, status }`.
 */
runsRouter.post(
  '/:projectId/source-review',
  requireUnlockedVault,
  validateBody(sourceReviewSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const sessionId = getSessionId(res);
    const body = req.body as z.infer<typeof sourceReviewSchema>;
    const { checks } = body;
    if (
      !checks.typo &&
      !checks.grammar &&
      !checks.terminology &&
      !checks.clarity &&
      !checks.unsafe
    ) {
      res.status(400).json({ error: 'At least one review check must be enabled' });
      return;
    }
    // SourceReviewNotPossibleError (409) propagates to the central error handler.
    await enqueueRun(res, async () => {
      const result = await sourceReviewEngine.enqueue(
        projectId,
        {
          checks,
          ...(body.entryIds ? { entryIds: body.entryIds } : {}),
          ...(body.batchSize !== undefined ? { batchSize: body.batchSize } : {}),
          ...(body.moduleId ? { moduleId: body.moduleId } : {}),
          ...(body.model ? { model: body.model } : {}),
          ...(body.reasoningEffort ? { reasoningEffort: body.reasoningEffort } : {}),
          ...(body.responseLanguage ? { responseLanguage: body.responseLanguage } : {}),
          ...(body.verbose ? { verbose: true } : {}),
          ...(body.batchGrouping !== undefined ? { batchGrouping: body.batchGrouping } : {}),
          ...(body.ignoreBatchSizeLimit !== undefined
            ? { ignoreBatchSizeLimit: body.ignoreBatchSizeLimit }
            : {}),
          ...(body.customBatchSize !== undefined ? { customBatchSize: body.customBatchSize } : {}),
        },
        sessionId,
      );
      // Remember the explicit selection as this project's source-review default.
      // Best-effort and fire-and-forget (it swallows its own errors), after the
      // run already started — so it never delays the 202 response.
      void rememberReviewSelection(projectId, 'sourceReviewConfig', {
        ...(body.moduleId ? { moduleId: body.moduleId } : {}),
        ...(body.model ? { model: body.model } : {}),
        ...(body.reasoningEffort ? { reasoningEffort: body.reasoningEffort } : {}),
      });
      return result;
    });
  }),
);

/**
 * POST /api/projects/:projectId/runs/:runId/pause
 * Pauses a running run: in-flight jobs finish, no new jobs are dequeued.
 */
runsRouter.post(
  '/:projectId/runs/:runId/pause',
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    // Cross-tenant gate (this route is mounted UNGATED, see cancel above):
    // confirm the run is visible under `:projectId` before pausing it (404 else).
    await assertRunVisible(projectId, runId);
    const paused = await translationEngine.pause(runId);
    if (!paused) {
      res.status(409).json({ error: 'Run is not running' });
      return;
    }
    res.json({ success: true });
  }),
);

/**
 * POST /api/projects/:projectId/runs/:runId/resume
 * Resumes a paused run, starts a queued run immediately, or — after a server
 * restart — adopts a persisted queued run and starts it. Vault-gated: the
 * queued/adopt paths launch a fresh translation pass (via startRun) that reads
 * per-session credentials, so a locked vault yields 423 instead of a run that
 * fails wholesale at job time (matches the retry route's gate).
 */
runsRouter.post(
  '/:projectId/runs/:runId/resume',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    // Cross-tenant gate: behind the caller's OWN vault, but vault-unlock is not
    // membership — confirm the run is visible under `:projectId` (404 otherwise)
    // before resuming, so a tenant can't resume another tenant's run by its UUID.
    await assertRunVisible(projectId, runId);
    // The caller's session is what the resumed pass reads credentials under
    // (a quota-parked run can resume days after its original session died).
    const status = await translationEngine.resume(projectId, runId, getSessionId(res));
    if (!status) {
      res.status(409).json({ error: 'Run cannot be resumed' });
      return;
    }
    res.json({ success: true });
  }),
);

/** Body for resuming a quota-parked run on one explicitly chosen module. */
const resumeWithSchema = z.object({ moduleId: z.string().min(1) });

/**
 * Why a resume-with-module was refused: the status to answer with plus a
 * message the UI can show as-is. Run-STATE refusals are 409 (a conflict with
 * what the run is doing, matching the pause/resume siblings); MODULE-choice
 * refusals are 400 (the body named something unusable). `not-found` is
 * unreachable behind `assertRunVisible` — kept as a defensive 404 rather than
 * mislabelling a vanished run as a bad request.
 */
const RESUME_WITH_ERRORS: Record<
  Extract<ResumeWithModuleResult, { ok: false }>['reason'],
  { status: number; error: string }
> = {
  'not-found': { status: 404, error: 'Run not found' },
  'not-parked': {
    status: 409,
    error: 'Only a run paused waiting for free quota can be resumed with a chosen module',
  },
  'not-drained': {
    status: 409,
    error: 'This run still has work in flight — wait for it to settle, then choose a module',
  },
  'project-busy': {
    status: 409,
    error: 'Another run is already in progress for this project — wait for it to finish',
  },
  'unknown-module': { status: 400, error: 'Unknown module' },
  'module-unavailable': {
    status: 400,
    error: 'That module is disabled or has no credentials in this session',
  },
  'module-not-eligible': {
    status: 400,
    error: 'That module cannot be used to translate a run',
  },
};

/**
 * POST /api/projects/:projectId/runs/:runId/resume-with
 * Resumes a run parked on free quota (`Paused` + `waitingForQuota`) by
 * re-dispatching exactly its parked (entry, language) pairs onto the module in
 * the body, bypassing Freeway — the "don't wait for the free pool, spend my own
 * quota" escape hatch. Vault-gated like the sibling resume/retry routes (the
 * re-dispatch reads per-session credentials, so a locked vault yields 423);
 * 409 when the run's state rules it out (not parked, still draining, project
 * busy) and 400 when the chosen module is unknown, unusable, or not a legal
 * translation target — see {@link RESUME_WITH_ERRORS}.
 */
runsRouter.post(
  '/:projectId/runs/:runId/resume-with',
  requireUnlockedVault,
  validateBody(resumeWithSchema),
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    // Cross-tenant gate: the engine keys its in-memory runs by `runId` alone and
    // vault-unlock is not membership — confirm the run is visible under
    // `:projectId` (404 otherwise) before re-dispatching it.
    await assertRunVisible(projectId, runId);
    const { moduleId } = req.body as z.infer<typeof resumeWithSchema>;
    const result = await translationEngine.resumeWithModule(
      projectId,
      runId,
      moduleId,
      getSessionId(res),
    );
    if (!result.ok) {
      const refusal = RESUME_WITH_ERRORS[result.reason];
      res.status(refusal.status).json({ error: refusal.error });
      return;
    }
    res.json({ success: true });
  }),
);

/**
 * POST /api/projects/:projectId/runs/:runId/revert
 * Restores the pre-run translation values captured for every (entry, target
 * language) this COMPLETED translation or relink-retranslate run touched,
 * then marks the run `reverted` so it cannot be reverted again. No vault
 * gate — this only replays already-captured local data, no credentials/LLM
 * calls involved.
 *
 * Conservative simplification (deliberate, no multi-run diffing): revert is
 * blocked with 409 if ANY newer completed translation or relink-retranslate
 * run exists for the same project, since that later run may have already
 * overwritten the same entries again — reconciling that is out of scope here.
 */
runsRouter.post(
  '/:projectId/runs/:runId/revert',
  asyncHandler(async (req, res) => {
    const { projectId, runId } = req.params;
    // Cross-tenant gate (this route is mounted UNGATED, see cancel above):
    // confirm the run is visible under `:projectId` before reverting it (404
    // else). assertRunVisible also hands back the now-authorized run, reused
    // below instead of a second lookup.
    const run = await assertRunVisible(projectId, runId);

    if (!hasRunDetailsKind(run.kind)) {
      res.status(409).json({ error: 'Only translation and relink runs can be reverted' });
      return;
    }
    if (run.status !== RunStatusCode.Completed) {
      res.status(409).json({ error: 'Only a completed run can be reverted' });
      return;
    }
    if (run.reverted) {
      res.status(409).json({ error: 'This run has already been reverted' });
      return;
    }

    // Conservative multi-run guard: any newer completed revertible run
    // (translation or relink-retranslate) for the project blocks the revert
    // (it may have re-overwritten the same entries), rather than attempting
    // to reconcile which of the two runs' values should win.
    const allRuns = await getRunStore().listRuns(projectId);

    // Reject when any run for this project is still in progress. A live run
    // writes the same (entry, language) translations via setTranslation, so
    // restoreTranslation below must not interleave with it. hasInProgressProjectRun
    // covers the authoritative live active writer (Running with jobs left /
    // Paused); the persisted-run scan additionally rejects a Queued/Pending run
    // that could start writing during the (awaited) restore loop. Terminal runs
    // (Completed/Failed/Cancelled) are safe — the run being reverted is itself
    // Completed (guarded above) so it never matches this filter.
    const NON_TERMINAL_STATUSES = new Set<RunStatusCode>([
      RunStatusCode.Pending,
      RunStatusCode.Queued,
      RunStatusCode.Running,
      RunStatusCode.Paused,
    ]);
    if (
      translationEngine.hasInProgressProjectRun(projectId) ||
      allRuns.some((r) => NON_TERMINAL_STATUSES.has(r.status))
    ) {
      res.status(409).json({
        error:
          'A translation run is currently in progress for this project. Wait for it to finish (or cancel it) before reverting.',
      });
      return;
    }

    const hasNewerCompletedRevertibleRun = allRuns.some(
      (r) =>
        r.runId !== run.runId &&
        hasRunDetailsKind(r.kind) &&
        r.status === RunStatusCode.Completed &&
        r.startedAt > run.startedAt,
    );
    if (hasNewerCompletedRevertibleRun) {
      res.status(409).json({
        error:
          'A newer completed run exists for this project. Revert that run first (or not at all) before reverting this one.',
      });
      return;
    }

    const details = await getRunStore().getRunDetails(projectId, runId);
    const previousValues = details?.previousValues ?? [];
    if (previousValues.length === 0) {
      res.status(409).json({ error: 'No captured previous values to revert for this run' });
      return;
    }

    const stringStore = getStringStore();
    let reverted = 0;
    for (const pv of previousValues) {
      try {
        await stringStore.restoreTranslation(
          projectId,
          pv.entryId,
          pv.targetLanguage,
          pv.previousValue,
        );
        reverted++;
      } catch (err) {
        // The entry may have been deleted since the run — skip it rather than
        // failing the whole revert; every other pair still restores.
        logger.warn('runs:revert-entry-failed', {
          projectId,
          runId,
          entryId: pv.entryId,
          targetLanguage: pv.targetLanguage,
          error: err instanceof Error ? err.message : `${err}`,
        });
      }
    }

    // Every captured pair failed to restore (e.g. every affected entry was
    // since deleted) — nothing actually changed, so do NOT mark the run
    // reverted: that would permanently disable further attempts (once
    // `reverted` is true, revert is blocked above) for a run whose entries
    // might come back (re-imported) or whose transient failure (e.g. a DB
    // hiccup) is worth retrying. A PARTIAL success (reverted > 0) still marks
    // the run reverted — restoreTranslation is idempotent, so the successfully
    // restored pairs are done, and the failed ones (deleted entries) will keep
    // failing on any future attempt regardless.
    if (reverted === 0) {
      res.status(409).json({ error: 'Could not revert any entries for this run' });
      return;
    }

    run.reverted = true;
    run.revertedAt = Date.now();
    await getRunStore().updateRun(projectId, run);

    res.json({ reverted, total: previousValues.length });
  }),
);
