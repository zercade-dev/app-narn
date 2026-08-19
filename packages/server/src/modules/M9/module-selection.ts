/**
 * Shared module/model selection for the background AI-review engines (M25
 * JudgeEngine, M26 SourceReviewEngine). Both pick a capable module with the
 * same precedence — an explicit requested id, else the cheapest enabled module
 * that implements the wanted capability — and apply the same per-run overrides
 * (model, reasoning-effort, verbose log sink, global requests-per-second). Only
 * the capability predicate and the thrown error type differ, so they are passed
 * in by the caller.
 */
import {
  type CostTier,
  type GlobalConfig,
  type Project,
  type ProjectModuleConfigEntry,
  type TranslationModule,
  toErrorMessage,
} from '@zercade-dev/narn-shared';
import { sanitizeLogObject } from '../M16-credential-store.js';
import type { ModuleRegistry } from '../M6-module-registry.js';
import { resolveEffectiveModuleConfig } from '../M19-global-config-store.js';
import { selectBackgroundBucket } from '../M32/background-select.js';
import {
  freewayModuleOverrides,
  loadBucketViews,
  type BucketSourceDeps,
} from '../M32/bucket-source.js';
import type { DifficultyBand } from '../M32/types.js';

/** Cheapest-first ordering used to rank enabled modules when none is requested. */
export const COST_TIER_ORDER: Record<CostTier, number> = { free: 0, low: 1, medium: 2, high: 3 };

/** Matches the AI SDK provider module's `log` config option (see core.ts). */
export type ModuleLogFn = (
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
) => void;

export interface SelectCapableModuleOptions {
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
   * Optional: callers that never surface a requested-module failure (the
   * free-tier resolver skips such a bucket instead of throwing) omit it.
   */
  requestedFailLabel?: string;
  /** Message used when no module is requested and none is capable. */
  noneAvailableMessage: string;
  /**
   * Config values applied LAST, after the effective global/project config and
   * every per-run override — so they win over user configuration in both
   * directions. Freeway uses this for the dispatch settings it manages itself
   * from snapshot facts about the chosen model; ordinary selection leaves it
   * unset.
   */
  configOverrides?: Record<string, unknown>;
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
  const configOverrides = options.configOverrides ?? {};
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
        ...configOverrides,
      },
      sessionId,
    );
    if (module && capability(module)) {
      return { module, moduleId: candidate.id };
    }
  }
  throw options.notPossible(
    requestedId
      ? (options.requestedFailLabel ?? options.noneAvailableMessage)
      : options.noneAvailableMessage,
  );
}

/** A background run bound to one free-tier bucket for its whole duration. */
export interface FreewayBackgroundSelection {
  module: TranslationModule;
  /** The concrete module/instance id the bucket dispatches to. */
  moduleId: string;
  /** The bucket's model id — the quota being spent. */
  modelId: string;
  /** Ledger key of the bucket this run spends against. */
  bucketKey: string;
}

export interface SelectFreewayBackgroundOptions extends SelectCapableModuleOptions {
  /** Difficulty band the run is scored at; defaults to the background band. */
  band?: DifficultyBand;
  /** Bucket-source overrides (ledger / module status / cloud mode) for tests. */
  deps?: BucketSourceDeps;
  /** Evaluation instant; defaults to now. */
  now?: number;
  /** Reserve forwarded to {@link selectBackgroundBucket}; defaults there. */
  reserveRequests?: number;
}

/**
 * Session-scoped `moduleStatus` for the bucket source: enablement from the
 * effective (workspace + project) module config, credentials from the
 * registry's per-session metadata. Mirrors the equivalent closure the
 * translation engine threads into its own bucket loads, but built from
 * `listModules` so it works with the narrowed registry the background engines
 * hold.
 */
function backgroundModuleStatus(
  registry: Pick<ModuleRegistry, 'listModules'>,
  project: Project,
  global: GlobalConfig,
  sessionId: string | undefined,
): (moduleId: string) => { credentialed: boolean; enabled: boolean } | undefined {
  const projectEntries = project.moduleConfigs as Record<
    string,
    ProjectModuleConfigEntry | undefined
  >;
  // One registry sweep for the whole resolution rather than one per candidate.
  const metadata = new Map(registry.listModules(sessionId).map((m) => [m.id, m]));
  return (moduleId: string) => {
    const meta = metadata.get(moduleId);
    if (!meta) return undefined;
    const effective = resolveEffectiveModuleConfig(moduleId, global, projectEntries[moduleId]);
    return {
      credentialed: meta.credentialStatus === 'ok',
      enabled: effective.enabled && effective.active !== false,
    };
  };
}

/**
 * Resolves the free-tier target for a background run: the adequate bucket the
 * selector hands back once it has minimized the share of a bucket's own
 * remaining free stock the run would consume AND applied the background
 * reserve (which can deflect a top-ranked tier-4 bucket to a lower-tier
 * fallback), whose module can actually do this kind of work, built with the
 * run's per-run overrides exactly as {@link selectCapableModule} would have
 * built an explicitly requested module. Called ONCE at run start — the run
 * keeps the returned binding for its whole duration.
 *
 * Buckets are tried in the selector's order and one is skipped when its module
 * cannot be built or fails the capability predicate (classical MT can't judge,
 * for instance). Throws `options.notPossible(...)` when nothing is eligible, so
 * the caller reports its ordinary module-unavailable failure instead of
 * silently spending a paid module's quota.
 */
export async function selectFreewayBackgroundModule(
  registry: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>,
  project: Project,
  global: GlobalConfig,
  sessionId: string | undefined,
  options: SelectFreewayBackgroundOptions,
): Promise<FreewayBackgroundSelection> {
  const now = options.now ?? Date.now();
  const overrides = options.deps ?? {};
  const deps: BucketSourceDeps = {
    ...overrides,
    moduleStatus:
      overrides.moduleStatus ?? backgroundModuleStatus(registry, project, global, sessionId),
  };
  const remaining = await loadBucketViews(now, deps);
  const selectOpts = {
    ...(options.band !== undefined ? { band: options.band } : {}),
    ...(options.reserveRequests !== undefined ? { reserveRequests: options.reserveRequests } : {}),
  };
  while (remaining.length > 0) {
    const selection = selectBackgroundBucket(remaining, now, selectOpts);
    if (!selection) break;
    const { bucket } = selection;
    remaining.splice(remaining.indexOf(bucket), 1);
    try {
      const built = selectCapableModule(registry, project, global, sessionId, {
        ...options,
        // Dispatch through the resolved instance, not the bare base — see
        // BucketView.dispatchModuleId.
        requestedId: bucket.dispatchModuleId ?? bucket.moduleId,
        // The bucket's model is the quota being spent, so it wins over any
        // per-run model override (which named a different provider's model).
        requestedModel: bucket.modelId,
        // Same Freeway-managed dispatch settings the translate path applies:
        // a per-model upstream fact outranks the workspace's own config.
        configOverrides: {
          ...options.configOverrides,
          ...freewayModuleOverrides(bucket.moduleId, bucket.modelId),
        },
      });
      return { ...built, modelId: bucket.modelId, bucketKey: bucket.bucketKey };
    } catch (err) {
      // This bucket's module can't be built or can't do this work — try the
      // next one the selector offers rather than failing the whole run on it.
      // Leave a breadcrumb so a resolution that walked past several buckets
      // is explainable; the reason is value-scrubbed like every other logged
      // provider error.
      options.logSink?.('warn', 'freeway: skipping bucket', {
        bucketKey: bucket.bucketKey,
        reason: sanitizeLogObject({ m: toErrorMessage(err) }).m,
      });
      continue;
    }
  }
  throw options.notPossible(options.noneAvailableMessage);
}
