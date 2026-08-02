/**
 * Quality dashboard routes.
 *
 * - GET /api/projects/:id/lqa-summary — aggregated LQA pass rates / issue
 *   counts (cached by strings.json mtime, see services/lqa-summary.ts).
 */
import { Router } from 'express';
import { lqaSummaryService } from '../services/lqa-summary.js';
import { asyncHandler } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';

export const reportsRouter: Router = Router();

// Validate `:id` against path traversal for every route below (400 centrally on
// a hostile id), so handlers can read the pre-validated value directly.
reportsRouter.param('id', projectIdParam);

// GET /api/projects/:id/lqa-summary
reportsRouter.get(
  '/:id/lqa-summary',
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    const summary = await lqaSummaryService.getSummary(projectId);
    res.json(summary);
  }),
);
