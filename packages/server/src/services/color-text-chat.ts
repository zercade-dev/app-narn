/**
 * Streaming AI-chat service for the Text Styler assistant.
 *
 * Reuses the shared provider factory (via M6's `resolveChatTarget` +
 * the shared `streamChatText` helper) so a chat call runs under the
 * same BYOK credential path and SSRF-guarded fetch as every translation
 * module. This file wires the system prompt and the draft into the
 * conversation; the streaming transport lives in shared (`streamChatText`)
 * and provider/credential resolution lives in M6. The Express route that
 * exposes this (`routes/color-text.ts`) streams plain-text chunks, not SSE.
 */
import { streamChatText, type ChatTurn, type ProviderType } from '@zercade-dev/narn-shared';
import { moduleRegistry } from '../modules/M6-module-registry.js';

export type { ChatTurn };

/**
 * Instructs the model about the four markup tags the Text Styler supports and
 * the fenced-block convention for a full rewrite. Named tags (`<size=`, etc.)
 * are asserted by the service test.
 *
 * A rewrite is requested as a `styled`-tagged fence holding a single JSON
 * object — `{"text": …, "why": …}` — so the suggestion arrives with the one
 * sentence of reasoning the UI renders beside it. The frontend parser
 * (`packages/frontend/src/lib/styled-proposals.ts`) still accepts a bare
 * \`\`\` fence as a legacy suggestion, so a model that ignores the tag degrades
 * to a working (reason-less) Apply rather than to nothing.
 */
const SYSTEM_PROMPT = `You help improve short game-UI strings that use these markup tags:
<color=#RRGGBB>…</color> (hex text color), <b>…</b> (bold), <i>…</i> (italic), and <size=N>…</size> (pixel font size N).
Rules:
- Only ever use those four tags, and keep them well-formed (every open tag closed, correct nesting).
- When you propose a full rewritten version of the user's text, emit it as a fenced block tagged \`styled\` holding a single JSON object:
\`\`\`styled
{"text": "the full rewritten string, with tags", "why": "one short sentence on why this is better"}
\`\`\`
Emit one such block per distinct proposal. Keep all commentary and explanation outside the fence.`;

export interface ResolvedChatTarget {
  provider: ProviderType;
  apiKey: string;
  baseURL?: string;
}

export interface StreamChatDeps {
  /** Resolve the instance id + session to an AI-SDK provider, apiKey, baseURL. */
  resolveTarget: (
    instanceId: string,
    sessionId: string | undefined,
  ) => ResolvedChatTarget | Promise<ResolvedChatTarget>;
  /** The shared streaming helper (injectable so tests avoid a network call). */
  stream: typeof streamChatText;
}

export interface StreamChatParams {
  sessionId: string;
  /** Module or instance id selected for the chat (e.g. `anthropic:default`). */
  instanceId: string;
  model: string;
  reasoningEffort?: string;
  /** The user/assistant conversation so far (system prompt is added here). */
  messages: ChatTurn[];
  /** The current styled text the user is editing, threaded into the prompt. */
  draft: string;
  signal: AbortSignal;
  /**
   * Invoked once after the turn finishes streaming with its final token usage
   * (see {@link streamChatText}). The route wires this to fire-and-forget usage
   * recording; the service just forwards it to the shared streaming helper.
   */
  onUsage?: (usage: { inputTokens?: number; outputTokens?: number }) => void;
  /**
   * Invoked once, synchronously, with the system prompt and the outgoing turns
   * — immediately BEFORE the provider call is dispatched. Mirrors
   * {@link StreamChatParams.onUsage}'s best-effort contract: the route uses it
   * for observability only, and it must never throw. Note the messages include
   * the synthesized draft turn, so the reported size is what actually goes over
   * the wire.
   */
  onDispatch?: (info: { system: string; messages: ChatTurn[] }) => void;
}

/**
 * Injectable core: resolves the provider/credential target, threads the draft
 * into the opening user turn, and streams text deltas from the model. Yields
 * each delta as it arrives.
 */
export async function* streamChatWith(
  params: StreamChatParams,
  deps: StreamChatDeps,
): AsyncIterable<string> {
  const { provider, apiKey, baseURL } = await deps.resolveTarget(
    params.instanceId,
    params.sessionId,
  );
  // The draft is threaded in as context ahead of the real conversation. A
  // fresh conversation's first turn is always the user's (there is no
  // assistant turn until one has streamed back), so naively PREPENDING the
  // draft as its own separate `user` turn always produces two adjacent
  // `user` turns at the head of the array — for every call, not just the
  // first message (the draft is re-threaded fresh each time). Cloud
  // providers tolerate that; strict chat-template backends (llama.cpp's
  // Jinja templates, notably) reject it outright with a 500. Merge the
  // draft into that first turn instead of appending a separate one.
  const draftContext = `Current draft:\n${params.draft}`;
  const [firstTurn, ...restTurns] = params.messages;
  const messages: ChatTurn[] =
    firstTurn?.role === 'user'
      ? [{ role: 'user', content: `${draftContext}\n\n${firstTurn.content}` }, ...restTurns]
      : [{ role: 'user', content: draftContext }, ...params.messages];
  params.onDispatch?.({ system: SYSTEM_PROMPT, messages });
  yield* deps.stream({
    provider,
    apiKey,
    model: params.model,
    baseURL,
    reasoningEffort: params.reasoningEffort,
    system: SYSTEM_PROMPT,
    messages,
    signal: params.signal,
    onUsage: params.onUsage,
  });
}

/**
 * Production entry: wires the real M6 provider/credential resolution and the
 * shared streaming helper.
 */
export function streamChat(params: StreamChatParams): AsyncIterable<string> {
  return streamChatWith(params, {
    resolveTarget: (id, sid) => moduleRegistry.resolveChatTarget(id, sid),
    stream: streamChatText,
  });
}
