/**
 * Thin wrapper around `@github/copilot-sdk`.
 *
 * The SDK uses the Copilot CLI (bundled via `@github/copilot`) over JSON-RPC.
 * `getCopilotClient` spawns the CLI, opens a session, and adapts the
 * session-based API to the simple `complete()` interface used by this module.
 * Call `destroy()` on the returned client when the translation batch finishes
 * so the CLI process is properly stopped.
 *
 * The SDK is an OPTIONAL dependency, because it depends in turn on the Copilot
 * CLI, which is proprietary — it ships under GitHub's own licence rather than
 * an open-source one — and nobody should be forced to install that to use a
 * provider they never pick. Optional does not mean absent: a default install
 * still fetches it. What optional buys is that opting out is now POSSIBLE,
 * which requires that nothing in this file reference the package statically.
 * Nothing does — the module still loads, registers, and appears in the UI
 * without it, and only an actual translation call (which goes through
 * `getCopilotClient`) resolves it. The SDK types this wrapper needs are
 * declared locally below for the same reason: `import type` from a package
 * that is not installed does not compile either.
 */

import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

/*
 * ---------------------------------------------------------------------------
 * Local declarations of the `@github/copilot-sdk` surface this wrapper uses.
 *
 * Every shape below is copied from the SDK's own bundled declarations
 * (`types.d.ts`, `client.d.ts`, `session.d.ts` of `@github/copilot-sdk`
 * 1.0.8). The model-description types are reproduced in full because
 * `ModelInfo` is re-exported from this module and read by callers; the client
 * and session types are deliberately NARROW — they describe only the four
 * client methods and three session methods this wrapper calls, not the SDK's
 * whole API. The cost of that narrowing is stated at each declaration.
 * ---------------------------------------------------------------------------
 */

/** Model capabilities and limits reported by the Copilot CLI. */
interface ModelCapabilities {
  supports: {
    vision: boolean;
    /** Whether this model supports reasoning effort configuration */
    reasoningEffort: boolean;
  };
  limits: {
    max_prompt_tokens?: number;
    max_context_window_tokens: number;
    vision?: {
      supported_media_types: string[];
      max_prompt_images: number;
      max_prompt_image_size: number;
    };
  };
}

/** Model policy state. */
interface ModelPolicy {
  state: 'enabled' | 'disabled' | 'unconfigured';
  terms: string;
}

/** Long-context tier pricing, for models with an extended context window. */
interface ModelBillingTokenPricesLongContext {
  /** AI Credits cost per billing batch of input tokens */
  inputPrice?: number;
  /** AI Credits cost per billing batch of output tokens */
  outputPrice?: number;
  /** @deprecated Use cacheReadPrice instead. Cost per billing batch of cached tokens */
  cachePrice?: number;
  /** AI Credits cost per billing batch of cached (read) tokens */
  cacheReadPrice?: number;
  /** AI Credits cost per billing batch of cache-write (cache creation) tokens */
  cacheWritePrice?: number;
  /** @deprecated Use maxPromptTokens instead. Prompt token budget for the long context tier */
  contextMax?: number;
  /** Prompt token budget for the long context tier */
  maxPromptTokens?: number;
}

/** Token-level pricing information for a model. */
interface ModelBillingTokenPrices {
  /** AI Credits cost per billing batch of input tokens */
  inputPrice?: number;
  /** AI Credits cost per billing batch of output tokens */
  outputPrice?: number;
  /** @deprecated Use cacheReadPrice instead. Cost per billing batch of cached tokens */
  cachePrice?: number;
  /** AI Credits cost per billing batch of cached (read) tokens */
  cacheReadPrice?: number;
  /** AI Credits cost per billing batch of cache-write (cache creation) tokens */
  cacheWritePrice?: number;
  /** Number of tokens per standard billing batch */
  batchSize?: number;
  /** @deprecated Use maxPromptTokens instead. Prompt token budget for the default tier */
  contextMax?: number;
  /** Prompt token budget for the default tier */
  maxPromptTokens?: number;
  longContext?: ModelBillingTokenPricesLongContext;
}

/** Model billing information. */
interface ModelBilling {
  /** Billing cost multiplier relative to the base rate */
  multiplier?: number;
  /** Token-level pricing information for this model */
  tokenPrices?: ModelBillingTokenPrices;
}

/** Information about an available model, as reported by the Copilot CLI. */
export interface ModelInfo {
  /** Model identifier (e.g., "claude-sonnet-4.5") */
  id: string;
  /** Display name */
  name: string;
  /** Model capabilities and limits */
  capabilities: ModelCapabilities;
  /** Policy state */
  policy?: ModelPolicy;
  /** Billing information */
  billing?: ModelBilling;
  /** Supported reasoning effort levels (only present if the model supports reasoning effort) */
  supportedReasoningEfforts?: SdkReasoningEffort[];
  /** Default reasoning effort level (only present if the model supports reasoning effort) */
  defaultReasoningEffort?: SdkReasoningEffort;
}

/**
 * The permission handler shape this module passes to `createSession`.
 *
 * NARROWER than the SDK's `PermissionHandler`, deliberately: that type receives
 * a permission request and may return any decision variant, both of which are
 * large generated unions. This module answers every request the same way and
 * reads neither argument, so only the reject decision is modelled. If a future
 * change needs the request payload or another decision kind, this type has to
 * grow to match the SDK rather than be guessed at.
 */
type DenyAllPermissionHandler = () => { kind: 'reject'; feedback: string };

/** Subset of the session options this wrapper passes to `createSession`. */
interface SdkSessionConfig {
  model: string;
  systemMessage: { mode: 'replace'; content: string };
  reasoningEffort?: SdkReasoningEffort;
  infiniteSessions: { enabled: boolean };
  onPermissionRequest: DenyAllPermissionHandler;
}

/**
 * The three session methods this wrapper calls. The SDK's `CopilotSession` is a
 * much larger class (canvases, elicitation, history, lifecycle events); none of
 * that is used here, so declaring the whole thing locally would be copying code
 * this module never exercises.
 */
interface SdkSession {
  on(eventType: 'assistant.usage', handler: (event: { data: UsageEventData }) => void): () => void;
  sendAndWait(
    options: { prompt: string },
    timeout?: number,
  ): Promise<{ data: AssistantMessageData } | undefined>;
  disconnect(): Promise<void>;
}

/** The four client methods this wrapper calls, from the SDK's `CopilotClient`. */
interface SdkClient {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  listModels(): Promise<ModelInfo[]>;
  createSession(config: SdkSessionConfig): Promise<SdkSession>;
}

/** The one export this wrapper pulls out of the SDK's module namespace. */
interface SdkModule {
  CopilotClient: new (options: { gitHubToken: string; baseDirectory: string }) => SdkClient;
}

/**
 * Package name of the optional SDK.
 *
 * Typed as a plain `string`, not the inferred literal, on purpose: TypeScript
 * resolves and typechecks `import()` when it can see the specifier as a literal,
 * which would once again make the build fail for anyone who installed without
 * the optional dependency. Widening the type stops the compile-time resolution
 * while leaving the runtime import exactly the same.
 */
const SDK_PACKAGE: string = '@github/copilot-sdk';

let sdkModulePromise: Promise<SdkModule> | undefined;

/**
 * Resolve the Copilot SDK on first use, memoizing the result.
 *
 * A missing package surfaces here, at the moment someone actually asks Copilot
 * to translate, rather than at import time where it would take the whole module
 * registry down with it.
 *
 * ONLY a module-resolution failure is rewritten into the install advice. The
 * SDK loads `koffi`, a native addon, and reaches a platform-specific binary at
 * runtime, so an installed-but-unloadable SDK is a real failure mode — telling
 * someone to install what they already have would send them somewhere that
 * cannot help. Everything else is rethrown untouched. Note that a missing
 * dependency OF the SDK reports the same code; `cause` carries the original
 * error, which names the package that was actually missing.
 */
async function loadSdk(): Promise<SdkModule> {
  sdkModulePromise ??= (import(SDK_PACKAGE) as Promise<SdkModule>).catch((err: unknown) => {
    if ((err as { code?: unknown } | null)?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    throw new Error(
      'The GitHub Copilot provider needs @github/copilot-sdk, which is an optional ' +
        'dependency and could not be loaded. Install it to enable Copilot.',
      { cause: err },
    );
  });
  return sdkModulePromise;
}

export type ReasoningEffort =
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'disabled'
  | 'enabled'
  | 'minimal'
  | 'max';
/**
 * Narrower type accepted by the underlying Copilot SDK createSession() call —
 * the SDK's own `ReasoningEffort` union, which is a strict subset of the
 * app-wide one above.
 */
type SdkReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

/**
 * Permission handler for translation sessions.
 *
 * A translation completion is a single text-in/text-out call that needs no
 * tools, file access, or shell. We therefore DENY every permission the Copilot
 * agent might request, rather than auto-approving it (the SDK's `approveAll`),
 * so a prompt-injection in the untrusted source text can never coax the local
 * agent into a tool/file/shell action.
 */
const denyAllPermissions: DenyAllPermissionHandler = () => ({
  kind: 'reject',
  feedback: 'Translation sessions do not grant tool, file, or shell permissions.',
});

/**
 * `ModelInfo` augmented with the display-only fields the model picker reads
 * (not part of the SDK's `ModelInfo`): capability tags and context length.
 */
export interface CopilotModelInfo extends ModelInfo {
  capabilityTags?: string[];
  contextLength?: number;
}

export interface CopilotCompletionRequest {
  model: string;
  system: string;
  user: string;
  reasoningEffort?: ReasoningEffort;
  /**
   * Checked before the SDK call is issued so a cancelled run stops spawning new
   * Copilot work. (The underlying `sendAndWait` does not accept an abort signal,
   * so an already-issued call still runs to completion or its own timeout.)
   */
  signal?: AbortSignal;
  /**
   * Per-request timeout (ms) forwarded to the SDK's `sendAndWait`. The SDK
   * defaults to 60000 when omitted; the host injects a generous value from the
   * workspace `requestTimeoutMs` setting.
   */
  timeoutMs?: number;
}

/**
 * Real provider-reported token usage for one completion, captured from the
 * SDK's `assistant.usage` events (per API call), with the assistant message's
 * `outputTokens`/`model` as a fallback when no usage event was observed.
 */
export interface CopilotUsage {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

export interface CopilotCompletionResponse {
  text: string;
  raw?: unknown;
  /** Provider-reported token usage for this call, when the SDK emitted it. */
  usage?: CopilotUsage;
}

/** Subset of `assistant.usage` event data this module reads. */
interface UsageEventData {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

/** Subset of `assistant.message` event data this module reads for fallback. */
interface MessageEventData {
  outputTokens?: number;
  model?: string;
}

/**
 * The assistant-message payload `sendAndWait` resolves with — the fallback
 * usage fields above plus the completion text this wrapper returns.
 */
interface AssistantMessageData extends MessageEventData {
  content?: string;
}

/**
 * Single source of truth for the "which reasoning effort, if any, does the
 * Copilot SDK accept for this model" rule. Returns the effort to forward to
 * `createSession()`, or `undefined` when none should be sent.
 *
 * Truthiness (not `!== undefined`) so a raw '' (the UI "Default" sentinel)
 * never reaches createSession. 'disabled' is an explicit off-switch, and
 * 'enabled' is a non-graded on-switch (used by other providers, e.g. Anthropic
 * Haiku) that the Copilot SDK does not accept — only graded levels are forwarded.
 * 'minimal' and 'max' are valid effort levels for OTHER providers (they appear
 * in the app-wide ReasoningEffort union) but the Copilot SDK's createSession
 * accepts only the graded levels in `SdkReasoningEffort`, so they are rejected
 * here rather than passed through to a call the SDK would reject. The SDK also
 * rejects reasoningEffort when the model is "auto".
 */
const SDK_GRADED_EFFORTS: ReadonlySet<ReasoningEffort> = new Set<ReasoningEffort>([
  'low',
  'medium',
  'high',
  'xhigh',
]);

/**
 * Whether a discovered model supports reasoning effort, expressed once so the
 * `capabilityTags` `'thinking'` tag (listModels) and the translate-path
 * force-disable gate (index.ts) cannot drift. A model qualifies when it
 * advertises a non-empty `supportedReasoningEfforts` list OR sets the
 * `capabilities.supports.reasoningEffort` flag. Optional chaining mirrors the
 * call sites, which receive partial mocks where `capabilities` may be absent.
 */
export function modelSupportsReasoningEffort(m: ModelInfo): boolean {
  return (
    (m.supportedReasoningEfforts?.length ?? 0) > 0 ||
    m.capabilities?.supports?.reasoningEffort === true
  );
}

export function normalizeReasoningEffort(
  model: string,
  reasoningEffort: ReasoningEffort | undefined,
): SdkReasoningEffort | undefined {
  if (!reasoningEffort || model.trim().toLowerCase() === 'auto') return undefined;
  // Only graded levels the Copilot SDK accepts are forwarded; every other value
  // ('disabled'/'enabled' sentinels, and the cross-provider 'minimal'/'max')
  // is dropped so an unsupported effort can never reach createSession.
  return SDK_GRADED_EFFORTS.has(reasoningEffort)
    ? (reasoningEffort as SdkReasoningEffort)
    : undefined;
}

/**
 * Builds the (possibly empty) `reasoningEffort` fragment to spread into the
 * Copilot SDK's `createSession()` arguments. Returns `{ reasoningEffort }` only
 * for an SDK-accepted graded level, otherwise `{}`. Shared by `complete()` and
 * `openSession()` so the gate cannot drift between the two call sites, and so
 * the value forwarded is the already-typed `SdkReasoningEffort` (no casts).
 */
function reasoningEffortArg(req: { model: string; reasoningEffort?: ReasoningEffort }): {
  reasoningEffort?: SdkReasoningEffort;
} {
  const effort = normalizeReasoningEffort(req.model, req.reasoningEffort);
  return effort !== undefined ? { reasoningEffort: effort } : {};
}

/**
 * Aggregate the `assistant.usage` events captured during one completion into a
 * single `CopilotUsage`. Falls back to the assistant message's `outputTokens`
 * and `model` when no usage event carried them. Returns undefined when no
 * usage signal was seen at all.
 */
function aggregateUsage(
  events: readonly UsageEventData[],
  message: MessageEventData | undefined,
): CopilotUsage | undefined {
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let model: string | undefined;
  for (const e of events) {
    if (e.inputTokens !== undefined) inputTokens = (inputTokens ?? 0) + e.inputTokens;
    if (e.outputTokens !== undefined) outputTokens = (outputTokens ?? 0) + e.outputTokens;
    if (e.model) model = e.model;
  }
  // The assistant message carries the real completion-token count and model
  // even when the usage event was not observed in time.
  if (outputTokens === undefined && message?.outputTokens !== undefined) {
    outputTokens = message.outputTokens;
  }
  if (model === undefined && message?.model !== undefined) model = message.model;
  if (inputTokens === undefined && outputTokens === undefined && model === undefined) {
    return undefined;
  }
  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(model !== undefined ? { model } : {}),
  };
}

/**
 * The SDK's `ModelBilling` augmented with `outputMultiplier` — the output-side
 * price multiplier this module derives. Since 1.0.2 the SDK types `multiplier`
 * and `tokenPrices` natively, but not `outputMultiplier`; we attach it the same
 * way `CopilotModelInfo` augments `ModelInfo`, and the frontend reads it back
 * via the shared `ModelInfo.billing.outputMultiplier`.
 */
type AugmentedBilling = ModelBilling & { outputMultiplier?: number };

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Augments one discovered model in place with the picker-only display fields:
 * billing multipliers (relative to the resolved baseline prices), capability
 * tags, and context length. Each branch is guarded so a second pass over an
 * already-enriched list is idempotent (cache-hit safe).
 */
function enrichModel(m: ModelInfo, baselinePrice: number, baselineOutputPrice: number): void {
  // The picker-only fields (capabilityTags/contextLength) are not on the SDK's
  // ModelInfo; view m through the augmented type instead of casting at each
  // assignment.
  const model = m as CopilotModelInfo;
  if (m.billing) {
    // View billing through the augmented type so `outputMultiplier` (not part of
    // the SDK's ModelBilling) typechecks; optional chaining covers a billing
    // object the CLI returned without `tokenPrices`.
    const billing = m.billing as AugmentedBilling;
    const inputPrice = billing.tokenPrices?.inputPrice;
    if (inputPrice !== undefined && billing.multiplier === undefined) {
      billing.multiplier = round2(inputPrice / baselinePrice);
    }
    const outputPrice = billing.tokenPrices?.outputPrice;
    if (outputPrice !== undefined && billing.outputMultiplier === undefined) {
      billing.outputMultiplier = round2(outputPrice / baselineOutputPrice);
    }
  }

  // Surface display-only capability tags for the model picker, derived from
  // Copilot's `capabilities.supports` flags. Attached as an extra field (not
  // part of the SDK's ModelInfo) consumed by the frontend's shared
  // ModelInfo.capabilityTags.
  const supports = m.capabilities?.supports;
  if (supports) {
    const tags: string[] = [];
    if (supports.reasoningEffort) tags.push('thinking');
    if (supports.vision) tags.push('vision');
    if (tags.length > 0) {
      model.capabilityTags = tags;
    }
  }

  // Surface the model's context window for the picker, from Copilot's
  // `capabilities.limits.max_context_window_tokens`. Attached as an extra field
  // (not part of the SDK's ModelInfo) consumed by the frontend's shared
  // ModelInfo.contextLength.
  const contextWindow = m.capabilities?.limits?.max_context_window_tokens;
  if (typeof contextWindow === 'number' && Number.isFinite(contextWindow) && contextWindow > 0) {
    model.contextLength = Math.floor(contextWindow);
  }
}

/**
 * Sends one prompt on an already-open session and returns the response with
 * aggregated usage. Subscribes to `assistant.usage` for the duration of the
 * call and unsubscribes in `finally`. Does NOT disconnect the session — the
 * caller owns the session lifecycle (`complete` disconnects after; the
 * session-reuse paths keep it open). Shared by `complete` and
 * `completeOnSession` so the usage-capture block cannot drift between them.
 */
async function runOnSession(
  session: SdkSession,
  prompt: string,
  timeoutMs?: number,
): Promise<CopilotCompletionResponse> {
  const usageEvents: UsageEventData[] = [];
  const unsubscribe = session.on('assistant.usage', (event) => {
    usageEvents.push(event.data);
  });
  try {
    const response = await session.sendAndWait({ prompt }, timeoutMs);
    return {
      text: response?.data.content ?? '',
      raw: response,
      usage: aggregateUsage(usageEvents, response?.data),
    };
  } finally {
    unsubscribe();
  }
}

export interface CopilotSessionHandle {
  /** @internal */
  readonly _internal: unknown;
}

export interface CopilotClient {
  complete(req: CopilotCompletionRequest): Promise<CopilotCompletionResponse>;
  /** Returns the list of models available for this token via the Copilot SDK. Optional for test mocks. */
  listModels?(): Promise<ModelInfo[]>;
  /** Stop the underlying CLI process. Call once after all `complete()` calls. */
  destroy?(): Promise<void>;
  /**
   * Opens a new session with the given system prompt. Returns a handle for
   * subsequent `completeOnSession` calls. The caller MUST call `closeSession`
   * (typically in a finally block) to release SDK resources.
   */
  openSession?(req: {
    model: string;
    system: string;
    reasoningEffort?: ReasoningEffort;
  }): Promise<CopilotSessionHandle>;
  /**
   * Sends a user message on an already-open session and waits for the response.
   * The session accumulates conversation history, so this call only pays the
   * delta prompt rather than the full system prompt again. `signal` is checked
   * before the SDK call is issued so a cancelled retry stops spawning new
   * Copilot work (mirroring `complete`'s pre-call guard).
   */
  completeOnSession?(
    handle: CopilotSessionHandle,
    prompt: string,
    signal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<CopilotCompletionResponse>;
  /** Disconnects the session and releases underlying SDK resources. */
  closeSession?(handle: CopilotSessionHandle): Promise<void>;
}

/**
 * Resolve a writable home for the bundled Copilot CLI. The CLI writes its
 * config/state under COPILOT_HOME (default `~/.copilot`); in a read-only-home
 * sandbox (dev containers, the Node permission model) that write fails with
 * EROFS and the CLI exits 1 with a multi-KB stderr dump. Honor an explicit
 * COPILOT_HOME when the deployment sets one, else fall back to a writable temp
 * directory.
 */
function resolveCopilotHome(): string {
  return process.env.COPILOT_HOME ?? path.join(os.tmpdir(), 'translator-copilot-home');
}

export async function getCopilotClient(token: string): Promise<CopilotClient> {
  // Resolve the optional SDK before anything else, so a missing install fails
  // with the explanatory error rather than part-way through setup.
  const { CopilotClient: SDKClient } = await loadSdk();
  // baseDirectory sets COPILOT_HOME on the spawned CLI runtime, steering its
  // config write off a possibly read-only home and onto a writable path.
  const baseDirectory = resolveCopilotHome();
  try {
    mkdirSync(baseDirectory, { recursive: true, mode: 0o700 });
  } catch {
    // Best-effort: the SDK/CLI still attempts its own directory handling.
  }
  const sdkClient: SdkClient = new SDKClient({ gitHubToken: token, baseDirectory });
  let cachedModels: ModelInfo[] | null = null;

  return {
    async listModels() {
      if (cachedModels) return cachedModels;
      await sdkClient.start();
      const models = await sdkClient.listModels();

      // Calculate multipliers for models if missing since Copilot API now uses usage-based billing with AI credits
      const baselineModel =
        models.find((m) => m.id === 'gpt-4.1') || models.find((m) => m.id === 'gpt-4o');
      let baselinePrice = 1;
      let baselineOutputPrice = 1;

      // Adopt baseline prices only when they are positive so a free/zero-priced
      // baseline cannot produce Infinity multipliers via division by zero.
      if (baselineModel?.billing) {
        const baselineInputPrice = baselineModel.billing.tokenPrices?.inputPrice;
        if (baselineInputPrice !== undefined && baselineInputPrice > 0) {
          baselinePrice = baselineInputPrice;
        }
        const baselineOutput = baselineModel.billing.tokenPrices?.outputPrice;
        if (baselineOutput !== undefined && baselineOutput > 0) {
          baselineOutputPrice = baselineOutput;
        }
      }

      for (const m of models) {
        enrichModel(m, baselinePrice, baselineOutputPrice);
      }

      cachedModels = models;
      return cachedModels;
    },

    async complete(req) {
      // Stop before paying for a session the caller has already cancelled.
      req.signal?.throwIfAborted();
      const session = await sdkClient.createSession({
        model: req.model,
        systemMessage: { mode: 'replace', content: req.system },
        ...reasoningEffortArg(req),
        infiniteSessions: { enabled: false },
        onPermissionRequest: denyAllPermissions,
      });
      try {
        return await runOnSession(session, req.user, req.timeoutMs);
      } finally {
        await session.disconnect();
      }
    },

    async destroy() {
      await sdkClient.stop();
    },

    async openSession(req) {
      const session = await sdkClient.createSession({
        model: req.model,
        systemMessage: { mode: 'replace', content: req.system },
        ...reasoningEffortArg(req),
        infiniteSessions: { enabled: false },
        onPermissionRequest: denyAllPermissions,
      });
      return { _internal: session };
    },

    async completeOnSession(handle, prompt, signal, timeoutMs) {
      // Stop before paying for a turn the caller has already cancelled.
      signal?.throwIfAborted();
      const session = (handle as { _internal: SdkSession })._internal;
      return runOnSession(session, prompt, timeoutMs);
    },

    async closeSession(handle) {
      const session = (handle as { _internal: SdkSession })._internal;
      await session.disconnect();
    },
  };
}
