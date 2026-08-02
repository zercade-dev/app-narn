import { Router } from 'express';
import { describeChecks } from '../modules/M10/registry.js';

export const lqaRouter: Router = Router();

// GET /api/lqa/checks — pipeline check descriptors for the config UI
lqaRouter.get('/checks', (_req, res) => {
  res.json({
    checks: describeChecks(),
  });
});
