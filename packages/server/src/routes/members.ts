import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../http/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { assertProjectAccess } from '../middleware/authz.js';
import { getMemberStore, getProjectStore } from '../storage/registry.js';
import { requireTenant } from '../storage/pg/tenant-context.js';
import { ProjectNotFoundError, ValidationError } from '../types/errors.js';

const writableLanguagesSchema = z.object({
  writableLanguages: z.array(z.string().min(1)).max(64),
});

/**
 * Project-membership management. Listing is member-visible (RLS scopes rows:
 * owner sees all, collaborator only self); language grants and removals are
 * owner-only, except self-removal (leave), which any collaborator may do.
 * Language sets are validated against the project's activeLanguages and
 * never include the source language.
 */
export const membersRouter: Router = Router({ mergeParams: true });

membersRouter.get(
  '/:projectId/members',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    await assertProjectAccess(projectId, { type: 'read' });
    res.json(await getMemberStore().listMembers(projectId));
  }),
);

membersRouter.patch(
  '/:projectId/members/:userId',
  validateBody(writableLanguagesSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const userId = req.params.userId as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const { writableLanguages } = req.body as z.infer<typeof writableLanguagesSchema>;
    const project = await getProjectStore().loadProject(projectId);
    for (const lang of writableLanguages) {
      if (lang === project.sourceLanguage) {
        throw new ValidationError('the source language is never writable by a collaborator');
      }
      if (!project.activeLanguages.includes(lang)) {
        throw new ValidationError(
          `language '${lang}' is not one of the project's active languages`,
        );
      }
    }
    const updated = await getMemberStore().updateWritableLanguages(projectId, userId, [
      ...new Set(writableLanguages),
    ]);
    if (!updated) throw new ProjectNotFoundError(projectId); // no such collaborator row → uniform 404
    res.json(updated);
  }),
);

membersRouter.delete(
  '/:projectId/members/:userId',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const userId = req.params.userId as string;
    const self = requireTenant().userId;
    if (userId === self) {
      // Leave: any member may delete their own collaborator row (the store
      // pins role='collaborator', so an owner "leaving" their own project is
      // a no-op 404 — owners delete the project instead).
      await assertProjectAccess(projectId, { type: 'read' });
    } else {
      await assertProjectAccess(projectId, { type: 'manage' });
    }
    const removed = await getMemberStore().removeMember(projectId, userId);
    if (!removed) throw new ProjectNotFoundError(projectId);
    res.status(204).send();
  }),
);
