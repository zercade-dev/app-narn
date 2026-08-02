/**
 * Text Styler assistant HTTP surface.
 *
 * `POST /api/color-text/chat` streams an AI chat completion as `text/plain`
 * chunks. It is vault-gated (per-session BYOK credentials) and validates the
 * request body with zod. Provider/credential resolution and the streaming
 * transport live in the service (`streamChat`); this router only wires
 * the HTTP concerns: the vault gate, body validation, chunked streaming, client
 * disconnect → provider abort, and error classification.
 *
 * The streaming transport + before-first-byte error classification live in the
 * shared `http/stream-chat-response.ts` helper (`streamPlainTextResponse` /
 * `classifyChatError`), reused by every chat surface; this router only builds
 * the provider stream and wires the client-disconnect → abort.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { getSessionId } from '../middleware/session.js';
import { validateBody } from '../middleware/validate.js';
import { assertProjectAccess } from '../middleware/authz.js';
import { asyncHandler } from '../http/index.js';
import { streamPlainTextResponse } from '../http/stream-chat-response.js';
import { streamChat as defaultStreamChat, type ChatTurn } from '../services/color-text-chat.js';
import {
  openChatRun,
  logChatDispatch,
  instrumentChatTurn,
  type ChatTurnMeta,
  type ChatUsageRef,
} from '../services/chat-observability.js';

/** Injectable streaming seam (mirrors the chat service's own DI seam). */
export type StreamChatFn = (params: {
  sessionId: string;
  instanceId: string;
  model: string;
  reasoningEffort?: string;
  messages: ChatTurn[];
  draft: string;
  signal: AbortSignal;
  onUsage?: (usage: { inputTokens?: number; outputTokens?: number }) => void;
  onDispatch?: (info: { system: string; messages: ChatTurn[] }) => void;
}) => AsyncIterable<string>;

const chatBodySchema = z.object({
  instanceId: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: z.string().min(1).optional(),
  draft: z.string().max(20000),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(20000),
      }),
    )
    .min(1)
    .max(50),
  // Optional session/project scope for usage capture. Both stay OPTIONAL so
  // pre-migration clients / mid-deploy tabs never 400; usage is only
  // recorded when BOTH are present.
  chatSessionId: z.string().uuid().optional(),
  projectId: z.string().min(1).optional(),
  // Per-turn opt-in for the verbose diagnostic logs (assistant settings
  // toggle). OPTIONAL and absent ⇒ off, so a client that never sends it gets
  // today's silent behaviour. MUST be declared here: `validateBody` parses in
  // strip mode, so an undeclared field never reaches the handler.
  verbose: z.boolean().optional(),
});
type ChatBody = z.infer<typeof chatBodySchema>;

/**
 * Build the Text Styler router. `streamChat` defaults to the production service
 * entry but is injectable so route tests can stub the provider stream.
 */
export function createColorTextRouter(streamChat: StreamChatFn = defaultStreamChat): Router {
  const router = Router();

  router.post(
    '/chat',
    requireUnlockedVault,
    validateBody(chatBodySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as ChatBody;

      // Authorization BEFORE anything is written or streamed. Unlike the
      // stage-details twin (`/api/projects/:projectId/stage-details/chat`, whose
      // id is a PATH param), this router is NOT mounted under a project, so
      // `projectId` arrives in the BODY and is entirely caller-controlled. It
      // flows into `startChatTurn`/`finishChatTurn` → `runStore.getRun/updateRun`, which would
      // otherwise let anyone who knows a project id write a `kind: 'chat'` run
      // row into it, with only RLS standing in the way. READ access is the right
      // level (same as the stage-details chat route): the styler is available to
      // collaborators and the run row it creates is their OWN usage/cost record,
      // attributed to them — it is not a project-content mutation. Non-member →
      // 404 (no existence leak).
      //
      // `projectId` is OPTIONAL (pre-migration clients / mid-deploy tabs omit
      // it), and when absent nothing is recorded and no project is touched, so
      // there is nothing to authorize — the turn streams unscoped exactly as
      // before rather than 400-ing a client that never asked for a project.
      if (body.projectId) {
        await assertProjectAccess(body.projectId, { type: 'read' });
      }

      const sessionId = getSessionId(res);

      // Abort the provider call if the client disconnects mid-stream.
      //
      // Deliberately `res.on('close')`, NOT `req.on('close')`: Node's
      // `http.IncomingMessage` emits 'close' once the REQUEST body has been
      // fully read — for a small JSON POST that happens almost immediately
      // (observed ~1ms after the handler starts), long before the response
      // even begins. Listening on `req` here aborted the provider call before
      // it was ever dispatched, so every Text Styler chat turn silently
      // completed as an empty 200 with no error and nothing logged — the
      // "does nothing" bug. `res.on('close')` fires only when the RESPONSE's
      // underlying connection actually ends (a real client disconnect, or —
      // harmlessly, since the stream is already drained by then — normal
      // completion), which is the signal this abort is meant to react to.
      const controller = new AbortController();
      res.on('close', () => controller.abort());

      // Run tracking needs BOTH a session id and a project scope; without them
      // there is nothing to key the run by, so the turn is logged but not
      // recorded in Activity. The run writes are created synchronously inside
      // the request, so they inherit the ambient tenant even after the response
      // ends.
      const meta: ChatTurnMeta = {
        chatKind: 'text-styler',
        instanceId: body.instanceId,
        model: body.model,
        reasoningEffort: body.reasoningEffort,
        signal: controller.signal,
        verbose: body.verbose === true,
        ...(body.chatSessionId && body.projectId
          ? { run: { chatSessionId: body.chatSessionId, projectId: body.projectId } }
          : {}),
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
        draft: body.draft,
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
        'color-text chat',
      );
    }),
  );

  return router;
}

/** Production router instance. */
export const colorTextRouter = createColorTextRouter();
