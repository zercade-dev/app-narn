/**
 * Shared module/model selection for the background AI-review engines (M25
 * JudgeEngine, M26 SourceReviewEngine). Both pick a capable module with the
 * same precedence — an explicit requested id, else the cheapest enabled module
 * that implements the wanted capability — and apply the same per-run overrides
 * (model, reasoning-effort, verbose log sink, global requests-per-second). Only
 * the capability predicate and the thrown error type differ, so they are passed
 * in by the caller.
 */
import type {
  CostTier,
  GlobalConfig,
  Project,
  ProjectModuleConfigEntry,
  TranslationModule,
} from '@zercade-dev/narn-shared';
import type { ModuleRegistry } from '../M6-module-registry.js';
import { resolveEffectiveModuleConfig } from '../M19-global-config-store.js';

/** Cheapest-first ordering used to rank enabled modules when none is requested. */
export const COST_TIER_ORDER: Record<CostTier, number> = { free: 0, low: 1, medium: 2, high: 3 };

/** Matches the AI SDK provider module's `log` config option (see core.ts). */
export type ModuleLogFn = (
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
) => void;

interface SelectCapableModuleOptions {
  /** Explicit module id; when set, only that module is considered. */
  requestedId?: string;
  /** Per-run model override (module config key `model`). */
  requestedModel?: string;
  /** Per-run reasoning-effort override (module config key `reasoningEffort`). */
  requestedEffort?: string;
  /** When true, force the module's verbose logging on for this run. */
  verbose?: boolean;
  /** Sink for the module's verbose output (server console + UI capture). */
  logSink?: ModuleLogFn;
  /** Predicate that decides whether a built module can perform the wanted work. */
  capability: (module: TranslationModule) => boolean;
  /** Builds the error thrown when no candidate is capable. */
  notPossible: (message: string) => Error;
  /**
   * Message used when a specific module was requested but cannot do the work
   * (e.g. `module "x" cannot judge translations`); the requested id is prefixed.
   */
  requestedFailLabel: string;
  /** Message used when no module is requested and none is capable. */
  noneAvailableMessage: string;
}

/**
 * Picks a capable module/model. Precedence: an explicit `requestedId`, else the
 * cheapest enabled+active module whose built instance satisfies `capability`.
 * Throws `notPossible(...)` when nothing qualifies.
 */
export function selectCapableModule(
  registry: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>,
  project: Project,
  global: GlobalConfig,
  sessionId: string | undefined,
  options: SelectCapableModuleOptions,
): { module: TranslationModule; moduleId: string } {
  const projectEntries = project.moduleConfigs as Record<
    string,
    ProjectModuleConfigEntry | undefined
  >;
  const { requestedId, requestedModel, requestedEffort, verbose, logSink, capability } = options;
  const candidates = requestedId
    ? registry.listModules(sessionId).filter((m) => m.id === requestedId)
    : registry
        .listModules(sessionId)
        .filter((m) => {
          const effective = resolveEffectiveModuleConfig(m.id, global, projectEntries[m.id]);
          return effective.enabled && effective.active !== false;
        })
        .sort((a, b) => COST_TIER_ORDER[a.costTier] - COST_TIER_ORDER[b.costTier]);

  for (const candidate of candidates) {
    const effective = resolveEffectiveModuleConfig(
      candidate.id,
      global,
      projectEntries[candidate.id],
    );
    const overrides: Record<string, unknown> = {};
    if (requestedModel) overrides.model = requestedModel;
    if (requestedEffort) overrides.reasoningEffort = requestedEffort;
    if (verbose) overrides.verbose = true;
    // Always route the module's log output to the run's log sink (server
    // console + UI capture): a module whose CONFIG sets verbose:true is then
    // captured to the run sidecar too, not just per-run verbose overrides.
    if (logSink) overrides.log = logSink;
    const rps = global.settings?.requestsPerSecond;
    const module = registry.createWithConfig(
      candidate.id,
      {
        ...effective.config,
        ...(typeof rps === 'number' && rps > 0 ? { requestsPerSecond: rps } : {}),
        ...overrides,
      },
      sessionId,
    );
    if (module && capability(module)) {
      return { module, moduleId: candidate.id };
    }
  }
  throw options.notPossible(
    requestedId ? options.requestedFailLabel : options.noneAvailableMessage,
  );
}
