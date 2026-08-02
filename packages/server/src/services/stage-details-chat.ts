/**
 * Streaming AI-chat service for the stage-details assistant.
 *
 * Mirrors `services/color-text-chat.ts`: reuses M6's `resolveChatTarget` + the
 * shared `streamChatText` helper so a chat call runs under the same BYOK
 * credential path and SSRF-guarded fetch as every translation module. This file
 * wires the stage-details context into a deterministic system prompt (no
 * timestamps, so the route test can snapshot substrings); the streaming
 * transport lives in shared and provider/credential resolution in M6. The
 * Express route that exposes this over `text/plain` is `routes/stage-details.ts`.
 *
 * Unlike the Text Styler (which threads the draft in as an opening user turn),
 * the stage-details context is large and structured, so it goes into the SYSTEM
 * prompt and the user's turns pass through unchanged.
 */
import {
  streamChatText,
  emptyStageDetails,
  STAGE_DETAIL_FIELD_IDS,
  type ChatTurn,
  type ProviderType,
  type StageDetails,
  type StageDetailFieldId,
} from '@zercade-dev/narn-shared';
import { moduleRegistry } from '../modules/M6-module-registry.js';

export type { ChatTurn };

/**
 * The fixed instructions + the `proposal` fenced-block contract the frontend
 * parses to offer apply-to-field actions. The contract lines (the fence tag and
 * the JSON shape) are load-bearing and MUST stay verbatim; the surrounding copy
 * may be reworded later.
 */
const SYSTEM_PROMPT_HEADER = `You help write and translate a game stage's store texts: its Name, a short "Gameplay details" summary, and a long "Stage description".
Rules:
- When you propose replacement text for a field, emit it as a fenced block tagged proposal containing ONLY a JSON object:
\`\`\`proposal
{"field":"gameplayDetails","lang":"fr","text":"...","why":"..."}
\`\`\`
- "field" is one of name | gameplayDetails | stageDescription. "lang" is the BCP-47 target language code, or null when proposing new SOURCE text. Every proposal block's JSON MUST include a "why" field: one short sentence stating why the new text is better than the current one.
- One proposal per fenced block. Do not repeat the "why" reasoning outside the fence. Keep any other commentary outside the fences to a minimum. Respect any stated character limits.
- When the user asks you to change, improve, shorten, proofread or rewrite a field, answer with exactly one proposal block for the field and language they are working on. Do not offer multiple alternatives, numbered options, or variants unless the user explicitly asks for options.
- Never reply with meta-commentary, safety labels, classifications, or a restatement of the request.
- If a request is unclear, ask one short question instead of guessing — but never answer an edit request with anything other than a proposal block.`;

/** Human-readable role line appended per field so the model knows each slot. */
const FIELD_ROLE: Record<StageDetailFieldId, string> = {
  name: 'Name — the stage title shown in the store (keep it short).',
  gameplayDetails: 'Gameplay details — a short one-or-two-sentence summary of the gameplay.',
  stageDescription: 'Stage description — the long-form marketing description of the stage.',
};

/**
 * Build the system prompt: the fixed header + the `proposal` contract, then for
 * each field its role line, current source text, and (when set) its maxLength
 * sentence. When `focus.lang` is set, each field also lists that language's
 * current translation (or `(untranslated)`) so the model can revise in place.
 * Deterministic — contains no timestamps or other volatile data.
 */
export function buildStageDetailsSystemPrompt(
  details: StageDetails,
  focus?: { field: StageDetailFieldId; lang?: string | null },
): string {
  const empty = emptyStageDetails();
  const lines: string[] = [SYSTEM_PROMPT_HEADER, '', 'Current stage details:'];

  for (const fieldId of STAGE_DETAIL_FIELD_IDS) {
    const field = details[fieldId] ?? empty[fieldId];
    lines.push('');
    lines.push(`${fieldId}: ${FIELD_ROLE[fieldId]}`);
    lines.push(`  Current source text: ${field.sourceText || '(empty)'}`);
    if (field.maxLength !== undefined) {
      lines.push(`  This field has a maximum length of ${field.maxLength} characters.`);
    }
    if (focus?.lang) {
      const translation = field.translations[focus.lang];
      lines.push(
        `  Current ${focus.lang} translation: ${translation ? translation.text : '(untranslated)'}`,
      );
    }
  }

  if (focus) {
    const target = focus.lang
      ? `the ${focus.lang} translation of the "${focus.field}" field`
      : `the source text of the "${focus.field}" field`;
    lines.push('', `The user is currently working on ${target}.`);
  }

  return lines.join('\n');
}

export interface ResolvedChatTarget {
  provider: ProviderType;
  apiKey: string;
  baseURL?: string;
}

export interface StageChatDeps {
  /** Resolve the instance id + session to an AI-SDK provider, apiKey, baseURL. */
  resolveTarget: (
    instanceId: string,
    sessionId: string | undefined,
  ) => ResolvedChatTarget | Promise<ResolvedChatTarget>;
  /** The shared streaming helper (injectable so tests avoid a network call). */
  stream: typeof streamChatText;
}

export interface StageChatParams {
  sessionId: string;
  /** Module or instance id selected for the chat (e.g. `anthropic:default`). */
  instanceId: string;
  model: string;
  reasoningEffort?: string;
  /** The user/assistant conversation so far (system prompt is added here). */
  messages: ChatTurn[];
  /** The project's current stage details, threaded into the system prompt. */
  details: StageDetails;
  /** Which field/language the user is editing, to prime the model's suggestions. */
  focus?: { field: StageDetailFieldId; lang?: string | null };
  signal: AbortSignal;
  /**
   * Invoked once after the turn finishes streaming with its final token usage
   * (see {@link streamChatText}). The route wires this to fire-and-forget usage
   * recording; the service just forwards it to the shared streaming helper.
   */
  onUsage?: (usage: { inputTokens?: number; outputTokens?: number }) => void;
  /**
   * Invoked once, synchronously, with the built system prompt and the outgoing
   * turns — immediately BEFORE the provider call is dispatched. Mirrors
   * {@link StageChatParams.onUsage}'s best-effort contract: the route uses it
   * for observability only, and it must never throw.
   */
  onDispatch?: (info: { system: string; messages: ChatTurn[] }) => void;
}

/**
 * Injectable core: resolves the provider/credential target, builds the
 * stage-details system prompt, and streams text deltas from the model. The
 * user's message turns pass through unchanged (context lives in the system
 * prompt). Yields each delta as it arrives.
 */
export async function* streamStageChatWith(
  params: StageChatParams,
  deps: StageChatDeps,
): AsyncIterable<string> {
  const { provider, apiKey, baseURL } = await deps.resolveTarget(
    params.instanceId,
    params.sessionId,
  );
  // Built once and shared with `onDispatch`, so the size the observability layer
  // reports is exactly the prompt that goes over the wire.
  const system = buildStageDetailsSystemPrompt(params.details, params.focus);
  params.onDispatch?.({ system, messages: params.messages });
  yield* deps.stream({
    provider,
    apiKey,
    model: params.model,
    baseURL,
    reasoningEffort: params.reasoningEffort,
    system,
    messages: params.messages,
    signal: params.signal,
    onUsage: params.onUsage,
  });
}

/**
 * Production entry: wires the real M6 provider/credential resolution and the
 * shared streaming helper.
 */
export function streamStageChat(params: StageChatParams): AsyncIterable<string> {
  return streamStageChatWith(params, {
    resolveTarget: (id, sid) => moduleRegistry.resolveChatTarget(id, sid),
    stream: streamChatText,
  });
}
