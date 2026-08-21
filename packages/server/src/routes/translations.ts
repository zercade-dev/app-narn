import { Router } from 'express';
import { z } from 'zod';
import { translationEngine } from '../modules/M9-translation-engine.js';
import { getGlossaryStore } from '../storage/registry.js';
import { createSnapshot } from '../modules/auto-snapshot.js';
import { sanitizeLogObject } from '../modules/M16-credential-store.js';
import { validateBody } from '../middleware/validate.js';
import { getSessionId } from '../middleware/session.js';
import { asyncHandler } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';
import { assertRunVisible, assertProjectAccess } from '../middleware/authz.js';
import { can, BATCH_GROUPING_DIMENSIONS } from '@zercade-dev/narn-shared';
import { ForbiddenError } from '../types/errors.js';

export const translationsRouter: Router = Router({ mergeParams: true });

// Validate `:projectId` against path traversal for every route below (400
// centrally on a hostile id), so handlers read the pre-validated value directly.
translationsRouter.param('projectId', projectIdParam);

/**
 * Carved out of `translationsRouter` so `POST /:projectId/approve` can be
 * mounted ungated in index.ts (see the comment on `approveSchema` below for
 * why). Separate router ⇒ separate `:projectId` validation registration.
 */
export const translationsApproveRouter: Router = Router({ mergeParams: true });
translationsApproveRouter.param('projectId', projectIdParam);

// Request-size bounds. `entryIds` × `targetLanguages` is the job-fan-out of
// a run, so an unbounded pair lets a single request build millions of jobs (a
// memory/queue DoS). Cap both to generous-but-finite limits well above any real
// project (the largest projects are tens of thousands of strings; a target set
// is at most a few dozen locales) — an oversized request takes the existing
// zod-400 path. Shared by the enqueue + preview + approve schemas so the bound
// is enforced on every job-fan-out entry point.
const MAX_ENTRY_IDS = 50_000;
const MAX_TARGET_LANGUAGES = 100;

const enqueueSchema = z.object({
  entryIds: z.array(z.string()).min(1).max(MAX_ENTRY_IDS),
  targetLanguages: z.array(z.string()).min(1).max(MAX_TARGET_LANGUAGES),
  reTranslate: z.boolean().optional(),
  /**
   * "Start after the current run finishes". Queuing happens automatically
   * whenever a run is already in progress; the flag records the explicit
   * user intent (and is a no-op when the project is idle).
   */
  queue: z.boolean().optional(),
  /**
   * Language whose existing translations are attached to each job as LLM
   * prompt context ("reference translation").
   */
  referenceLanguage: z.string().min(1).optional(),
  /**
   * Skip the translation-memory auto-apply path for this run only: every entry
   * goes to the model regardless of stored TM variants. Default behaviour
   * (consult the memory) when absent/false.
   */
  disableMemory: z.boolean().optional(),
  /**
   * Per-run override for related-entry batch grouping. Absent ⇒ the project /
   * workspace setting is used.
   */
  batchGrouping: z.enum(BATCH_GROUPING_DIMENSIONS).optional(),
  /** Per-run override for the ignore-batch-size-limit toggle. */
  ignoreBatchSizeLimit: z.boolean().optional(),
  /**
   * Per-run override of how many entries each provider call holds. `0` means
   * unlimited (one call per module+language partition). Mutually exclusive
   * with `batchGrouping`/`ignoreBatchSizeLimit` — the dialog sends one or the
   * other.
   */
  customBatchSize: z.number().int().min(0).optional(),
  /**
   * When true and the run is routed to ≥2 distinct local Ollama models, process
   * one model's jobs fully before the next and unload the previous model from
   * VRAM between phases. No effect otherwise.
   */
  splitByModel: z.boolean().optional(),
  /**
   * Entry ids used as few-shot style examples for this run ("translate these
   * the way I translated those"). Resolved by M9 into per-language
   * source → translation pairs; ids that are unknown, untranslated, or overlap
   * `entryIds` are dropped server-side. Hard cap 10.
   */
  exampleEntryIds: z.array(z.string()).min(1).max(10).optional(),
  /**
   * Restricts the run to exactly these (entryId, targetLanguage) pairs instead
   * of the full `entryIds × targetLanguages` product. `entryIds`/
   * `targetLanguages` stay required and still bound the run — `pairs` only
   * intersects that product, so a pair outside it is inert. Lets a caller
   * re-translate a few weak pairs without overwriting good translations in the
   * selection's other languages. Bounded by the same fan-out cap as `entryIds`.
   */
  pairs: z
    .array(z.object({ entryId: z.string(), targetLanguage: z.string() }))
    .min(1)
    .max(MAX_ENTRY_IDS)
    .optional(),
  /**
   * Freeway-only per-run quality floor: plan (and re-validate) every job group
   * at least this tier rather than the one its content alone earns. 2-4 — tier
   * 1 is no floor at all and 5 is not a tier. Ignored by non-Freeway routing.
   */
  freewayMinTier: z.number().int().min(2).max(4).optional(),
});

/** Dry-run TM preview: how many of these pairs would auto-apply from memory. */
const memoryPreviewSchema = z.object({
  entryIds: z.array(z.string()).min(1).max(MAX_ENTRY_IDS),
  targetLanguages: z.array(z.string()).min(1).max(MAX_TARGET_LANGUAGES),
});

/**
 * Dry-run "which local Ollama models would this run touch" preview: same scope
 * shape as the TM preview. Returns the distinct local models so the Translate
 * dialog can offer the "run one model at a time" option (only when ≥2).
 */
const localModelPreviewSchema = z.object({
  entryIds: z.array(z.string()).min(1).max(MAX_ENTRY_IDS),
  targetLanguages: z.array(z.string()).min(1).max(MAX_TARGET_LANGUAGES),
});

/**
 * Ad-hoc back-translation preview: translate `text` from `sourceLanguage` to
 * `targetLanguage` and return the result WITHOUT persisting it onto the entry.
 * Used by the Review tab to show a reference back-translation of the current
 * target text into the project's source language.
 */
const previewSchema = z.object({
  entryId: z.string().min(1),
  text: z.string().min(1),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
});

/**
 * Approve translations into the (global) translation memory. Each pair is the
 * (entry, target language) of a stored translation; approving marks it reviewed
 * and records it to the TM. This is the only path that writes to the memory —
 * runs no longer auto-record.
 *
 * CARVE-OUT: this route makes no LLM call and needs no vault, so it lives on
 * `translationsApproveRouter` (above) instead of `translationsRouter` and is
 * mounted ungated in index.ts, ahead of the shared paid-LLM
 * `requireUnlockedVault` + `paidRunLimiter` gate — the same ambient-tenant,
 * no-LLM-credential reasoning as `tmRouter`/`notificationsRouter`. CSRF +
 * identity middleware still apply globally.
 */
const approveSchema = z.object({
  // Each pair records one (entry, target language) translation to the TM, so
  // bound the list like the run fan-out (oversized → zod-400).
  pairs: z
    .array(z.object({ entryId: z.string().min(1), targetLanguage: z.string().min(1) }))
    .min(1)
    .max(MAX_ENTRY_IDS),
});

// NOTE: this router is mounted (in index.ts) behind the shared
// `paidRunLimiter` (30/min), which is stricter than and runs BEFORE any
// router-local limiter here — a second, looser limiter on individual routes
// below would be dead code (the outer one always saturates first). See the
// mount comment in index.ts for the shared-gate reasoning; do not re-add a
// per-route limiter here without first checking the outer bound.

translationsRouter.post(
  '/:projectId/translate',
  validateBody(enqueueSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const {
      entryIds,
      targetLanguages,
      reTranslate,
      queue,
      referenceLanguage,
      disableMemory,
      batchGrouping,
      ignoreBatchSizeLimit,
      splitByModel,
      customBatchSize,
      exampleEntryIds,
      pairs,
      freewayMinTier,
    } = req.body as z.infer<typeof enqueueSchema>;
    const sessionId = getSessionId(res);

    await assertProjectAccess(projectId, { type: 'run-ai', languages: targetLanguages });

    // --- Glossary completeness pre-flight ----------------------------------
    // Refuse to start a run while one of the project's own active glossaries is
    // missing a translation for a target language — including constant
    // (do-not-translate) terms, which are still expected to declare a localized
    // form per language. Surface it before spending an LLM call.
    const incomplete = await getGlossaryStore().findIncompleteGlossaries(
      projectId,
      targetLanguages,
    );
    if (incomplete.length > 0) {
      const detail = incomplete
        .map(
          (g) =>
            `glossary "${g.glossaryName}" is missing translations for ${g.missingLanguages.join(
              ', ',
            )} (${g.missingTermCount} term${g.missingTermCount === 1 ? '' : 's'})`,
        )
        .join('; ');
      // Human-readable text in `error` (surfaced by the frontend's apiRequest
      // toast); `code` + `incomplete` carry the structured detail for richer UI.
      res.status(400).json({
        error: `Cannot start translation: ${detail}. Complete or disable the glossary, then try again.`,
        code: 'glossary-incomplete',
        incomplete,
      });
      return;
    }
    // -----------------------------------------------------------------------

    // --- Automatic safety snapshot (pre-retranslate) -----------------------
    // Re-translation overwrites existing translations, so snapshot the project
    // BEFORE the run is enqueued. Awaited deliberately — never race the engine.
    if (reTranslate === true) {
      await createSnapshot(projectId, 'pre-retranslate');
    }
    // -----------------------------------------------------------------------

    const result = await translationEngine.enqueue(
      projectId,
      entryIds,
      targetLanguages,
      reTranslate ?? false,
      sessionId,
      {
        queue: queue ?? false,
        ...(referenceLanguage ? { referenceLanguage } : {}),
        ...(disableMemory ? { disableMemory: true } : {}),
        ...(batchGrouping !== undefined ? { batchGrouping } : {}),
        ...(ignoreBatchSizeLimit !== undefined ? { ignoreBatchSizeLimit } : {}),
        ...(splitByModel ? { splitByModel: true } : {}),
        ...(customBatchSize !== undefined ? { customBatchSize } : {}),
        ...(exampleEntryIds?.length ? { exampleEntryIds } : {}),
        ...(pairs?.length ? { pairs } : {}),
        ...(freewayMinTier !== undefined ? { freewayMinTier } : {}),
      },
    );
    res.status(202).json(result);
  }),
);

translationsRouter.post(
  '/:projectId/translate/memory-preview',
  validateBody(memoryPreviewSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    // Defense-in-depth: a dry-run TM lookup makes no LLM call, but still gate on
    // membership so a non-member 404s (RLS otherwise) rather than probing.
    await assertProjectAccess(projectId, { type: 'read' });
    const { entryIds, targetLanguages } = req.body as z.infer<typeof memoryPreviewSchema>;
    const result = await translationEngine.memoryPreview(projectId, entryIds, targetLanguages);
    res.json(result);
  }),
);

translationsRouter.post(
  '/:projectId/translate/local-model-preview',
  validateBody(localModelPreviewSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    // Defense-in-depth: read-gate the dry-run local-model preview (see memory-preview).
    await assertProjectAccess(projectId, { type: 'read' });
    const { entryIds, targetLanguages } = req.body as z.infer<typeof localModelPreviewSchema>;
    const models = await translationEngine.localModelPreview(projectId, entryIds, targetLanguages);
    res.json({ models });
  }),
);

translationsRouter.post(
  '/:projectId/translate/preview',
  validateBody(previewSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const { entryId, text, sourceLanguage, targetLanguage } = req.body as z.infer<
      typeof previewSchema
    >;
    // This performs a real (own-credential) LLM call for `targetLanguage`, so it
    // needs the SAME language-scoped run gate as POST /:projectId/translate — a
    // collaborator must not preview-translate a language outside their grant.
    await assertProjectAccess(projectId, { type: 'run-ai', languages: [targetLanguage] });
    const sessionId = getSessionId(res);
    // `previewTranslate` throws `PreviewNotPossibleError` (422) for the expected
    // "cannot produce a reference" conditions (no enabled module, empty model
    // output, entry vanished); the central error handler maps it, so the route
    // stays a thin pass-through.
    const result = await translationEngine.previewTranslate(
      projectId,
      entryId,
      text,
      sourceLanguage,
      targetLanguage,
      sessionId,
    );
    res.json(result);
  }),
);

translationsApproveRouter.post(
  '/:projectId/approve',
  validateBody(approveSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const { pairs } = req.body as z.infer<typeof approveSchema>;
    const access = await assertProjectAccess(projectId, { type: 'read' });
    for (const language of new Set(pairs.map((p) => p.targetLanguage))) {
      if (!can(access, { type: 'write-language', language })) {
        throw new ForbiddenError(`write-language:${language}`);
      }
    }
    const result = await translationEngine.approveTranslations(projectId, pairs);
    res.json(result);
  }),
);

translationsRouter.get(
  '/:projectId/translate/status',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    // `runId` must be a single string: `?runId=a&runId=b` makes Express parse
    // it as an array, and the old `as string` cast would silently pass that
    // array through to assertRunVisible/getStatus (both expect a string) → a
    // 500 downstream instead of a clean 400 here.
    const runIdRaw = req.query.runId;
    if (typeof runIdRaw !== 'string' || runIdRaw.length === 0) {
      res.status(400).json({ error: 'runId is required and must be a single string' });
      return;
    }
    const runId = runIdRaw;
    // Cross-tenant gate: getStatus reads the engine's in-memory run map keyed
    // by `runId` alone, so a tenant could poll another tenant's run by its UUID.
    // Confirm the run is visible under `:projectId` via the RLS-scoped store
    // first (404 — the same as a missing run — otherwise).
    await assertRunVisible(projectId, runId);
    const status = translationEngine.getStatus(runId);
    // Defense-in-depth: the run is authorized in the store, but the in-memory
    // status must also belong to this project. A mismatch (or a runId the engine
    // never held in memory) yields the same 404 — never serve a foreign run's
    // in-memory state.
    if (!status || status.projectId !== projectId) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    // Run the status payload through the credential sanitizer so any secret
    // values that surfaced inside `errors[].error` (or other free-form fields)
    // are masked before they reach the client.
    res.json(sanitizeLogObject(status));
  }),
);

translationsRouter.get(
  '/:projectId/translate/active',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    // Without this gate any authenticated tenant could probe an arbitrary
    // projectId as an activity oracle (the engine keys by projectId alone). The
    // read gate also makes a non-member 404 — matching the `translate/status`
    // sibling above.
    await assertProjectAccess(projectId, { type: 'read' });
    res.json({ active: translationEngine.hasInProgressProjectRun(projectId) });
  }),
);

translationsRouter.delete(
  '/:projectId/translate/:runId',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const runId = req.params.runId as string;
    // Cross-tenant gate: confirm the run is visible under `:projectId` (404
    // otherwise) before cancelling — the engine keys cancel by `runId` alone.
    await assertRunVisible(projectId, runId);
    await translationEngine.cancel(runId);
    res.status(204).end();
  }),
);
