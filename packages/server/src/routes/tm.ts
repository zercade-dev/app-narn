import { Router } from 'express';
import { getTranslationMemory } from '../storage/registry.js';
import { asyncHandler } from '../http/index.js';
import { logger } from '../modules/M15-console-logger.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { rateLimiter } from '../middleware/rate-limiter.js';

export const tmRouter: Router = Router();

// The whole-memory clear is irreversible; bound how fast it can be fired so a
// runaway frontend loop or stray script can't repeatedly wipe the TM.
const clearTmRateLimiter = rateLimiter({ maxRequests: 30, windowMs: 60_000 });

/**
 * GET /api/tm/segments
 * Lists all translation-memory segments (global, cross-project).
 */
tmRouter.get(
  '/segments',
  asyncHandler(async (_req, res) => {
    const segments = await getTranslationMemory().list();
    res.json({ segments });
  }),
);

/**
 * DELETE /api/tm/segments
 * Clears the entire (global, cross-project) translation memory. Returns the
 * number of segments removed. Irreversible — so it requires an unlocked vault
 * (a human-present proxy) and is rate-limited, like its destructive peers.
 */
tmRouter.delete(
  '/segments',
  requireUnlockedVault,
  clearTmRateLimiter,
  asyncHandler(async (_req, res) => {
    const cleared = await getTranslationMemory().clearAll();
    logger.info('tm:cleared', { cleared });
    res.json({ cleared });
  }),
);

/**
 * DELETE /api/tm/segments/:key/variants/:variantId
 * Deletes a single stored variant. Removes the segment when it becomes empty.
 */
tmRouter.delete(
  '/segments/:key/variants/:variantId',
  asyncHandler(async (req, res) => {
    const { key, variantId } = req.params as { key: string; variantId: string };
    const deleted = await getTranslationMemory().deleteVariant(key, variantId);
    if (!deleted) {
      res.status(404).json({ error: 'tm-variant-not-found' });
      return;
    }
    logger.info('tm:variant-deleted', { key, variantId });
    res.status(204).send();
  }),
);
