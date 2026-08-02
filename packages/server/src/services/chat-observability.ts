/**
 * Per-turn observability for the two AI-chat surfaces (the Text Styler and the
 * stage-details assistant).
 *
 * Everything here logs through `logger.browser` — the SSE/history channel only,
 * never the console mirror — because these entries carry the user's prompt and
 * conversation. The `/api/logs` read surfaces filter that stream by the
 * `tenantId` M15 stamps at log time, so an entry reaches only the tenant whose
 * request produced it; container stdout has no equivalent scoping. Genuine
 * failures still reach operators: the routes' and `streamPlainTextResponse`'s
 * existing `logger.error` calls are untouched.
 *
 * {@link instrumentChatTurn} wraps the chat service's delta stream rather than
 * living in the route, so it observes the first token, normal completion, a
 * provider error and a client abort on EVERY path. That is also what lets the
 * Activity run row settle instead of being stranded as `Running`:
 * `streamPlainTextResponse` swallows errors (it has to — headers may already be
 * committed), so a route-level try/catch would never see them.
 */
import type { ChatKindLabel } from '@zercade-dev/narn-shared';
import { logger } from '../modules/M15-console-logger.js';
import { startChatTurn, finishChatTurn, type ChatTurnOutcome } from './chat-usage.js';

export interface ChatTurnMeta {
  chatKind: ChatKindLabel;
  instanceId: string;
  model: string;
  reasoningEffort?: string;
  /** The route's abort controller signal — distinguishes a cancel from a failure. */
  signal: AbortSignal;
  /**
   * Per-turn opt-in for the diagnostic logs, set from the assistant's "verbose
   * logs" toggle. OFF by default: the entries carry the user's prompt verbatim
   * and are noisy, so they are something you switch on to investigate a slow or
   * odd turn, not a standing cost. Activity run tracking is NOT gated by this —
   * usage must be recorded whether or not anyone is watching the logs.
   */
  verbose?: boolean;
  /**
   * Absent when the client sent no session id (or, for the Text Styler, no
   * project): the diagnostic logs still emit, but no Activity run row is
   * written — there is nothing to key it by.
   */
  run?: { chatSessionId: string; projectId: string };
}

export interface ChatDispatchInfo {
  system: string;
  messages: { role: string; content: string }[];
}

/** Token usage for the turn, filled in by the stream's `onUsage` before settle. */
export interface ChatUsageRef {
  current?: { inputTokens: number; outputTokens: number };
}

/**
 * Open the Activity run for a turn that is about to be dispatched, so it is
 * visible while it streams rather than appearing only once it finishes.
 *
 * Deliberately called by the ROUTE rather than from {@link logChatDispatch}'s
 * `onDispatch` callback: run tracking must not be contingent on a streaming
 * service remembering to invoke a callback. A service that omits `onDispatch`
 * loses its prompt diagnostics — an inconvenience — but must never silently stop
 * recording usage. No-ops when the turn has no run scope.
 *
 * Fire-and-forget: never awaited, so it cannot delay the first streamed byte.
 */
export function openChatRun(meta: ChatTurnMeta): void {
  if (!meta.run) return;
  startChatTurn({
    chatSessionId: meta.run.chatSessionId,
    projectId: meta.run.projectId,
    kindLabel: meta.chatKind,
    instanceId: meta.instanceId,
    model: meta.model,
  }).catch((err: unknown) => {
    logger.error('chat run start failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Emit the dispatch-time diagnostics: prompt/history sizes and the model
 * settings, then the verbatim prompt.
 *
 * Two entries rather than one so `chat:dispatch` stays readable in the log
 * stream while the bulky prompt sits in a separate `debug` entry that can be
 * filtered out. Logging only — the run is opened by {@link openChatRun}.
 *
 * No-op unless the turn opted in via `meta.verbose`.
 */
export function logChatDispatch(meta: ChatTurnMeta, info: ChatDispatchInfo): void {
  if (!meta.verbose) return;
  const historyChars = info.messages.reduce((n, m) => n + m.content.length, 0);

  logger.browser('info', 'chat:dispatch', {
    chatKind: meta.chatKind,
    instanceId: meta.instanceId,
    model: meta.model,
    reasoningEffort: meta.reasoningEffort ?? 'default',
    systemPromptChars: info.system.length,
    messageCount: info.messages.length,
    historyChars,
  });

  logger.browser('debug', 'chat:prompt', {
    chatKind: meta.chatKind,
    system: info.system,
    messages: info.messages,
  });
}

/**
 * Pass the source deltas through untouched while timing the turn, then emit
 * `chat:done` and settle the Activity run on every exit path.
 *
 * `ttftMs` (time to first token) is the number that makes a slow turn
 * explainable: when it dominates `totalMs` the cost is prompt/model-side, and
 * when it is small against a large `totalMs` the cost is output length or
 * transport. A source error is rethrown after logging so
 * `streamPlainTextResponse` still classifies it into a status code.
 */
export async function* instrumentChatTurn(
  source: AsyncIterable<string>,
  meta: ChatTurnMeta,
  usageRef: ChatUsageRef,
): AsyncIterable<string> {
  const startedAt = Date.now();
  let ttftMs: number | undefined;
  let deltas = 0;
  let outChars = 0;
  let outcome: ChatTurnOutcome = 'completed';
  let errorMessage: string | undefined;

  try {
    for await (const delta of source) {
      ttftMs ??= Date.now() - startedAt;
      deltas++;
      outChars += delta.length;
      yield delta;
    }
    // A stream that ends because the client vanished is a cancel, not a success.
    if (meta.signal.aborted) outcome = 'cancelled';
  } catch (err) {
    // An abort surfaces as a thrown AbortError; classify it as a cancel so a
    // user closing the tab is not recorded as a provider failure.
    outcome = meta.signal.aborted ? 'cancelled' : 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const usage = usageRef.current ?? { inputTokens: 0, outputTokens: 0 };

    // Diagnostics are opt-in; the run settle below is NOT — a turn's usage is
    // recorded whether or not verbose logging was switched on.
    if (meta.verbose) {
      logger.browser(outcome === 'failed' ? 'warn' : 'info', 'chat:done', {
        chatKind: meta.chatKind,
        model: meta.model,
        outcome,
        ttftMs: ttftMs ?? null,
        totalMs: Date.now() - startedAt,
        deltas,
        outChars,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        ...(errorMessage ? { error: errorMessage } : {}),
      });
    }

    if (meta.run) {
      finishChatTurn({
        chatSessionId: meta.run.chatSessionId,
        projectId: meta.run.projectId,
        kindLabel: meta.chatKind,
        instanceId: meta.instanceId,
        model: meta.model,
        usage,
        outcome,
        ...(errorMessage ? { errorMessage } : {}),
      }).catch((err: unknown) => {
        logger.error('chat run settle failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }
}
