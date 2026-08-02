import { Router } from 'express';
import { z } from 'zod';
import { batchAnalyzer } from '../modules/M12-batch-analyzer.js';
import { moduleRegistry } from '../modules/M6-module-registry.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';
import { getStringStore } from '../storage/registry.js';

export const batchRouter: Router = Router({ mergeParams: true });

// Validate `:projectId` against path traversal (400 centrally on a hostile id);
// the handler then reads the pre-validated value directly.
batchRouter.param('projectId', projectIdParam);

const analyzeSchema = z.object({
  entryIds: z.array(z.string()).min(1),
  targetLanguages: z.array(z.string()).min(1),
});

batchRouter.post(
  '/:projectId/analyze',
  validateBody(analyzeSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const { entryIds, targetLanguages } = req.body as z.infer<typeof analyzeSchema>;
    const all = await getStringStore().load(projectId);
    const wanted = new Set(entryIds);
    const entries = all.filter((e) => wanted.has(e.id));
    const modules = moduleRegistry.listModules();
    const analysis = batchAnalyzer.analyze(entries, targetLanguages, modules);
    res.json(analysis);
  }),
);
