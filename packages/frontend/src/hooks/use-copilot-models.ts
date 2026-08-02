/**
 * Thin wrapper around `useModuleModels` for the Copilot module.
 * Keeps all original exports for backward compatibility.
 */
import React, { createContext } from 'react';
import { useModuleModels, parseModelsCache as _parseModelsCache } from './use-module-models.js';
import type { UseModuleModelsResult } from './use-module-models.js';

export type { ReasoningEffort } from '@zercade-dev/narn-shared';
export type { ModelInfo, ModelBilling } from '@zercade-dev/narn-shared';

// Re-export parseModelsCache for backward compatibility (tests import it from here).
export const parseModelsCache: typeof _parseModelsCache = _parseModelsCache;

export type UseCopilotModelsResult = UseModuleModelsResult;

/** Shared context so sibling/child components can read the same fetch state. */
export const CopilotModelsContext = createContext<UseCopilotModelsResult | null>(null);

/**
 * Standalone provider for use cases where `CopilotModelSelector` is rendered
 * outside a `ModuleSettingsPanel` (e.g. custom layouts or future screens).
 *
 * `enabled` gates the underlying `/models` fetch: pass `false` when copilot is
 * not globally enabled (or the vault is locked) so the app-shell-level provider
 * doesn't fire a request — and the legitimate 401/423 it returns — for a module
 * the user hasn't enabled. Defaults to `true` for back-compat.
 */
export function CopilotModelsProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const value = useCopilotModels(enabled);
  return React.createElement(CopilotModelsContext.Provider, { value }, children);
}

export function useCopilotModels(enabled = true): UseCopilotModelsResult {
  return useModuleModels('copilot', enabled);
}
