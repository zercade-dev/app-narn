/**
 * Wire contract for a chat reply that fails after streaming has started.
 *
 * A `text/plain` chat stream commits its HTTP status with the first byte, so a
 * provider failure part-way through a reply can no longer be mapped to a 4xx or
 * 5xx. The server appends this trailer to the stream instead (see the server's
 * `http/stream-chat-response.ts`), and the client splits it off — which is what
 * lets a cut-short reply be told apart from a complete one.
 *
 * The marker is U+001E RECORD SEPARATOR, the framing character of RFC 7464's
 * JSON text sequences: a reply carries prose and style tags, never a C0 control
 * character other than tab/newline, so the split needs neither a length prefix
 * nor escaping. What follows it is the same `{ "error": code }` body the
 * before-first-byte path would have sent as the whole response.
 */
export const CHAT_STREAM_ERROR_MARKER = '\u001e';

/** Code reported when the trailer is present but its JSON never arrived in full. */
export const CHAT_STREAM_ERROR_FALLBACK = 'stream-failed';

/**
 * Split a streamed chat reply into the text to render and the error code the
 * server appended, `null` for a reply that ended normally. Safe to call on a
 * stream still arriving: a half-received trailer reads as the fallback code
 * until its JSON is complete, and the next chunk corrects it.
 */
export function splitChatStreamError(streamed: string): { text: string; error: string | null } {
  const at = streamed.indexOf(CHAT_STREAM_ERROR_MARKER);
  if (at === -1) return { text: streamed, error: null };
  const text = streamed.slice(0, at);
  const trailer = streamed.slice(at + CHAT_STREAM_ERROR_MARKER.length);
  try {
    const code = (JSON.parse(trailer) as { error?: string }).error;
    return {
      text,
      error: typeof code === 'string' && code !== '' ? code : CHAT_STREAM_ERROR_FALLBACK,
    };
  } catch {
    return { text, error: CHAT_STREAM_ERROR_FALLBACK };
  }
}
