import type { Response } from 'express';

/**
 * Default flush size. Large enough that a normal project costs a handful of
 * socket writes rather than one per entry, small enough that the peak string
 * held is bounded by a constant instead of by the project's size.
 */
const DEFAULT_CHUNK_BYTES = 64 * 1024;

/**
 * Serialise an async sequence as a JSON array body, flushing as it goes.
 *
 * `res.json(array)` stringifies the whole array synchronously: for a
 * 10k-entry x 15-language project that is a single multi-MB string built while
 * the event loop is blocked, on top of the array it was built from, and it is
 * followed by an ETag hash over the same bytes. Writing incrementally keeps the
 * peak at one chunk and lets the loop breathe between them.
 *
 * Two consequences the caller inherits:
 *
 * - **No ETag, so no 304 on a repeat fetch.** Express derives the ETag from the
 *   fully-buffered body, which is the cost being removed. It only ever saved
 *   bandwidth, never server work — a 304 still built and hashed the whole body —
 *   so nothing about the failure mode this addresses gets worse.
 * - **A failure after the first flush can no longer set a status.** Everything
 *   the caller can fail at (access checks, the query itself) happens before the
 *   first byte, and `errorHandler` already delegates a post-headers error to
 *   Express's finalizer. Do NOT use this for a body whose production can fail
 *   partway on ordinary input.
 *
 * Writes honour backpressure and stop early if the client goes away, so a
 * stalled reader can't make the server buffer the rest of the project.
 */
export async function sendJsonArray<T>(
  res: Response,
  items: AsyncIterable<T>,
  opts: { chunkBytes?: number } = {},
): Promise<void> {
  const chunkBytes = opts.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  res.type('application/json');
  let pending = '[';
  let separator = '';
  for await (const item of items) {
    if (isGone(res)) return;
    // `?? 'null'` matches JSON.stringify's own treatment of an unserialisable
    // array element, so the body stays valid JSON whatever the source yields.
    pending += separator + (JSON.stringify(item) ?? 'null');
    separator = ',';
    if (pending.length >= chunkBytes) {
      await flush(res, pending);
      pending = '';
    }
  }
  if (isGone(res)) return;
  await flush(res, pending + ']');
  res.end();
}

/** The socket is closed or the response already finished — stop producing. */
function isGone(res: Response): boolean {
  return res.writableEnded || res.destroyed;
}

/**
 * Write one chunk, waiting for 'drain' when the socket buffer is full. Node
 * returns EXACTLY false when it wants a pause, so the `=== false` check leaves
 * test doubles that return anything else on the fast path. 'close' resolves the
 * wait too: a client that disconnects mid-body never emits 'drain', and a
 * listener waiting only for that would leak this request forever.
 */
function flush(res: Response, chunk: string): Promise<void> {
  if (res.write(chunk) !== false) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const settle = (): void => {
      res.off('drain', settle);
      res.off('close', settle);
      resolve();
    };
    res.once('drain', settle);
    res.once('close', settle);
  });
}
