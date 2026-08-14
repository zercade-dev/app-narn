import type { ProviderType } from './types.js';
import { modelSupportsReasoning, modelSupportsDisableThinking } from './reasoning-resolvers.js';

/** Effort levels accepted by the @ai-sdk/deepseek per-request options schema. */
const DEEPSEEK_VALID_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

/**
 * Graded thinking-token budgets keyed by reasoning effort. Shared by the Gemini
 * (non-Gemini-3) `thinkingBudget` path and the anthropic-compatible legacy
 * `budgetTokens` path; both fall back to the `medium` value for unknown efforts.
 */
const THINKING_BUDGET_BY_EFFORT: Record<string, number> = {
  low: 1024,
  medium: 4096,
  high: 8192,
  xhigh: 16384,
};

/** Clamp of our ReasoningEffort values onto the @ai-sdk/anthropic effort enum. */
const ANTHROPIC_EFFORT_CLAMP: Record<string, string> = {
  minimal: 'low',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
};

export function buildProviderOptions(
  provider: ProviderType,
  input: { reasoningEffort?: string; modelId: string },
): Record<string, unknown> | undefined {
  const { reasoningEffort, modelId } = input;
  // Empty / "Default": send nothing and let the provider pick its own default.
  if (!reasoningEffort) return undefined;

  // Capability guard: a stale/overridden effort must never reach a model that
  // rejects reasoning options (e.g. reasoningEffort 'high' left in a config
  // after switching to gpt-4o). `undefined` means "unknown" — do not guard,
  // preserving behavior for custom/compatible endpoints.
  if (modelSupportsReasoning(provider, modelId) === false) return undefined;

  // Explicit "off". Most providers turn thinking off simply by omitting options
  // (Anthropic, OpenAI), but Gemini and DeepSeek default thinking ON, so they
  // need a positive off-signal — and only where the model can honor it (the
  // same models whose resolvers advertise `disabled`).
  if (reasoningEffort === 'disabled') {
    if (provider === 'google' && modelSupportsDisableThinking('google', modelId)) {
      return { google: { thinkingConfig: { thinkingBudget: 0 } } };
    }
    if (provider === 'deepseek' && modelSupportsDisableThinking('deepseek', modelId)) {
      return { deepseek: { thinking: { type: 'disabled' } } };
    }
    if (provider === 'openrouter') {
      // Omit reasoning options entirely: OpenRouter documents that
      // effort "none" is REJECTED (400) by models whose reasoning is
      // mandatory, and its behavior on non-reasoning models is unspecified —
      // while omission is the universal safe "off" (the model's own default
      // applies). Deliberately NOT the openai-compatible 'none' path below,
      // which is Ollama/vLLM-specific.
      return undefined;
    }
    if (provider === 'groq') {
      // Same reasoning as openrouter immediately above: Groq's gpt-oss
      // reasoning models document the same 'none' rejection risk, so omission
      // is the safe universal "off" here too. Deliberately NOT the
      // openai-compatible 'none' path below, which is Ollama/vLLM-specific.
      return undefined;
    }
    if (provider === 'openai-compatible') {
      // Ollama/vLLM turn thinking off via reasoning_effort:"none" on the
      // /v1/chat/completions endpoint (verified on Ollama 0.24). The option is
      // only ever reachable when discovery advertised `disabled` (i.e. the
      // model reported the `thinking` capability); on a non-thinking backend
      // the field is simply ignored.
      return { openaiCompatible: { reasoningEffort: 'none' } };
    }
    return undefined;
  }

  // Plain "thinking on" with no graded effort. Emitted for thinking-capable
  // models that reject the `effort` parameter (e.g. Anthropic Claude Haiku):
  // enable adaptive thinking without sending an effort the model can't honor.
  if (reasoningEffort === 'enabled') {
    if (provider === 'anthropic') {
      return { anthropic: { thinking: { type: 'adaptive' } } };
    }
    if (provider === 'anthropic-compatible') {
      // Legacy emulators don't understand adaptive thinking; use the explicit
      // enabled form with the same default budget as the graded branch.
      return { anthropic: { thinking: { type: 'enabled', budgetTokens: 4096 } } };
    }
    return undefined;
  }

  if (provider === 'google') {
    const isGemini3 = /^gemini-3/i.test(modelId);

    // Known value mappings
    const knownLevels: Record<string, string> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'high',
    };
    return isGemini3
      ? { google: { thinkingConfig: { thinkingLevel: knownLevels[reasoningEffort] ?? 'medium' } } }
      : {
          google: {
            thinkingConfig: {
              thinkingBudget: THINKING_BUDGET_BY_EFFORT[reasoningEffort] ?? 4096,
            },
          },
        };
  }

  if (provider === 'deepseek') {
    // Clamp to the @ai-sdk/deepseek enum; unknown values omit the field but
    // keep thinking enabled.
    return {
      deepseek: {
        thinking: { type: 'enabled' },
        ...(DEEPSEEK_VALID_EFFORTS.has(reasoningEffort) ? { reasoningEffort } : {}),
      },
    };
  }

  if (provider === 'openai') {
    return { openai: { reasoningEffort } };
  }

  if (provider === 'anthropic') {
    // Adaptive thinking + top-level effort (the budget_tokens parameter is
    // removed on Opus 4.7+/Fable 5 and deprecated on 4.6). 'disabled' never
    // reaches this branch — we omit thinking entirely rather than sending an
    // explicit thinking:{type:'disabled'}, which newer models reject.
    return {
      anthropic: {
        thinking: { type: 'adaptive' },
        effort: ANTHROPIC_EFFORT_CLAMP[reasoningEffort] ?? 'medium',
      },
    };
  }

  if (provider === 'openai-compatible' || provider === 'openrouter' || provider === 'groq') {
    // The @ai-sdk/openai-compatible provider reads reasoning_effort from the
    // `openaiCompatible` provider-options key (NOT `openai`), then emits it as
    // `reasoning_effort` in the request body. openrouter and groq share this
    // graded branch (both accept the OpenAI-compat `reasoning_effort` alias)
    // but NOT the `disabled` branch above — for them, "off" is omission.
    return { openaiCompatible: { reasoningEffort } };
  }

  if (provider === 'anthropic-compatible') {
    // Deliberately kept on the legacy budgetTokens mapping: compatible
    // endpoints front unknown emulator backends that may not understand the
    // newer adaptive/effort parameters.
    return {
      anthropic: {
        thinking: {
          type: 'enabled',
          budgetTokens: THINKING_BUDGET_BY_EFFORT[reasoningEffort] ?? 4096,
        },
      },
    };
  }

  return undefined;
}
