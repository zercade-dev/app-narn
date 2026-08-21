import { Router } from 'express';
import { z } from 'zod';
import { BATCH_GROUPING_DIMENSIONS } from '@zercade-dev/narn-shared';
import { glossarySyncService } from '../modules/M21-glossary-sync-service.js';
import { getGlossaryStore, getProjectStore, getRunStore } from '../storage/registry.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { glossaryGenEngine } from '../modules/M28-glossary-gen-engine.js';
import { translateGlossaryTerms } from '../modules/glossary-translator.js';
import {
  diffGlossaryImport,
  exportLanguageOrder,
  glossaryToCsv,
  glossaryToTbx,
  parseGlossaryCsv,
  parseGlossaryTbx,
  type GlossaryParseResult,
} from '../utils/glossary-import-export.js';
import { getSessionId } from '../middleware/session.js';
import { asyncHandler, enqueueRun, respondSuggestions } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';
import { PathTraversalError } from '../errors/PathTraversalError.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { ReadOnlyGlossaryError, ValidationError } from '../types/errors.js';
import { singleFileUpload, requireFile } from '../utils/upload.js';
import { extensionFileFilter, validateUploadedFile } from '../utils/file-validation.js';
import {
  assertProjectAccess,
  assertGlossaryTermEditAllowed,
  assertRunVisible,
} from '../middleware/authz.js';

export const glossaryRouter: Router = Router({ mergeParams: true });

// Validate the project id against path traversal for every route below — runs
// whenever `:projectId` is matched so no handler can reach a store with a
// hostile id (matches the classify/orphans/runs routers).
glossaryRouter.param('projectId', projectIdParam);

// Defense-in-depth: reject a hostile `:glossaryId` at the route boundary, before
// any handler reaches GlossaryManager. `getGlossaryPath` already routes the id
// through `resolveProjectPath`, but a glossary id is only ever a UUID/slug, so a
// strict allow-list here keeps traversal out of read paths that aren't
// vault-gated. A non-matching id throws `PathTraversalError`, mapped to 400 by
// the central error handler.
glossaryRouter.param('glossaryId', (_req, _res, next, id) => {
  if (typeof id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(id) || id.includes('..')) {
    next(new PathTraversalError('Invalid glossary ID'));
    return;
  }
  next();
});

const addTermSchema = z.object({
  source: z.string().min(1),
  translations: z.record(z.string(), z.string()),
  notes: z.string().optional(),
  constant: z.boolean().optional(),
});

// Exported so its shape can be tested directly (schema-only, no Express/mocking) —
// its shape is kept in parity with GlossaryTerm by a schema-parity test.
export const updateTermSchema = z.object({
  source: z.string().min(1).optional(),
  translations: z.record(z.string(), z.string()).optional(),
  notes: z.string().optional(),
  constant: z.boolean().optional(),
});

const createGlossarySchema = z.object({
  name: z.string().min(1).max(128),
});

// Exported so its shape can be tested directly (schema-only, no Express/mocking) —
// a body-less POST (older clients / curl) still means a plain push, so the
// whole body is optional; only `replace` opts into a destructive re-upload.
export const pushDeepLSchema = z
  .object({ replace: z.boolean().optional(), confirmReplaceAll: z.boolean().optional() })
  .optional();

// Exported so its shape can be tested directly (schema-only, no Express/mocking) —
// its shape is kept in parity with GlossaryMeta by a schema-parity test.
export const updateGlossarySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  enabled: z.boolean().optional(),
  // When `enabled` is being set, the caller may opt out of the immediate
  // project-wide glossary sync (auto-applying matches to strings) by passing
  // `applyMatches: false`. Absent (or true) keeps the historical behavior: the
  // sync runs whenever `enabled` changes. Not persisted on the glossary.
  applyMatches: z.boolean().optional(),
});

/**
 * Body for AI glossary generation. All fields optional: a body-less POST still
 * validates and lets the server pick the cheapest suggest-capable module.
 */
const generateGlossarySchema = z
  .object({
    moduleId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    reasoningEffort: z.string().min(1).optional(),
    /** Entries to analyse; defaults to all entries in the project. */
    entryIds: z.array(z.string()).optional(),
    /**
     * Exact source-text values to restrict analysis to (AND'd with `entryIds`
     * when both are present). Lets the caller focus generation on specific
     * strings without knowing their entry ids.
     */
    focusSourceTexts: z.array(z.string().min(1)).optional(),
    excludeGlossaryIds: z.array(z.string()).optional(),
    contextFields: z.array(z.enum(['context', 'sources', 'categories'])).optional(),
    contextLanguages: z.array(z.string()).optional(),
    ignoreBatchSizeLimit: z.boolean().optional(),
    batchGrouping: z.enum(BATCH_GROUPING_DIMENSIONS).optional(),
    /**
     * Per-run override of how many distinct source strings each provider call
     * holds. `0` means unlimited. Mutually exclusive with
     * `batchGrouping`/`ignoreBatchSizeLimit`.
     */
    customBatchSize: z.number().int().min(0).optional(),
    skipCategories: z.array(z.string()).optional(),
    /** Also extract term translations from the context languages' existing translations. */
    includeTranslations: z.boolean().optional(),
  })
  .default({});

/** Body for translating a glossary's terms; all fields optional (cheapest module by default). */
const translateTermsSchema = z
  .object({
    moduleId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    reasoningEffort: z.string().min(1).optional(),
  })
  .default({});

// ─── Multi-glossary folder endpoints ────────────────────────────────────────

// GET /api/projects/:projectId/glossaries
glossaryRouter.get(
  '/:projectId/glossaries',
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const summaries = await getGlossaryStore().listGlossaries(projectId);
    res.json(summaries);
  }),
);

// POST /api/projects/:projectId/glossaries
glossaryRouter.post(
  '/:projectId/glossaries',
  requireUnlockedVault,
  validateBody(createGlossarySchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const { name } = req.body as z.infer<typeof createGlossarySchema>;
    const glossary = await getGlossaryStore().createGlossary(projectId, name);
    res.status(201).json(glossary);
  }),
);

// GET /api/projects/:projectId/glossaries/:glossaryId
glossaryRouter.get(
  '/:projectId/glossaries/:glossaryId',
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const glossary = await getGlossaryStore().getGlossary(
      projectId,
      req.params.glossaryId as string,
    );
    res.json(glossary);
  }),
);

// PATCH /api/projects/:projectId/glossaries/:glossaryId
glossaryRouter.patch(
  '/:projectId/glossaries/:glossaryId',
  requireUnlockedVault,
  validateBody(updateGlossarySchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    // `applyMatches` is a sync directive, not a stored field — keep it out of the
    // patch handed to the store.
    const { applyMatches, ...patch } = req.body as z.infer<typeof updateGlossarySchema>;
    const glossary = await getGlossaryStore().updateGlossary(
      projectId,
      req.params.glossaryId as string,
      patch,
    );
    // Re-assign glossary matches across the project whenever `enabled` changes,
    // unless the caller explicitly opted out (`applyMatches: false`) — e.g. the
    // user enabled the glossary but declined the auto-apply prompt.
    if (patch.enabled !== undefined && applyMatches !== false) {
      glossarySyncService.syncProject(projectId);
    }
    res.json(glossary);
  }),
);

// DELETE /api/projects/:projectId/glossaries/:glossaryId
glossaryRouter.delete(
  '/:projectId/glossaries/:glossaryId',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    await getGlossaryStore().deleteGlossary(projectId, req.params.glossaryId as string);
    glossarySyncService.syncProject(projectId);
    res.status(204).send();
  }),
);

// POST /api/projects/:projectId/glossaries/:glossaryId/terms
glossaryRouter.post(
  '/:projectId/glossaries/:glossaryId/terms',
  requireUnlockedVault,
  validateBody(addTermSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const body = req.body as z.infer<typeof addTermSchema>;
    const term = await getGlossaryStore().addTerm(projectId, req.params.glossaryId as string, body);
    glossarySyncService.syncProject(projectId);
    res.status(201).json(term);
  }),
);

// PATCH /api/projects/:projectId/glossaries/:glossaryId/terms/:termId
glossaryRouter.patch(
  '/:projectId/glossaries/:glossaryId/terms/:termId',
  requireUnlockedVault,
  validateBody(updateTermSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const body = req.body as z.infer<typeof updateTermSchema>;
    const access = await assertProjectAccess(projectId, { type: 'read' });
    assertGlossaryTermEditAllowed(access, body);
    const term = await getGlossaryStore().updateTerm(
      projectId,
      req.params.glossaryId as string,
      req.params.termId as string,
      body,
    );
    glossarySyncService.syncProject(projectId);
    res.json(term);
  }),
);

// DELETE /api/projects/:projectId/glossaries/:glossaryId/terms/:termId
glossaryRouter.delete(
  '/:projectId/glossaries/:glossaryId/terms/:termId',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    await getGlossaryStore().deleteTerm(
      projectId,
      req.params.glossaryId as string,
      req.params.termId as string,
    );
    glossarySyncService.syncProject(projectId);
    res.status(204).send();
  }),
);

// ─── Bulk import/export ──────────────────────────────────────────────────────

const exportQuerySchema = z.object({
  format: z.enum(['csv', 'tbx']).optional(),
});

// GET /api/projects/:projectId/glossaries/:glossaryId/export?format=csv|tbx
//
// CSV: one row per term — `source`, one column per language code, `constant`,
// `note`. TBX: minimal TBX-Basic subset; see utils/glossary-import-export.ts
// for the documented dialect.
glossaryRouter.get(
  '/:projectId/glossaries/:glossaryId/export',
  validateQuery(exportQuerySchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const glossaryId = req.params.glossaryId as string;
    const format = (req.query.format as 'csv' | 'tbx' | undefined) ?? 'csv';
    // Strip quotes/CRLF before interpolating into the Content-Disposition header
    // so a hostile id can't inject extra header directives (the `glossaryId`
    // param guard already restricts the charset; this is defence-in-depth).
    const safeId = glossaryId.replace(/["\r\n]/g, '');

    const [glossary, project] = await Promise.all([
      getGlossaryStore().getGlossary(projectId, glossaryId),
      getProjectStore().loadProject(projectId),
    ]);
    const languages = exportLanguageOrder(
      glossary.terms,
      project.activeLanguages,
      project.sourceLanguage,
    );

    if (format === 'tbx') {
      const tbx = glossaryToTbx(glossary, project.sourceLanguage, languages);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="glossary-${safeId}.tbx"`);
      res.send(tbx);
      return;
    }

    const csv = glossaryToCsv(glossary, languages);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="glossary-${safeId}.csv"`);
    res.send(csv);
  }),
);

// Anti-malware hardening: extension allowlist (CSV or TBX/XML) plus, once
// buffered, magic-byte content verification (see utils/file-validation.ts).
const GLOSSARY_IMPORT_EXTENSIONS = ['.csv', '.tbx', '.xml'];
const glossaryUpload = singleFileUpload({
  maxBytes: 20 * 1024 * 1024, // 20 MB
  fileFilter: extensionFileFilter(GLOSSARY_IMPORT_EXTENSIONS),
});

// POST /api/projects/:projectId/glossaries/:glossaryId/import
//
// Multipart upload (`file` field). Form fields:
//   - `dryRun`  — "true" to return the add/update/conflict diff without
//                 committing (same preview pattern as M2 CsvImporter).
//   - `format`  — "csv" | "tbx"; defaults from the file extension
//                 (.tbx/.xml → tbx, anything else → csv).
//
// Apply goes through GlossaryManager.addTerm/updateTerm (per-glossary write
// lock) and then kicks M21 GlossarySyncService so assignedGlossaryIds on
// entries stay correct. `repushRequired` is true when the glossary had been
// pushed to DeepL before this import changed it.
glossaryRouter.post(
  '/:projectId/glossaries/:glossaryId/import',
  requireUnlockedVault,
  glossaryUpload,
  requireFile,
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const glossaryId = req.params.glossaryId as string;

    validateUploadedFile(req.file!.originalname, req.file!.buffer, {
      allowedExtensions: GLOSSARY_IMPORT_EXTENSIONS,
    });

    const body = (req.body ?? {}) as { dryRun?: string; format?: string };
    const dryRun = body.dryRun === 'true';
    const filename = req.file!.originalname.toLowerCase();
    const format =
      body.format === 'tbx' || body.format === 'csv'
        ? body.format
        : filename.endsWith('.tbx') || filename.endsWith('.xml')
          ? 'tbx'
          : 'csv';

    const [glossary, project] = await Promise.all([
      getGlossaryStore().getGlossary(projectId, glossaryId),
      getProjectStore().loadProject(projectId),
    ]);
    if (glossary.readOnly) {
      throw new ReadOnlyGlossaryError(glossaryId);
    }

    const content = req.file!.buffer.toString('utf-8');
    let parsed: GlossaryParseResult;
    try {
      parsed =
        format === 'tbx'
          ? parseGlossaryTbx(content, project.sourceLanguage)
          : parseGlossaryCsv(content);
    } catch (err) {
      // Surface as a ValidationError so the central error handler produces the
      // uniform `{ error }` shape (400) instead of an ad-hoc inline response.
      throw new ValidationError(err instanceof Error ? err.message : 'Failed to parse file');
    }

    // A CSV may carry a column for the project source language (e.g. "en" or
    // "English"); the source text lives in the `source` column, so drop it
    // from the translations map rather than storing a self-translation.
    for (const term of parsed.terms) {
      delete term.translations[project.sourceLanguage];
    }

    const diff = diffGlossaryImport(glossary.terms, parsed.terms);
    const hasChanges =
      diff.added.length > 0 || diff.updated.length > 0 || diff.conflicts.length > 0;
    const repushRequired = hasChanges && glossary.pushedToDeepLAt !== undefined;

    if (dryRun) {
      res.json({
        dryRun: true,
        format,
        diff,
        unrecognizedHeaders: parsed.unrecognizedHeaders,
        skippedRows: parsed.skippedRows,
        repushRequired,
      });
      return;
    }

    for (const term of diff.added) {
      await getGlossaryStore().addTerm(projectId, glossaryId, term);
    }
    for (const update of [...diff.updated, ...diff.conflicts]) {
      await getGlossaryStore().updateTerm(projectId, glossaryId, update.termId, update.after);
    }
    if (hasChanges) {
      glossarySyncService.syncProject(projectId);
    }

    res.json({
      applied: {
        added: diff.added.length,
        updated: diff.updated.length,
        conflicts: diff.conflicts.length,
      },
      unchanged: diff.unchanged,
      unrecognizedHeaders: parsed.unrecognizedHeaders,
      skippedRows: parsed.skippedRows,
      repushRequired,
    });
  }),
);

// ─── Legacy default-glossary endpoints (backward compat) ────────────────────

// GET /api/projects/:projectId/glossary
glossaryRouter.get(
  '/:projectId/glossary',
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const glossary = await getGlossaryStore().getGlossary(projectId, 'default');
    res.json(glossary);
  }),
);

// POST /api/projects/:projectId/glossary/terms
glossaryRouter.post(
  '/:projectId/glossary/terms',
  requireUnlockedVault,
  validateBody(addTermSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const body = req.body as z.infer<typeof addTermSchema>;
    const term = await getGlossaryStore().addTerm(projectId, body);
    glossarySyncService.syncProject(projectId);
    res.status(201).json(term);
  }),
);

// PATCH /api/projects/:projectId/glossary/terms/:termId
glossaryRouter.patch(
  '/:projectId/glossary/terms/:termId',
  requireUnlockedVault,
  validateBody(updateTermSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const body = req.body as z.infer<typeof updateTermSchema>;
    const access = await assertProjectAccess(projectId, { type: 'read' });
    assertGlossaryTermEditAllowed(access, body);
    const term = await getGlossaryStore().updateTerm(projectId, req.params.termId as string, body);
    glossarySyncService.syncProject(projectId);
    res.json(term);
  }),
);

// DELETE /api/projects/:projectId/glossary/terms/:termId
glossaryRouter.delete(
  '/:projectId/glossary/terms/:termId',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    await getGlossaryStore().deleteTerm(projectId, req.params.termId as string);
    glossarySyncService.syncProject(projectId);
    res.status(204).send();
  }),
);

// POST /api/projects/:projectId/glossaries/:glossaryId/push-deepl
glossaryRouter.post(
  '/:projectId/glossaries/:glossaryId/push-deepl',
  requireUnlockedVault,
  validateBody(pushDeepLSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const body = req.body as { replace?: boolean; confirmReplaceAll?: boolean } | undefined;
    const replace = body?.replace === true;
    if (replace && body?.confirmReplaceAll !== true) {
      throw new ValidationError(
        "replace requires confirmReplaceAll — this erases every project's DeepL glossary entries, not just this project's",
      );
    }
    const result = await getGlossaryStore().pushToDeepL(
      projectId,
      req.params.glossaryId as string,
      getSessionId(res),
      { replace },
    );
    res.json(result);
  }),
);

// POST /api/projects/:projectId/glossaries/:glossaryId/translate-terms
//
// Fills in the MISSING per-language translations of a glossary's own terms by
// asking a translate-capable module to translate each term's source into the
// project's active languages. Constant terms and already-filled cells are left
// untouched. Synchronous (like push-deepl/import): glossaries are bounded.
// Returns `{ translated, terms }`. 423 when the vault is locked, 403 for a
// read-only glossary, 409 when no translate-capable module is available.
glossaryRouter.post(
  '/:projectId/glossaries/:glossaryId/translate-terms',
  requireUnlockedVault,
  validateBody(translateTermsSchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const body = req.body as z.infer<typeof translateTermsSchema>;
    // GlossaryTranslateNotPossibleError (409) / ReadOnlyGlossaryError (403)
    // propagate to the central error handler.
    const result = await translateGlossaryTerms(
      projectId,
      req.params.glossaryId as string,
      {
        ...(body.moduleId ? { moduleId: body.moduleId } : {}),
        ...(body.model ? { model: body.model } : {}),
        ...(body.reasoningEffort ? { reasoningEffort: body.reasoningEffort } : {}),
      },
      getSessionId(res),
    );
    res.json(result);
  }),
);

// POST /api/projects/:projectId/glossary/push-deepl (legacy — pushes default glossary)
glossaryRouter.post(
  '/:projectId/glossary/push-deepl',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const result = await getGlossaryStore().pushToDeepL(projectId, 'default', getSessionId(res));
    res.json(result);
  }),
);

// POST /api/projects/:projectId/glossary/generate
//
// AI glossary generation: starts a NON-BLOCKING background run that asks an LLM
// module to suggest glossaries (named groups of recurring custom terms and
// proper nouns) from the project's source text. The run is tracked via M22 (so
// the Activity tab gets progress/cancel for free) and the user can close the
// dialog or navigate away while it runs. Returns 202 `{ runId, total, status }`;
// poll `/runs` for progress and read the suggestions from `.../glossary/generate/
// :runId` when the run completes. 423 when the vault is locked, 409 when no
// suggest-capable module is available.
glossaryRouter.post(
  '/:projectId/glossary/generate',
  requireUnlockedVault,
  validateBody(generateGlossarySchema),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    await assertProjectAccess(projectId, { type: 'manage' });
    const body = req.body as z.infer<typeof generateGlossarySchema>;
    // GlossaryGenerateNotPossibleError (409) propagates to the central error
    // handler.
    await enqueueRun(res, () =>
      glossaryGenEngine.enqueue(
        projectId,
        {
          ...(body.moduleId ? { moduleId: body.moduleId } : {}),
          ...(body.model ? { model: body.model } : {}),
          ...(body.reasoningEffort ? { reasoningEffort: body.reasoningEffort } : {}),
          ...(body.entryIds && body.entryIds.length > 0 ? { entryIds: body.entryIds } : {}),
          ...(body.focusSourceTexts && body.focusSourceTexts.length > 0
            ? { focusSourceTexts: body.focusSourceTexts }
            : {}),
          ...(body.excludeGlossaryIds ? { excludeGlossaryIds: body.excludeGlossaryIds } : {}),
          ...(body.contextFields ? { contextFields: body.contextFields } : {}),
          ...(body.contextLanguages ? { contextLanguages: body.contextLanguages } : {}),
          ...(body.ignoreBatchSizeLimit !== undefined
            ? { ignoreBatchSizeLimit: body.ignoreBatchSizeLimit }
            : {}),
          ...(body.batchGrouping ? { batchGrouping: body.batchGrouping } : {}),
          ...(body.customBatchSize !== undefined ? { customBatchSize: body.customBatchSize } : {}),
          ...(body.skipCategories && body.skipCategories.length > 0
            ? { skipCategories: body.skipCategories }
            : {}),
          ...(body.includeTranslations ? { includeTranslations: true } : {}),
        },
        getSessionId(res),
      ),
    );
  }),
);

// GET /api/projects/:projectId/glossary/generate/:runId
//
// Returns the glossaries a completed (or cancelled) generation run suggested —
// the disaggregated detail behind the run's summary. Shape:
// `{ suggestions: GlossarySuggestion[] }`. Empty for non-glossary-gen runs or
// runs that recorded nothing. Read-only stored data, so no vault gate.
// `assertRunVisible` applies the same own-run rule as every other run-scoped
// read — a collaborator reading another member's (or the owner's) run 404s,
// same as a missing run.
glossaryRouter.get(
  '/:projectId/glossary/generate/:runId',
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const runId = req.params.runId as string;
    await assertRunVisible(projectId, runId);
    await respondSuggestions(res, () => getRunStore().getGlossarySuggestions(projectId, runId));
  }),
);
