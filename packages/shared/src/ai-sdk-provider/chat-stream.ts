import { streamText } from 'ai';
import type { LanguageModel } from 'ai';
import { createModelForProvider } from './model-factory.js';
import { DEFAULT_MAX_OUTPUT_TOKENS } from './core.js';
import { buildProviderOptions } from './provider-options.js';
import type { ProviderOptions } from './core.js';
import type { ProviderType } from './types.js';

/** One turn of a raw chat conversation (user or assistant). */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Injectable seam for {@link streamChatText}. Both default to the production
 * implementations; tests pass fakes so no network call (and no real provider
 * model) is made.
 */
export interface StreamChatTextDeps {
  createModel?: typeof createModelForProvider;
  streamText?: typeof streamText;
}

/**
 * Stream an LLM chat completion as text deltas. Builds the provider model via
 * {@link createModelForProvider} (so it inherits the SSRF-guarded fetch and the
 * BYOK apiKey path every module uses) and yields the AI SDK `textStream` chunks
 * in order.
 *
 * The output-token cap is only applied when positive: {@link DEFAULT_MAX_OUTPUT_TOKENS}
 * is `0` (meaning "let the provider apply its own maximum"), and passing `0` to
 * the SDK would truncate the reply to nothing — so a non-positive cap is omitted.
 */
export async function* streamChatText(
  params: {
    provider: ProviderType;
    apiKey: string;
    model: string;
    baseURL?: string;
    reasoningEffort?: string;
    system: string;
    messages: ChatTurn[];
    signal: AbortSignal;
    maxOutputTokens?: number;
    /**
     * Invoked once, AFTER the stream completes successfully, with the turn's
     * final aggregated token usage. Best-effort telemetry: it fires only when
     * the turn finishes (a mid-stream abort/error skips it), and any failure to
     * resolve usage is swallowed so it never interrupts or delays the stream.
     */
    onUsage?: (usage: { inputTokens?: number; outputTokens?: number }) => void;
  },
  deps: StreamChatTextDeps = {},
): AsyncIterable<string> {
  const buildModel = deps.createModel ?? createModelForProvider;
  const doStream = deps.streamText ?? streamText;

  const model: LanguageModel = buildModel(params.provider, {
    apiKey: params.apiKey,
    modelId: params.model,
    baseURL: params.baseURL,
  });

  const cap = params.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const providerOptions = buildProviderOptions(params.provider, {
    reasoningEffort: params.reasoningEffort,
    modelId: params.model,
  });
  // The AI SDK's `streamText` deliberately does NOT throw when the provider
  // call fails (auth error, rate limit, bad model id, network error, ...) —
  // per its own docs (docs/09-troubleshooting/15-stream-text-not-working.mdx):
  // "Errors become part of the stream and are not thrown to prevent e.g.
  // servers from crashing." Without an `onError` callback, a failed turn
  // silently ends `textStream` with ZERO deltas: the `for await` below
  // completes normally, the HTTP layer sees an ordinary 200 response, and the
  // caller gets an empty assistant reply with no error and nothing logged —
  // indistinguishable from the send button doing nothing. Capture the error
  // here and rethrow it after the loop so `streamPlainTextResponse` can
  // classify it (401/429/500) exactly as it does for a synchronously-thrown
  // error, instead of swallowing it.
  let streamError: unknown;
  const result = doStream({
    model,
    system: params.system,
    messages: params.messages,
    abortSignal: params.signal,
    ...(cap > 0 ? { maxOutputTokens: cap } : {}),
    ...(providerOptions ? { providerOptions: providerOptions as ProviderOptions } : {}),
    onError: ({ error }: { error: unknown }) => {
      streamError = error;
    },
  });

  for await (const delta of result.textStream) yield delta;

  if (streamError !== undefined) {
    throw streamError;
  }

  // Surface the completed turn's usage once the deltas are drained. Cast the
  // awaited value to a nullable shape so a test double whose result omits
  // `totalUsage` (resolving `undefined`) is handled without a crash, and so the
  // best-effort guard below is a real runtime check rather than a no-op.
  if (params.onUsage) {
    try {
      const usage = (await result.totalUsage) as unknown as
        { inputTokens?: number; outputTokens?: number } | undefined;
      if (usage) {
        params.onUsage({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
      }
    } catch {
      // Usage resolution is best-effort telemetry; never let it break the turn.
    }
  }
}
