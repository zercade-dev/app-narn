import type { Response } from 'express';

/**
 * Shared response shapes for the AI background-run endpoints (glossary generate,
 * category suggest, judge, source-review). These pairs of routes all follow the
 * same two patterns:
 *
 *  - the POST enqueues a run and replies 202 with the engine's
 *    `{ runId, total?, status }` result;
 *  - the GET reads the run's persisted suggestions sidecar and replies
 *    `{ suggestions }`.
 *
 * The engines' typed *NotPossibleError throws carry a `statusCode` and are
 * mapped centrally by the error handler, so `enqueueRun` deliberately does NOT
 * catch — it lets the rejection propagate through asyncHandler to that handler.
 */

/**
 * Enqueue a background run and respond 202 with the engine result. Any
 * *NotPossibleError thrown by `enqueue` propagates to the central error handler
 * (which maps it to 404/409 from its `statusCode`).
 */
export async function enqueueRun<T>(res: Response, enqueue: () => Promise<T>): Promise<void> {
  const result = await enqueue();
  res.status(202).json(result);
}

/**
 * Read a run's persisted suggestions sidecar and respond `{ suggestions }`.
 * `fetch` returns the suggestions array (empty for a still-running/failed run or
 * one that recorded nothing).
 */
export async function respondSuggestions<T>(
  res: Response,
  fetch: () => Promise<T[]>,
): Promise<void> {
  const suggestions = await fetch();
  res.json({ suggestions });
}
