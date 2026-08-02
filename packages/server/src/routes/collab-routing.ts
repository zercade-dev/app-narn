import { Router } from 'express';
import type { z } from 'zod';
import { getCollabRoutingStore } from '../storage/registry.js';
import type { CollabRoutingConfig } from '../storage/types.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../http/index.js';
import { logger } from '../modules/M15-console-logger.js';
import { routingRulesBodySchema } from './projects.js';

export const collabRoutingRouter: Router = Router();

/**
 * Per-user collaboration routing: one routing document per tenant, shared across
 * every project the user collaborates on. Ambient-tenant only — identityMiddleware
 * has already established the RLS tenant context by the time these handlers
 * run (mirrors notifications.ts/tm.ts). Mounted at `/api/collab-routing`, a
 * per-user surface — NOT under `/api/projects`, and not vault-gated (no LLM
 * credential dependency, same reasoning as tmRouter/notificationsRouter).
 */

/**
 * GET /api/collab-routing
 * Returns the ambient tenant's saved routing document, or a default empty
 * one (`{ routingRules: [] }`) when nothing has been saved yet — so the
 * frontend never has to null-branch.
 */
collabRoutingRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const config = await getCollabRoutingStore().get();
    res.json(config ?? { routingRules: [] });
  }),
);

/**
 * PUT /api/collab-routing
 * Whole-document replace of the ambient tenant's collab routing. Body is the
 * SAME routing-rules schema `routes/projects.ts` validates project-scoped
 * `PUT /:id/routing-rules` against (`{ rules, groups?, activeGroupId? }`),
 * reused (not duplicated) and mapped onto `CollabRoutingConfig`'s field
 * names.
 */
collabRoutingRouter.put(
  '/',
  validateBody(routingRulesBodySchema),
  asyncHandler(async (req, res) => {
    const { rules, groups, activeGroupId } = req.body as z.infer<typeof routingRulesBodySchema>;
    const config: CollabRoutingConfig = {
      routingRules: rules,
      routingRuleGroups: groups,
      activeRoutingRuleGroupId: activeGroupId ?? null,
    };
    const saved = await getCollabRoutingStore().save(config);
    logger.info('Collab routing updated', { ruleCount: rules.length });
    res.json(saved);
  }),
);
