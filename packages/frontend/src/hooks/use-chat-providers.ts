/**
 * Shared "which AI providers can this chat use" logic for the app's two chat
 * assistants (Text Styler's `AssistantPanel`, Stage details' `StageChatPanel`).
 *
 * Fetches `/modules` once on mount AND whenever the vault transitions to
 * unlocked — Cloud (BYOK) mounts these panels with a LOCKED vault more often
 * than not, so every credentialed provider reports `credentialsAvailable:
 * false` at the first fetch and the picker would come up empty forever
 * without a re-fetch on unlock (the same pattern `ModuleSettingsPanel` uses).
 * Tolerates both the `{modules}` and bare-array response shapes.
 *
 * Filters down in two stages: `chatCapable` is enabled instances whose base
 * module is in the chat-supported set (ignoring credentials — i.e. providers
 * the user has actually configured for chat); `instances` is the subset that
 * is ALSO credentialed right now, the only ones actually usable.
 *
 * `emptyReason` distinguishes why the picker is empty so callers render the
 * right hint — in particular, a configured-but-vault-locked provider (the
 * dominant Cloud case) must never be misreported as "no provider configured".
 *
 * Extracted here (rather than copy-pasted into a second panel) because a
 * second verbatim copy of this block is treated as a blocking defect by this
 * project's review rubric.
 */
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from './use-api.js';
import { useVaultStore } from '../stores/vault-store.js';
import type { ModuleInfo } from '../components/batch/ModulesPanel.js';

/**
 * Base modules whose instances may be offered as chat providers. Excludes
 * deepl/pseudo (not AI chat) and copilot (SDK-only, no chat route). generic-ai
 * is included — its custom baseURL is threaded through the chat route
 * (`M6-module-registry.ts`'s `resolveChatTarget`), always as `openai-compatible`
 * (the `format: 'anthropic'` config option isn't wired for chat).
 */
export const CHAT_SUPPORTED_BASE = [
  'anthropic',
  'openai',
  'google',
  'deepseek',
  'openrouter',
  'groq',
  'generic-ai',
] as const;

export type ChatProvidersEmptyReason = 'vault-locked' | 'no-credentials' | 'none';

export interface UseChatProviders {
  /** The raw `/modules` response, unfiltered. */
  modules: ModuleInfo[];
  /** Providers whose base is chat-capable AND enabled, IGNORING credentials. */
  chatCapable: ModuleInfo[];
  /** The subset that is ALSO credentialed (vault unlocked + key present). */
  instances: ModuleInfo[];
  /** Why `instances` is empty, so callers can render the right hint. */
  emptyReason: ChatProvidersEmptyReason;
  vaultUnlocked: boolean;
}

export function useChatProviders(): UseChatProviders {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const vaultUnlocked = useVaultStore((s) => s.unlocked);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ modules: ModuleInfo[] } | ModuleInfo[]>('/modules')
      .then((res) => {
        if (cancelled) return;
        setModules(Array.isArray(res) ? res : res.modules);
      })
      .catch((err: unknown) => {
        // Leave the list empty — the settings zone shows the appropriate hint.
        // Log it so a failed `/modules` fetch isn't silently invisible.
        console.error('[chat providers] failed to load providers', err);
      });
    return () => {
      cancelled = true;
    };
  }, [vaultUnlocked]);

  const chatCapable = useMemo(
    () =>
      modules.filter(
        (m) =>
          m.enabled !== false &&
          (CHAT_SUPPORTED_BASE as readonly string[]).includes(m.baseModuleId ?? m.id),
      ),
    [modules],
  );

  const instances = useMemo(
    () => chatCapable.filter((m) => m.credentialsAvailable === true),
    [chatCapable],
  );

  const emptyReason: ChatProvidersEmptyReason =
    instances.length > 0
      ? 'none'
      : chatCapable.length > 0
        ? vaultUnlocked
          ? 'no-credentials'
          : 'vault-locked'
        : 'none';

  return { modules, chatCapable, instances, emptyReason, vaultUnlocked };
}
