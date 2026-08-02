import { Router } from 'express';
import { z } from 'zod';
import { contentClassifier } from '../modules/M5-content-classifier.js';
import { categoryGenEngine } from '../modules/M29-category-gen-engine.js';
import { createSnapshot } from '../modules/auto-snapshot.js';
import { getRunStore } from '../storage/registry.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler, enqueueRun, respondSuggestions } from '../http/index.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { projectIdParam } from '../middleware/path-params.js';
import { getSessionId } from '../middleware/session.js';
import { assertProjectAccess, assertRunVisible } from '../middleware/authz.js';

export const classifyRouter: Router = Router();

// Validate the project id against path traversal for every route below — runs
// whenever `:id` is matched so no handler can reach a store with a hostile id.
classifyRouter.param('id', projectIdParam);

const addCategorySchema = z.object({ category: z.string() });

const suggestCategoriesSchema = z.object({
  moduleId: z.string().min(1),
  model: z.string().optional(),
  reasoningEffort: z.string().optional(),
  entryIds: z.array(z.string()).optional(),
  includeExisting: z.boolean().optional(),
  maxCategories: z.number().int().positive().max(40).optional(),
  contextFields: z.array(z.enum(['context', 'sources', 'categories'])).optional(),
  contextLanguages: z.array(z.string()).optional(),
  ignoreBatchSizeLimit: z.boolean().optional(),
  batchGrouping: z.enum(['none', 'category', 'glossary', 'both']).optional(),
  /**
   * Per-run override of how many entries each provider call holds. `0` means
   * unlimited. Mutually exclusive with `batchGrouping`/`ignoreBatchSizeLimit`.
   */
  customBatchSize: z.number().int().min(0).optional(),
  skipCategories: z.array(z.string()).optional(),
  excludeGlossaryIds: z.array(z.string()).optional(),
});

const assignCategoriesSchema = z.object({
  suggestions: z
    .array(
      z.object({
        category: z.string().min(1),
        entryIds: z.array(z.string()).min(1),
      }),
    )
    .min(1),
});

// GET /api/projects/:id/categories
classifyRouter.get(
  '/:id/categories',
  asyncHandler(async (req, res) => {
    const categories = await contentClassifier.getCategories(req.params.id);
    res.json(categories);
  }),
);

// POST /api/projects/:id/categories/suggest — start a NON-BLOCKING AI category
// generation run (M28). Returns 202 `{ runId, status }` immediately; the LLM
// work runs in the background and its progress shows in the Activity tab. The
// suggestions are persisted to a sidecar and fetched from the results endpoint
// below when the run completes. Vault must be unlocked because the LLM call
// reads credentials from M16. A bad module / missing model surfaces as a failed
// run (visible in the Activity tab), since the frontend only offers capable
// modules.
classifyRouter.post(
  '/:id/categories/suggest',
  requireUnlockedVault,
  validateBody(suggestCategoriesSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const body = req.body as z.infer<typeof suggestCategoriesSchema>;
    const sessionId = getSessionId(res);
    await enqueueRun(res, () => categoryGenEngine.enqueue(projectId, body, sessionId));
  }),
);

// GET /api/projects/:id/categories/suggestions/:runId — read the suggestions a
// category-generation run produced. Returns `{ suggestions }` (empty for a run
// that is still running, failed, or recorded none). Read-only stored data, so
// no vault gate. `assertRunVisible` applies the same own-run rule as every
// other run-scoped read — a collaborator reading another member's (or the
// owner's) run 404s, same as a missing run.
classifyRouter.get(
  '/:id/categories/suggestions/:runId',
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    const runId = req.params.runId as string;
    await assertRunVisible(projectId, runId);
    await respondSuggestions(res, () => getRunStore().getCategorySuggestions(projectId, runId));
  }),
);

// POST /api/projects/:id/categories/assign — apply accepted suggestions by
// adding each category to its assigned entries (via the same add-category path).
classifyRouter.post(
  '/:id/categories/assign',
  requireUnlockedVault,
  validateBody(assignCategoriesSchema),
  asyncHandler(async (req, res) => {
    const { suggestions } = req.body as z.infer<typeof assignCategoriesSchema>;
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    // Safety snapshot right before persisting accepted suggestions, so a bad
    // batch can be rolled back. The schema enforces `suggestions.min(1)`, so this
    // only ever fires on a real change. Awaited before the assign and not caught
    // → fail-closed: a snapshot failure aborts the assign (nothing is written).
    await createSnapshot(projectId, 'pre-accept');
    const updated = await contentClassifier.assignCategories(projectId, suggestions);
    res.json({ updated: updated.length });
  }),
);

// POST /api/projects/:id/strings/:entryId/categories
classifyRouter.post(
  '/:id/strings/:entryId/categories',
  requireUnlockedVault,
  validateBody(addCategorySchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const { category } = req.body as z.infer<typeof addCategorySchema>;
    const updated = await contentClassifier.addCategory(
      projectId,
      req.params.entryId as string,
      category,
    );
    res.json(updated);
  }),
);

// DELETE /api/projects/:id/categories/:category — remove a whole category from
// every entry that carries it and drop its description. Vault-gated (mutating).
// A safety snapshot is taken first (mirrors /categories/assign) so a mistaken
// bulk delete is recoverable.
classifyRouter.delete(
  '/:id/categories/:category',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    // Express already url-decodes route params — decoding again here would
    // throw URIError on a literal `%` and silently mis-delete for `a%20b`.
    const category = req.params.category as string;
    await createSnapshot(projectId, 'pre-accept');
    const removed = await contentClassifier.deleteCategory(projectId, category);
    res.json({ removed });
  }),
);

// DELETE /api/projects/:id/strings/:entryId/categories/:category
classifyRouter.delete(
  '/:id/strings/:entryId/categories/:category',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    // Express already url-decodes route params — see the sibling DELETE
    // /:id/categories/:category handler above for why decoding again is wrong.
    const category = req.params.category as string;
    const updated = await contentClassifier.removeCategory(
      projectId,
      req.params.entryId as string,
      category,
    );
    res.json(updated);
  }),
);
