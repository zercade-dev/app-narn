import type { CostTier, ModuleCapability } from '@zercade-dev/narn-shared';

export interface ModuleInfo {
  id: string;
  name: string;
  version: string;
  capabilities: ModuleCapability[];
  costTier: CostTier;
  requiredEnvVars: string[];
  credentialsAvailable: boolean;
  /** True when the module can run an AI review (implements `judgeTranslations`). */
  supportsJudge?: boolean;
  /** True when the module can AI-retranslate with context (implements `retryWithFeedback`). */
  supportsAiRetranslate?: boolean;
  /** Set for named module instances: the id of the base module they copy. */
  baseModuleId?: string;
  /** Whether named instances may be created for this module (absent ⇒ true). */
  instanceable?: boolean;
  /** Whether the instance/module is enabled in global config. */
  enabled?: boolean;
  /** Whether the instance/module is active (absent ⇒ treated as active). */
  active?: boolean;
}

interface ModuleConfig {
  active?: boolean;
}

export function isModuleActive(moduleId: string, moduleConfigs: Record<string, unknown>): boolean {
  const cfg = moduleConfigs[moduleId] as ModuleConfig | undefined;
  return cfg?.active !== false;
}
