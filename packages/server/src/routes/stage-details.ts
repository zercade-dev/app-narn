/**
 * Stage details HTTP surface.
 *
 * `PATCH /api/projects/:projectId/stage-details` patches the three stage-detail
 * fields (`name`, `gameplayDetails`, `stageDescription`) on a project: source
 * text, an optional advisory `maxLength`, and per-language translations.
 * Mirrors `projects.ts`'s manual-edit-audit PATCH (`routes/projects.ts:282`)
 * for the store accessor (`getProjectStore()`) and 404-on-`ProjectNotFoundError`
 * mapping (thrown by `loadProject`/`updateProject`, caught centrally by
 * `middleware/error-handler.ts`).
 *
 * Built as a factory (`createStageDetailsRouter`), matching
 * `createColorTextRouter` (`routes/color-text.ts`). The same router
 * instance carries `PATCH /`, `POST /translate`, and `POST /chat`
 * without re-plumbing the project-id path validation below.
 *
 * `POST /translate` enqueues an M31 `StageDetailsEngine` run: vault must
 * be unlocked (else 423, `requireUnlockedVault`), the body is validated by
 * `translateBodySchema`, authorization is `assertProjectAccess({type: 'read'})`
 * + `assertStageDetailsTranslateAllowed` (middleware/authz.ts) BEFORE
 * `enqueue` runs (a denied request creates no run), and the engine's
 * `{runId, status}` is returned as `202`. The engine is injected via
 * the factory (defaulting to the production singleton) so route tests
 * can fake it, mirroring `createColorTextRouter`'s `streamChat` seam.
 *
 * `POST /chat` streams an AI chat completion as `text/plain` via the shared
 * `streamPlainTextResponse` helper. Vault must be unlocked (423), the
 * body is validated by `chatBodySchema`, and authorization is READ-only
 * (`assertProjectAccess({type:'read'})`) — chat writes nothing, so applying
 * a proposal goes through the already-gated PATCH. The stage-details context
 * is loaded once and passed to the pure `streamStageChat` service (injected
 * via the second factory arg so route tests can stub the provider stream).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  emptyStageDetails,
  type StageDetailFieldId,
  type StageDetails,
} from '@zercade-dev/narn-shared';
import { getProjectStore } from '../storage/registry.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../http/index.js';
import { streamPlainTextResponse } from '../http/stream-chat-response.js';
import {
  streamStageChat as defaultStreamStageChat,
  type StageChatParams,
} from '../services/stage-details-chat.js';
import {
  openChatRun,
  logChatDispatch,
  instrumentChatTurn,
  type ChatTurnMeta,
  type ChatUsageRef,
} from '../services/chat-observability.js';
import { ensureProjectId } from '../utils/project-path.js';
import {
  assertProjectAccess,
  assertStageDetailsPatchAllowed,
  assertStageDetailsTranslateAllowed,
} from '../middleware/authz.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { getSessionId } from '../middleware/session.js';
import {
  stageDetailsEngine,
  type StageDetailsEngine,
  type StageDetailsRunRequest,
} from '../modules/M31-stage-details-engine.js';

const translationPatch = z.object({
  text: z.string().max(20000),
  moduleId: z.enum(['manual', 'chat']).default('manual'),
});
const fieldPatch = z.object({
  sourceText: z.string().max(20000).optional(),
  /** Advisory char limit (UI counter only); `null` clears a previously-set value. */
  maxLength: z.number().int().positive().nullable().optional(),
  translations: z.record(z.string().min(1), translationPatch).optional(),
});
export const stageDetailsPatchSchema = z.object({
  name: fieldPatch.optional(),
  gameplayDetails: fieldPatch.optional(),
  stageDescription: fieldPatch.optional(),
});
type StageDetailsPatchBody = z.infer<typeof stageDetailsPatchSchema>;

export const translateBodySchema = z.object({
  languages: z.array(z.string().min(1)).min(1).max(64).optional(),
  fields: z
    .array(z.enum(['name', 'gameplayDetails', 'stageDescription']))
    .min(1)
    .optional(),
  staleOnly: z.boolean().optional(),
  moduleId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  reasoningEffort: z.string().min(1).optional(),
});
type TranslateBody = z.infer<typeof translateBodySchema>;

export const chatBodySchema = z.object({
  instanceId: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: z.string().min(1).optional(),
  focus: z
    .object({
      field: z.enum(['name', 'gameplayDetails', 'stageDescription']),
      lang: z.string().min(1).nullable().optional(),
    })
    .optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(20000),
      }),
    )
    .min(1)
    .max(50),
  // Optional session id for usage capture. OPTIONAL so pre-migration clients
  // never 400; usage is recorded only when present (the project scope is the
  // always-present `:projectId` path param). See `services/chat-usage.ts`.
  chatSessionId: z.string().uuid().optional(),
  // Per-turn opt-in for the verbose diagnostic logs (assistant settings
  // toggle). OPTIONAL and absent ⇒ off, so a client that never sends it gets
  // today's silent behaviour. MUST be declared here: `validateBody` parses in
  // strip mode, so an undeclared field never reaches the handler.
  verbose: z.boolean().optional(),
});
type ChatBody = z.infer<typeof chatBodySchema>;

/** Injectable streaming seam (mirrors `createColorTextRouter`'s `streamChat`). */
export type StageChatStreamFn = (params: StageChatParams) => AsyncIterable<string>;

const FIELD_IDS: readonly StageDetailFieldId[] = ['name', 'gameplayDetails', 'stageDescription'];

/**
 * Build the stage-details router, mounted with `mergeParams: true` at the
 * fixed prefix `/api/projects/:projectId/stage-details` (see `index.ts`).
 * Because `:projectId` is captured by the outer mount path this router is
 * attached at, rather than a route pattern this router owns, the usual
 * `router.param('projectId', ...)` hook used by sibling project-scoped routers
 * (e.g. `glossary.ts`) never fires here — `req.params.projectId` would arrive
 * unvalidated. This router-level `use()` re-applies the same `ensureProjectId`
 * path-traversal guard (the one `projectIdParam` wraps) once, for every route
 * this router exposes (`PATCH /`, `POST /translate`, and `POST /chat`).
 */
export function createStageDetailsRouter(
  engine: Pick<StageDetailsEngine, 'enqueue'> = stageDetailsEngine,
  streamChat: StageChatStreamFn = defaultStreamStageChat,
): Router {
  const router = Router({ mergeParams: true });

  router.use((req, _res, next) => {
    try {
      ensureProjectId(req.params.projectId as string);
      next();
    } catch (err) {
      next(err);
    }
  });

  router.patch(
    '/',
    validateBody(stageDetailsPatchSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const projectId = req.params.projectId as string;
      const body = req.body as StageDetailsPatchBody;

      // Authorization BEFORE any mutation (mirrors strings.ts's entry PATCH):
      // non-member → 404 (no existence leak); collaborator may write only
      // granted-language translations — sourceText/maxLength are owner-only
      // (see assertStageDetailsPatchAllowed). A denied request applies nothing.
      const access = await assertProjectAccess(projectId, { type: 'read' });
      assertStageDetailsPatchAllowed(access, body);

      // Throws ProjectNotFoundError (404, mapped centrally) for a missing or
      // inaccessible (RLS-invisible) project.
      const project = await getProjectStore().loadProject(projectId);
      const current: StageDetails = project.stageDetails ?? emptyStageDetails();
      const updated: StageDetails = { ...current };

      for (const fieldId of FIELD_IDS) {
        const patch = body[fieldId];
        if (!patch) continue;

        // Defensive: a stored stageDetails missing a field key (partial legacy
        // data) falls back to the empty field instead of spreading undefined.
        const base = current[fieldId] ?? emptyStageDetails()[fieldId];
        const field = {
          ...base,
          translations: { ...base.translations },
        };

        // Source-text edit bumps sourceUpdatedAt (drives derived staleness on
        // existing translations); an identical resubmission does NOT bump it.
        if (patch.sourceText !== undefined && patch.sourceText !== field.sourceText) {
          field.sourceText = patch.sourceText;
          field.sourceUpdatedAt = Date.now();
        }

        if (patch.maxLength !== undefined) {
          if (patch.maxLength === null) {
            delete field.maxLength;
          } else {
            field.maxLength = patch.maxLength;
          }
        }

        if (patch.translations) {
          for (const [lang, translation] of Object.entries(patch.translations)) {
            field.translations[lang] = {
              text: translation.text,
              moduleId: translation.moduleId,
              timestamp: Date.now(),
            };
          }
        }

        updated[fieldId] = field;
      }

      await getProjectStore().updateProject(projectId, { stageDetails: updated });
      res.status(200).json(updated);
    }),
  );

  router.post(
    '/translate',
    requireUnlockedVault,
    validateBody(translateBodySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const projectId = req.params.projectId as string;
      const body = req.body as TranslateBody;

      // Authorization BEFORE enqueue (mirrors the PATCH above): non-member →
      // 404 (no existence leak); a collaborator may only start a run scoped to
      // languages they can write — an omitted `languages` list (⇒ every active
      // language) requires manage, which collaborators never have. A denied
      // request creates no run.
      const access = await assertProjectAccess(projectId, { type: 'read' });
      assertStageDetailsTranslateAllowed(access, body);

      const sessionId = getSessionId(res);
      const request: StageDetailsRunRequest = body;
      const result = await engine.enqueue(projectId, request, sessionId);
      res.status(202).json(result);
    }),
  );

  router.post(
    '/chat',
    requireUnlockedVault,
    validateBody(chatBodySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const projectId = req.params.projectId as string;
      const body = req.body as ChatBody;

      // READ access only: chat writes nothing — applying a proposal goes through
      // the already-gated PATCH. Non-member → 404 (no existence leak).
      await assertProjectAccess(projectId, { type: 'read' });

      // Throws ProjectNotFoundError (404, mapped centrally) for a missing or
      // RLS-invisible project; the service stays pure (no store access).
      const project = await getProjectStore().loadProject(projectId);
      const details: StageDetails = project.stageDetails ?? emptyStageDetails();

      const sessionId = getSessionId(res);

      // Abort the provider call if the client disconnects mid-stream.
      //
      // Deliberately `res.on('close')`, NOT `req.on('close')` (see the
      // identical fix + rationale in `routes/color-text.ts`): Node's
      // `http.IncomingMessage` emits 'close' once the REQUEST body has been
      // fully read, which can happen well before the response begins — a
      // listener there risks aborting the provider call before it is ever
      // dispatched. This route happened to dodge that by registering the
      // listener after two `await`s (`assertProjectAccess`,
      // `loadProject`), which usually delayed attachment past the early
      // event — but that was timing luck, not a guarantee. `res.on('close')`
      // fires only when the RESPONSE's underlying connection actually ends,
      // which is the signal this abort is meant to react to.
      const controller = new AbortController();
      res.on('close', () => controller.abort());

      // Run tracking is scoped to this project (the `:projectId` path param) and
      // the client's session id; without a session id there is nothing to key
      // the run by, so the turn is logged but not recorded in Activity.
      const meta: ChatTurnMeta = {
        chatKind: 'stage-details',
        instanceId: body.instanceId,
        model: body.model,
        reasoningEffort: body.reasoningEffort,
        signal: controller.signal,
        verbose: body.verbose === true,
        ...(body.chatSessionId ? { run: { chatSessionId: body.chatSessionId, projectId } } : {}),
      };
      // `onUsage` fires inside the stream, before the wrapper's settle path runs
      // in its `finally` — so the tokens are available when the run is settled.
      const usageRef: ChatUsageRef = {};

      // Opened here rather than from `onDispatch` so the run is recorded even if
      // the injected stream never invokes that callback.
      openChatRun(meta);

      const stream = streamChat({
        sessionId: sessionId ?? '',
        instanceId: body.instanceId,
        model: body.model,
        reasoningEffort: body.reasoningEffort,
        messages: body.messages,
        details,
        focus: body.focus,
        signal: controller.signal,
        onDispatch: (info) => logChatDispatch(meta, info),
        onUsage: (usage) => {
          usageRef.current = {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
          };
        },
      });
      await streamPlainTextResponse(
        req,
        res,
        instrumentChatTurn(stream, meta, usageRef),
        'stage-details chat',
      );
    }),
  );

  return router;
}

/** Production router instance (mounting is index.ts). */
export const stageDetailsRouter: Router = createStageDetailsRouter();
