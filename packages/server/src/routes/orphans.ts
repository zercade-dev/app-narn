import { Router } from 'express';
import { z } from 'zod';
import type { StringEntry } from '@zercade-dev/narn-shared';
import { orphanManager } from '../modules/M11-orphan-manager.js';
import { getOrphanIds, removeOrphanId } from '../modules/orphan-id-store.js';
import { relinkRetranslateEngine } from '../modules/M30-relink-retranslate-engine.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../http/index.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { getSessionId } from '../middleware/session.js';
import { projectIdParam } from '../middleware/path-params.js';
import { getStringStore } from '../storage/registry.js';
import { assertProjectAccess } from '../middleware/authz.js';

export const orphansRouter: Router = Router();

// Validate the project id against path traversal for every route below — runs
// whenever `:id` is matched so no handler can reach a store with a hostile id.
orphansRouter.param('id', projectIdParam);

// GET /api/projects/:id/orphans
orphansRouter.get(
  '/:id/orphans',
  asyncHandler(async (req, res) => {
    const ids = getOrphanIds(req.params.id as string);
    const orphans = await orphanManager.listOrphans(req.params.id as string, ids);
    res.json(orphans);
  }),
);

// DELETE /api/projects/:id/orphans/:entryId
orphansRouter.delete(
  '/:id/orphans/:entryId',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    await orphanManager.deleteOrphan(projectId, req.params.entryId as string);
    removeOrphanId(projectId, req.params.entryId as string);
    res.status(204).send();
  }),
);

const bulkDeleteSchema = z.object({ ids: z.array(z.string()).min(1) });

// POST /api/projects/:id/orphans/bulk-delete
orphansRouter.post(
  '/:id/orphans/bulk-delete',
  requireUnlockedVault,
  validateBody(bulkDeleteSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const { ids } = req.body as z.infer<typeof bulkDeleteSchema>;
    const deleted: string[] = [];
    for (const entryId of ids) {
      try {
        await orphanManager.deleteOrphan(projectId, entryId);
        removeOrphanId(projectId, entryId);
        deleted.push(entryId);
      } catch {
        // skip entries that no longer exist
      }
    }
    res.json({ deleted });
  }),
);

export const relinkSchema = z.object({
  newSourceId: z.string().min(1),
  /** 'empty-only' (default) fills only missing target slots; 'all' overwrites every language the orphan has. */
  overrideMode: z.enum(['all', 'empty-only']).optional(),
  /** When true, kicks off a background AI retranslate pass after the merge (see M30). */
  retranslateWithAi: z.boolean().optional(),
  /** Module/model/effort for the AI pass; meaningful only with retranslateWithAi. */
  moduleId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  reasoningEffort: z.string().min(1).optional(),
});

// POST /api/projects/:id/orphans/:orphanId/relink
orphansRouter.post(
  '/:id/orphans/:orphanId/relink',
  requireUnlockedVault,
  validateBody(relinkSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const orphanId = req.params.orphanId as string;
    const { newSourceId, overrideMode, retranslateWithAi, moduleId, model, reasoningEffort } =
      req.body as z.infer<typeof relinkSchema>;

    // Capture the orphan's OLD source text and BOTH entries' translations
    // BEFORE relinkOrphan mutates them — relink deletes the orphan row and
    // merges its texts onto the target, so this is the only moment the AI
    // retranslate pass can see the true previous-source translations (the
    // orphan's, all languages) and the target's own pre-merge texts (see M30
    // buildEditTransferContext). Only fetched when actually requested, to
    // avoid extra reads on the common (non-AI) path.
    const textsByLanguage = (entry: { translations?: StringEntry['translations'] }) =>
      Object.fromEntries(
        Object.entries(entry.translations ?? {}).flatMap(([lang, rec]) =>
          rec?.text ? [[lang, rec.text]] : [],
        ),
      );
    let orphanSourceText: string | undefined;
    let previousTranslations: Record<string, string> | undefined;
    let currentTranslations: Record<string, string> | undefined;
    if (retranslateWithAi) {
      const orphanEntry = await getStringStore().getById(projectId, orphanId);
      const targetEntry = await getStringStore().getById(projectId, newSourceId);
      orphanSourceText = orphanEntry.sourceText;
      previousTranslations = textsByLanguage(orphanEntry);
      currentTranslations = textsByLanguage(targetEntry);
    }

    const updated = await orphanManager.relinkOrphan(
      projectId,
      orphanId,
      newSourceId,
      overrideMode ?? 'empty-only',
    );
    removeOrphanId(projectId, orphanId);

    // The AI retranslate pass is a background run (Activity tab), started
    // AFTER the relink itself succeeds. A failure to start it (e.g. no
    // AI-capable module enabled — RelinkRetranslateNotPossibleError) must not
    // fail the relink that already happened; surface it on the response
    // instead of letting it propagate to the central error handler.
    let retranslateRunId: string | undefined;
    let retranslateError: string | undefined;
    if (retranslateWithAi && orphanSourceText !== undefined) {
      try {
        const sessionId = getSessionId(res);
        const result = await relinkRetranslateEngine.enqueue(
          projectId,
          {
            entryId: newSourceId,
            oldSourceText: orphanSourceText,
            ...(previousTranslations ? { previousTranslations } : {}),
            ...(currentTranslations ? { currentTranslations } : {}),
            ...(moduleId ? { moduleId } : {}),
            ...(model ? { model } : {}),
            ...(reasoningEffort ? { reasoningEffort } : {}),
          },
          sessionId,
        );
        retranslateRunId = result.runId;
      } catch (err) {
        retranslateError = err instanceof Error ? err.message : String(err);
      }
    }

    res.json({
      ...updated,
      ...(retranslateRunId ? { retranslateRunId } : {}),
      ...(retranslateError ? { retranslateError } : {}),
    });
  }),
);

// GET /api/projects/:id/orphans/candidates — live entries usable as relink targets
// Optional `?orphanId=` ranks the candidates by pg_trgm similarity of THEIR
// sourceText to that orphan's sourceText (source-to-source only — never
// against translations), most-similar first; the frontend's search box further
// narrows client-side on top of this ranking. Without `orphanId` (legacy/
// back-compat callers), falls back to the unranked full list.
orphansRouter.get(
  '/:id/orphans/candidates',
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    const excludeIds = getOrphanIds(projectId);
    const orphanId = typeof req.query.orphanId === 'string' ? req.query.orphanId : undefined;

    if (orphanId) {
      const orphan = await getStringStore().getById(projectId, orphanId);
      const ranked = await getStringStore().rankBySourceSimilarity(projectId, orphan.sourceText, [
        ...excludeIds,
        orphanId,
      ]);
      res.json(ranked);
      return;
    }

    const excluded = new Set(excludeIds);
    const entries = await getStringStore().load(projectId);
    res.json(
      entries
        .filter((e) => !excluded.has(e.id) && e.orphanedAt == null)
        .map((e) => ({ id: e.id, sourceText: e.sourceText })),
    );
  }),
);
