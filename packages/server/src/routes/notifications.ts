import { Router } from 'express';
import { getNotificationStore } from '../storage/registry.js';
import { asyncHandler } from '../http/index.js';
import { logger } from '../modules/M15-console-logger.js';

export const notificationsRouter: Router = Router();

/**
 * GET /api/notifications
 * Lists the current tenant's notifications (newest 50, newest-first) plus
 * the unread count. Ambient-tenant only — identityMiddleware has already
 * established the RLS tenant context by the time this handler runs (mirrors
 * tm.ts), so no explicit userId/runWithTenant wiring is needed here.
 */
notificationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    // Two independent reads, each its own withTenantTransaction — mirrors
    // glossary.ts's `Promise.all([getGlossaryStore()..., getProjectStore()...])`
    // export-route pattern. countUnread() can't be derived from the 50-row
    // listForCurrentUser() result (it's deliberately NOT windowed to that cap),
    // so both calls are needed.
    const [notifications, unreadCount] = await Promise.all([
      getNotificationStore().listForCurrentUser(),
      getNotificationStore().countUnread(),
    ]);
    res.json({ notifications, unreadCount });
  }),
);

/**
 * POST /api/notifications/:id/read
 * Marks one notification read. The store treats a foreign/missing id as a
 * silent no-op (RLS-scoped, not an explicit filter) rather than signaling a
 * miss, so this always returns 204 — never a 404 the store can't produce.
 */
notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    await getNotificationStore().markRead(id);
    logger.info('notifications:read', { id });
    res.status(204).send();
  }),
);

/**
 * POST /api/notifications/read-all
 * Marks every currently-unread notification for the current tenant read.
 */
notificationsRouter.post(
  '/read-all',
  asyncHandler(async (_req, res) => {
    const result = await getNotificationStore().markAllRead();
    logger.info('notifications:read-all', { count: result.count });
    res.json(result);
  }),
);

/**
 * DELETE /api/notifications/:id
 * Dismisses one notification. Same foreign/missing-id no-op semantics as
 * markRead above — always 204.
 */
notificationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    await getNotificationStore().delete(id);
    logger.info('notifications:deleted', { id });
    res.status(204).send();
  }),
);
