/**
 * M27b — endpointType backfill migration.
 *
 * Idempotent backfill that gives every EXISTING generic-ai module/instance
 * config an explicit `endpointType`, completing the move away from the implicit
 * baseURL autodetect (see {@link resolveEndpointType}). Only entries that
 * (a) are generic-ai based, (b) carry a string `baseURL`, and (c) lack a valid
 * `endpointType` are touched; the value is inferred from the baseURL (Ollama
 * `:11434`/`ollama` → `ollama`; LM Studio `:1234`/`lmstudio`/`lm-studio` →
 * `lm-studio`; else `unknown`). An explicit `endpointType` already on the entry
 * is NEVER overwritten (respects a deliberate operator choice).
 *
 * Naturally idempotent — a re-run finds nothing left to backfill, so no schema
 * version marker is needed — and it only persists when at least one entry
 * changed. Must run AFTER M27 (chained, not concurrent) so the two never race a
 * global-config write.
 */
import type { EndpointType } from '@zercade-dev/narn-shared';
import { isOllamaBaseURL } from '@zercade-dev/narn-shared';
import type { GlobalConfigStore } from '../storage/types.js';
import { getGlobalConfigStore } from '../storage/registry.js';
import { logger } from './M15-console-logger.js';

const GENERIC_AI_BASE = 'generic-ai';

/** True for the bare `generic-ai` base id or any `generic-ai:<slug>` instance id. */
function isGenericAiId(moduleId: string): boolean {
  return moduleId === GENERIC_AI_BASE || moduleId.startsWith(`${GENERIC_AI_BASE}:`);
}

/**
 * True when `baseURL` parses as a URL whose port is EXACTLY 1234 (LM Studio's
 * default). A plain `.includes(':1234')` substring check would also match
 * `:12345` (a different port) or a host/path that merely contains that
 * digit sequence — misclassifying it as LM Studio and, downstream, driving a
 * model-unload request against the wrong server. Guards the `new URL()` parse
 * since `baseURL` is operator-configured free text, not guaranteed valid.
 */
function hasLmStudioPort(baseURL: string): boolean {
  try {
    return new URL(baseURL).port === '1234';
  } catch {
    return false;
  }
}

/**
 * Infer the endpoint type from a baseURL for the backfill. Extends the runtime
 * {@link resolveEndpointType} heuristic (ollama-or-unknown) with an LM Studio
 * case so existing LM Studio instances (default port 1234) are typed correctly.
 */
export function inferEndpointTypeFromBaseURL(baseURL: string): EndpointType {
  if (isOllamaBaseURL(baseURL)) return 'ollama';
  if (hasLmStudioPort(baseURL) || baseURL.includes('lmstudio') || baseURL.includes('lm-studio')) {
    return 'lm-studio';
  }
  return 'unknown';
}

/**
 * Run the endpointType backfill. Idempotent; persists only when something
 * changed. Returns the number of module configs migrated.
 */
export async function runEndpointTypeMigration(
  stores: { gcs?: GlobalConfigStore } = {},
): Promise<{ migrated: number }> {
  const gcs = stores.gcs ?? getGlobalConfigStore();
  const current = await gcs.load();

  const moduleConfigs = { ...current.moduleConfigs };
  let migrated = 0;
  for (const [moduleId, entry] of Object.entries(moduleConfigs)) {
    if (!entry || !isGenericAiId(moduleId)) continue;
    const config = (entry.config ?? {}) as Record<string, unknown>;
    const baseURL = config.baseURL;
    if (typeof baseURL !== 'string' || baseURL.length === 0) continue;
    const existing = config.endpointType;
    if (existing === 'ollama' || existing === 'lm-studio' || existing === 'unknown') continue;
    moduleConfigs[moduleId] = {
      ...entry,
      config: { ...config, endpointType: inferEndpointTypeFromBaseURL(baseURL) },
    };
    migrated += 1;
  }

  if (migrated > 0) {
    await gcs.save({ ...current, moduleConfigs });
    logger.info('endpoint-type-migration:complete', { migrated });
  }
  return { migrated };
}
