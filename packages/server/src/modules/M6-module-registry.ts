/**
 * M6 — ModuleRegistry
 *
 * Holds the translation modules registered at startup from the static index
 * (`module-index.ts` via `loadStatic()`). There is deliberately no dynamic /
 * filesystem discovery of third-party modules: every module is first-party
 * code compiled into the workspace, which keeps the single-user server free
 * of a plugin attack surface. The `sandboxed` manifest field is inert
 * metadata retained for manifest.json compatibility.
 */

import type {
  CredentialProvider,
  GlobalConfig,
  ModuleInstance,
  ModuleManifest,
  TranslationModule,
  ModuleCapability,
  CostTier,
  ProviderType,
} from '@zercade-dev/narn-shared';
import {
  deriveInstanceCredentialKey,
  parseModuleInstanceId,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  coerceBoolean,
  validateBaseURL,
} from '@zercade-dev/narn-shared';
import { resolveEffectiveModuleConfig } from './M19-global-config-store.js';
import { credentialStore } from './M16-credential-store.js';
import { logger } from './M15-console-logger.js';
import { copilotClientPool } from './copilot-client-pool.js';
import { COPILOT_MODULE_ID, normalizeCopilotConfig } from '../utils/copilot-config.js';
import { getGlobalConfigStore } from '../storage/registry.js';
import { getCurrentTenant } from '../storage/pg/tenant-context.js';

/**
 * Tenant whose instance keyspace we read/write when no ambient tenant is set.
 * Mirrors the rest of the storage layer: the single-user local app (and the
 * unit-test harness) runs as the `'local'` tenant, so an un-scoped call lands
 * in that tenant's keyspace rather than a shared global one.
 */
const LOCAL_TENANT = 'local';

/**
 * The generic-ai module id. Handled outside {@link CHAT_PROVIDER_BY_MODULE} by
 * {@link ModuleRegistry.resolveChatTarget} since its provider/baseURL are
 * config-driven, not fixed.
 */
const GENERIC_AI_MODULE_ID = 'generic-ai';

/**
 * Default `log` sink handed to copilot module instances. Routes copilot's
 * structured log lines through the M15 logger (which applies M16's
 * `sanitizeLogObject` redaction), instead of copilot's bare `console.*`
 * fallback that would bypass it.
 */
const copilotLog = (
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>,
): void => logger.log(level, message, metadata);

export interface LoadedModule {
  manifest: ModuleManifest;
  instance: TranslationModule;
  /** Factory stored so the module can be re-created with per-project config overrides. */
  factory: (config: unknown) => TranslationModule;
}

/**
 * Base module ids that can back a raw (non-translation) chat completion, mapped
 * to the AI-SDK provider used by {@link createModelForProvider}. Anything not in
 * this map and not {@link GENERIC_AI_MODULE_ID} — the classical MT / QA /
 * SDK-bound modules (deepl, pseudo, copilot) and unknown ids — is unsupported
 * for chat and rejected by {@link ModuleRegistry.resolveChatTarget}.
 *
 * generic-ai is deliberately NOT in this static map: unlike the fixed cloud
 * providers, its provider/baseURL depend on runtime config (`format`,
 * `baseURL`), so {@link ModuleRegistry.resolveChatTarget} resolves it via a
 * dedicated branch instead of a table lookup.
 */
const CHAT_PROVIDER_BY_MODULE: Record<string, ProviderType> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'google',
  deepseek: 'deepseek',
  openrouter: 'openrouter',
  groq: 'groq',
};

/**
 * Thrown by {@link ModuleRegistry.resolveChatTarget} when the given id is
 * unknown, resolves to no base module, or maps to a module that cannot back a
 * raw chat call (deepl, pseudo, copilot). Carries HTTP 400.
 */
export class UnsupportedChatModuleError extends Error {
  readonly statusCode = 400;
  constructor(id: string) {
    super(`Module "${id}" does not support chat`);
    this.name = 'UnsupportedChatModuleError';
  }
}

/**
 * Tri-state credential availability: `vault-locked` means a vault file exists
 * but the session has not unlocked it (the keys may well be inside);
 * `missing` means the vault is unlocked (or absent) and keys are genuinely
 * not set.
 */
export type CredentialStatus = 'ok' | 'vault-locked' | 'missing';

export interface ModuleMetadata {
  id: string;
  name: string;
  version: string;
  capabilities: ModuleCapability[];
  costTier: CostTier;
  configSchema: Record<string, unknown>;
  requiredEnvVars: string[];
  /** True when the module instance implements `judgeTranslations` (AI review). */
  supportsJudge: boolean;
  /** True when the module instance implements `retryWithFeedback` (AI-capable: reads context; every LLM module). */
  supportsAiRetranslate: boolean;
  /** Kept for compatibility; equivalent to `credentialStatus === 'ok'`. */
  credentialsAvailable: boolean;
  credentialStatus: CredentialStatus;
  /** The keys actually missing. Populated only when `credentialStatus === 'missing'`. */
  missingKeys: string[];
  /** Set for named module instances: the id of the base module they copy. */
  baseModuleId?: string;
  /**
   * Whether named instances may be created for this module. Mirrors the
   * manifest's `instanceable` (absent ⇒ true). Always `false` for instance
   * entries (instances of instances are not allowed).
   */
  instanceable: boolean;
  /**
   * Global-config availability gate for this id (base module or instance):
   * `resolveEffectiveModuleConfig(id, global, undefined).enabled`. Defaults
   * `false` when the global config is not supplied to the metadata builder.
   */
  enabled: boolean;
  /**
   * Global-config on/off toggle for this id:
   * `resolveEffectiveModuleConfig(id, global, undefined).active`. Defaults
   * `true` when the global config is not supplied to the metadata builder.
   */
  active: boolean;
}

export interface StaticModuleEntry {
  manifest: ModuleManifest;
  factory: (config: unknown) => TranslationModule;
}

export class ModuleRegistry {
  private readonly modules = new Map<string, LoadedModule>();
  /**
   * Named instances, namespaced by tenant: tenant userId → (`<base>:<slug>` →
   * registry entry). In cloud mode the registry is populated per-tenant (each
   * authenticated user's lazy provisioning registers its own instances), so an
   * un-namespaced map would let two tenants that pick the same slug (e.g.
   * `generic-ai:lab`) collide/overwrite in one process-global map. Keying by
   * tenant gives each an isolated keyspace, so registration and lookup never
   * cross tenants. Base modules stay process-global (statically loaded at boot).
   */
  private readonly instancesByTenant = new Map<string, Map<string, ModuleInstance>>();

  /** The current tenant's instance map (lazily created), keyed by instanceId. */
  private tenantInstances(): Map<string, ModuleInstance> {
    const tenant = getCurrentTenant()?.userId ?? LOCAL_TENANT;
    let map = this.instancesByTenant.get(tenant);
    if (!map) {
      map = new Map<string, ModuleInstance>();
      this.instancesByTenant.set(tenant, map);
    }
    return map;
  }

  /**
   * Register modules from static imports. All modules are statically known at
   * compile time; this is the only way modules enter the registry.
   */
  loadStatic(entries: StaticModuleEntry[]): void {
    for (const { manifest, factory } of entries) {
      const factoryConfig: Record<string, unknown> = {
        credentials: this.buildCredentialProvider(undefined),
      };
      // Copilot's default `log` is bare `console.*`, which bypasses M16's
      // `sanitizeLogObject` redaction. Inject the M15 logger as its log sink so
      // the base instance's output is scrubbed like every other module's.
      if (manifest.id === COPILOT_MODULE_ID) factoryConfig.log = copilotLog;
      const instance = factory(factoryConfig);
      const loaded: LoadedModule = { manifest, instance, factory };
      this.modules.set(manifest.id, loaded);
      logger.info('module:loaded', { moduleId: manifest.id });
    }
  }

  /**
   * Register a named instance of an already-loaded base module. Instance ids
   * resolve through `getModule`/`createWithConfig`/`getMetadata` to the base
   * module's factory, with credentials remapped to per-instance vault keys.
   * Throws when the base module is not loaded.
   */
  registerInstance(instance: ModuleInstance): void {
    if (!this.modules.has(instance.baseModuleId)) {
      throw new Error(
        `Cannot register instance ${instance.instanceId}: base module ${instance.baseModuleId} is not loaded`,
      );
    }
    this.tenantInstances().set(instance.instanceId, instance);
    logger.info('module:instance-registered', {
      instanceId: instance.instanceId,
      baseModuleId: instance.baseModuleId,
    });
  }

  /** Remove a named instance. Unknown ids are a no-op. */
  unregisterInstance(instanceId: string): void {
    if (this.tenantInstances().delete(instanceId)) {
      logger.info('module:instance-unregistered', { instanceId });
    }
  }

  /** Update the display name of a registered instance (no-op when unknown). */
  renameInstance(instanceId: string, displayName: string): void {
    const tenantInstances = this.tenantInstances();
    const existing = tenantInstances.get(instanceId);
    if (existing) tenantInstances.set(instanceId, { ...existing, displayName });
  }

  listInstances(): ModuleInstance[] {
    return Array.from(this.tenantInstances().values());
  }

  /**
   * Every id this registry can resolve: the loaded base modules plus the
   * current tenant's instances — exactly the two maps {@link resolve} consults,
   * so `listModuleIds().includes(id)` iff `getModule(id)` is defined.
   *
   * Distinct from {@link listModules}, which builds full metadata (credential
   * state and all) for each entry. Callers that only need to know whether an id
   * is real — notably anything about to put one in a file path — should use
   * this and take the string from the returned list rather than reusing their
   * own untrusted input.
   */
  listModuleIds(): string[] {
    return [...this.modules.keys(), ...this.tenantInstances().keys()];
  }

  /**
   * Resolve a module or instance id to its loaded base module. For instance
   * ids the returned `instance` field carries the registry entry.
   */
  private resolve(id: string): { loaded: LoadedModule; instance?: ModuleInstance } | undefined {
    const direct = this.modules.get(id);
    if (direct) return { loaded: direct };
    const instance = this.tenantInstances().get(id);
    if (!instance) return undefined;
    const base = this.modules.get(instance.baseModuleId);
    if (!base) return undefined;
    return { loaded: base, instance };
  }

  /**
   * Vault keys backing an id's `requiredEnvVars`: the manifest's declared
   * vars for base modules, per-instance derived keys (e.g.
   * `GENERIC_API_KEY__MY-OLLAMA`) for instances.
   */
  private credentialKeysFor(manifest: ModuleManifest, instance?: ModuleInstance): string[] {
    const baseVars = manifest.requiredEnvVars ?? [];
    if (!instance) return baseVars;
    const slug =
      parseModuleInstanceId(instance.instanceId)?.slug ??
      instance.instanceId.slice(instance.baseModuleId.length + 1);
    return baseVars.map((v) => deriveInstanceCredentialKey(v, slug));
  }

  /**
   * Build the `CredentialProvider` adapter handed to module factories. The
   * provider is bound to a specific browser session id so credentials resolve
   * through the unlocked vault, never `process.env`.
   *
   * For named instances, `keyMap` maps each base-module var (e.g.
   * `GENERIC_API_KEY`) to its per-instance derived key (e.g.
   * `GENERIC_API_KEY__MY-OLLAMA`). Instances SHARE the base module's
   * credentials by default: a lookup first tries the derived per-instance key
   * and falls back to the base key when the derived key is not present in the
   * vault. The throw-on-truly-missing behaviour of `credentialStore.get` is
   * preserved — the fallback only resolves the base key, which itself throws
   * `MissingCredentialError` if it too is absent.
   */
  private buildCredentialProvider(
    sessionId: string | undefined,
    keyMap?: Map<string, string>,
  ): CredentialProvider {
    return {
      get: (key: string) => {
        const derived = keyMap?.get(key);
        if (derived !== undefined) {
          const perInstance = credentialStore.getOptional(derived, sessionId);
          if (perInstance !== undefined) return perInstance;
          // No per-instance override — inherit the base module's credential.
          return credentialStore.get(key, sessionId);
        }
        return credentialStore.get(key, sessionId);
      },
    };
  }

  /**
   * Create a fresh module instance with the given extra config merged on top
   * of the standard credentials config.  Used to honour per-project config
   * values (e.g. `free`) that are not available at module-load time.
   * Returns `undefined` if the module is not loaded.
   */
  createWithConfig(
    id: string,
    extraConfig: Record<string, unknown>,
    sessionId: string | undefined,
  ): TranslationModule | undefined {
    const resolved = this.resolve(id);
    if (!resolved) return undefined;
    const { loaded, instance } = resolved;
    const baseId = loaded.manifest.id;
    const config = baseId === COPILOT_MODULE_ID ? normalizeCopilotConfig(extraConfig) : extraConfig;

    const factoryConfig =
      baseId === COPILOT_MODULE_ID
        ? {
            ...config,
            // Default copilot's log to the redacting M15 logger (see loadStatic).
            // A caller-supplied function `log` (e.g. M9's run-scoped log sink)
            // still wins; resolved explicitly rather than by spread order so a
            // non-function `log` from open-schema persisted config can't clobber
            // the default with a non-callable value.
            log: typeof config.log === 'function' ? config.log : copilotLog,
            clientFactory: copilotClientPool.acquire.bind(copilotClientPool),
            releaseClient: copilotClientPool.release.bind(copilotClientPool),
          }
        : config;
    let keyMap: Map<string, string> | undefined;
    if (instance) {
      const baseVars = loaded.manifest.requiredEnvVars ?? [];
      const derived = this.credentialKeysFor(loaded.manifest, instance);
      keyMap = new Map(baseVars.map((v, i) => [v, derived[i]]));
    }
    const requestTimeoutMs =
      getGlobalConfigStore().cachedSettings()?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const maxOutputTokens =
      getGlobalConfigStore().cachedSettings()?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    return loaded.factory({
      ...factoryConfig,
      requestTimeoutMs,
      maxOutputTokens,
      credentials: this.buildCredentialProvider(sessionId, keyMap),
    });
  }

  /**
   * Resolves named instance ids too: `getModule('generic-ai:lab')` returns
   * the base module's default instance (used e.g. by M9's batch-capability
   * check); unregistered instance ids return undefined like any unknown id.
   */
  getModule(id: string): TranslationModule | undefined {
    return this.resolve(id)?.loaded.instance;
  }

  /**
   * Resolves the tri-state credential status for a key set. `vaultFileExists`
   * is supplied by the caller (the vault file check is async filesystem I/O
   * owned by the routes layer); when false, a locked session with missing
   * keys reports `missing`.
   *
   * `fallbackFor` maps a key to a fallback key that satisfies it when the
   * primary key is absent. This mirrors the instance→base credential
   * inheritance in `buildCredentialProvider`: a per-instance derived key is
   * considered present when either it or its base key is set, so a migrated
   * instance that shares the base credential reports `ok`, not `missing`.
   */
  private credentialState(
    keys: string[],
    sessionId: string | undefined,
    vaultFileExists: boolean,
    fallbackFor?: Map<string, string>,
  ): Pick<ModuleMetadata, 'credentialsAvailable' | 'credentialStatus' | 'missingKeys'> {
    const isPresent = (key: string): boolean => {
      if (credentialStore.getOptional(key, sessionId) !== undefined) return true;
      const fallback = fallbackFor?.get(key);
      return (
        fallback !== undefined && credentialStore.getOptional(fallback, sessionId) !== undefined
      );
    };
    if (keys.length === 0 || keys.every(isPresent)) {
      return { credentialsAvailable: true, credentialStatus: 'ok', missingKeys: [] };
    }
    if (vaultFileExists && !credentialStore.isUnlocked(sessionId)) {
      return { credentialsAvailable: false, credentialStatus: 'vault-locked', missingKeys: [] };
    }
    return {
      credentialsAvailable: false,
      credentialStatus: 'missing',
      missingKeys: keys.filter((k) => !isPresent(k)),
    };
  }

  /**
   * Build the {@link ModuleMetadata} for one resolved entry — a base module
   * (`instance` undefined) or one of its named instances. Shared by
   * {@link listModules} (mapped over every entry) and {@link getMetadata}
   * (called once for the single resolved id, so per-id cost stays O(1)).
   */
  private metadataFor(
    loaded: LoadedModule,
    instance: ModuleInstance | undefined,
    sessionId: string | undefined,
    vaultFileExists: boolean,
    global?: GlobalConfig,
  ): ModuleMetadata {
    const { manifest } = loaded;
    // Global-config enable/active state for this id. Passing `undefined` for the
    // project entry yields the pure global gate ("is this instance enabled/active
    // in global config"). When no global config is supplied, fall back to the
    // resolver's own defaults (enabled=false, active=true) without a lookup.
    const entryId = instance ? instance.instanceId : manifest.id;
    const { enabled, active } = global
      ? resolveEffectiveModuleConfig(entryId, global, undefined)
      : { enabled: false, active: true };
    if (!instance) {
      return {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        capabilities: manifest.capabilities,
        costTier: manifest.costTier,
        configSchema: manifest.configSchema,
        requiredEnvVars: manifest.requiredEnvVars ?? [],
        supportsJudge: typeof loaded.instance.judgeTranslations === 'function',
        supportsAiRetranslate: typeof loaded.instance.retryWithFeedback === 'function',
        instanceable: manifest.instanceable !== false,
        enabled,
        active,
        ...this.credentialState(manifest.requiredEnvVars ?? [], sessionId, vaultFileExists),
      };
    }
    const baseVars = manifest.requiredEnvVars ?? [];
    const keys = this.credentialKeysFor(manifest, instance);
    // Derived per-instance key → base var fallback (instances inherit the
    // base credential when their own derived key is unset).
    const fallbackFor = new Map(keys.map((k, i) => [k, baseVars[i]!]));
    return {
      id: instance.instanceId,
      name: instance.displayName,
      version: manifest.version,
      capabilities: manifest.capabilities,
      costTier: manifest.costTier,
      configSchema: manifest.configSchema,
      requiredEnvVars: keys,
      supportsJudge: typeof loaded.instance.judgeTranslations === 'function',
      supportsAiRetranslate: typeof loaded.instance.retryWithFeedback === 'function',
      // Instances of instances are not allowed.
      instanceable: false,
      enabled,
      active,
      ...this.credentialState(keys, sessionId, vaultFileExists, fallbackFor),
      baseModuleId: instance.baseModuleId,
    };
  }

  listModules(
    sessionId?: string,
    vaultFileExists = false,
    global?: GlobalConfig,
  ): ModuleMetadata[] {
    const base = Array.from(this.modules.values()).map((loaded) =>
      this.metadataFor(loaded, undefined, sessionId, vaultFileExists, global),
    );
    const instances: ModuleMetadata[] = [];
    for (const instance of this.tenantInstances().values()) {
      const loaded = this.modules.get(instance.baseModuleId);
      if (!loaded) continue;
      instances.push(this.metadataFor(loaded, instance, sessionId, vaultFileExists, global));
    }
    return [...base, ...instances];
  }

  getMetadata(
    id: string,
    sessionId?: string,
    vaultFileExists = false,
    global?: GlobalConfig,
  ): ModuleMetadata | undefined {
    const resolved = this.resolve(id);
    if (!resolved) return undefined;
    return this.metadataFor(resolved.loaded, resolved.instance, sessionId, vaultFileExists, global);
  }

  /**
   * Resolve a module/instance id + session to the (provider, apiKey, baseURL) a
   * raw chat call needs. Reuses the existing `resolve`/`credentialKeysFor`
   * internals so per-instance vault-key derivation (and the instance→base
   * credential inheritance) stays a single source of truth. Throws
   * {@link UnsupportedChatModuleError} when the id is unknown or maps to a
   * non-chat provider (deepl/pseudo/copilot); propagates `VaultLockedError` /
   * `MissingCredentialError` from the credential lookup, and a `validateBaseURL`
   * error for an unsafe generic-ai endpoint.
   *
   * `baseURL` stays unset for the fixed cloud providers (they don't use one).
   * For generic-ai it comes from the (async) global/per-project config, so this
   * method is async solely for that branch — `getGlobalConfigStore().load()` is
   * a cache hit after the first call, so the extra await costs the fixed
   * providers nothing meaningful. Mirrors M5's `CATEGORY_CAPABLE_MODULES`
   * simplification: generic-ai always resolves to `openai-compatible` here,
   * ignoring the `format: 'anthropic'` config option (not wired for chat, same
   * as category-gen).
   */
  async resolveChatTarget(
    id: string,
    sessionId: string | undefined,
  ): Promise<{ provider: ProviderType; apiKey: string; baseURL?: string }> {
    const resolved = this.resolve(id);
    if (!resolved) throw new UnsupportedChatModuleError(id);
    const { loaded, instance } = resolved;
    const baseModuleId = instance?.baseModuleId ?? loaded.manifest.id;

    let provider = CHAT_PROVIDER_BY_MODULE[baseModuleId];
    let baseURL: string | undefined;
    if (baseModuleId === GENERIC_AI_MODULE_ID) {
      const global = await getGlobalConfigStore().load();
      const cfg = resolveEffectiveModuleConfig(id, global, undefined).config as {
        baseURL?: unknown;
        allowInsecureHttp?: unknown;
      };
      baseURL = typeof cfg.baseURL === 'string' ? cfg.baseURL : undefined;
      // Same SSRF gate every other AI flow applies to a custom baseURL (see
      // M5's suggestCategories / the translate path) — a raw chat call must not
      // get a free pass to an unvalidated endpoint.
      validateBaseURL(baseURL, coerceBoolean(cfg.allowInsecureHttp));
      provider = 'openai-compatible';
    }
    if (!provider) throw new UnsupportedChatModuleError(id);

    const baseVars = loaded.manifest.requiredEnvVars ?? [];
    const primaryVar = baseVars[0];
    if (!primaryVar) throw new UnsupportedChatModuleError(id);

    let keyMap: Map<string, string> | undefined;
    if (instance) {
      const derived = this.credentialKeysFor(loaded.manifest, instance);
      keyMap = new Map(baseVars.map((v, i) => [v, derived[i]!]));
    }
    // A local generic-ai endpoint (Ollama/LM Studio) commonly needs no key —
    // mirrors M5-content-classifier's identical openai-compatible leniency —
    // so a missing GENERIC_API_KEY is not fatal; every other provider still
    // propagates the credential error.
    let apiKey = '';
    try {
      apiKey = this.buildCredentialProvider(sessionId, keyMap).get(primaryVar);
    } catch (err) {
      if (provider !== 'openai-compatible') throw err;
    }

    return { provider, apiKey, ...(baseURL ? { baseURL } : {}) };
  }

  async destroyAll(): Promise<void> {
    for (const { instance } of this.modules.values()) {
      try {
        await instance.destroy?.();
      } catch {
        // best-effort cleanup
      }
    }
    this.modules.clear();
    this.instancesByTenant.clear();
  }

  /**
   * Destroy and remove a single loaded module, calling the module's optional
   * `destroy()` hook. For named instance ids this only unregisters the
   * instance (the shared base module instance stays alive).
   */
  async destroyModule(id: string): Promise<void> {
    if (this.tenantInstances().has(id)) {
      this.unregisterInstance(id);
      return;
    }
    const loaded = this.modules.get(id);
    if (loaded) {
      try {
        await loaded.instance.destroy?.();
      } catch {
        // best-effort cleanup
      }
      this.modules.delete(id);
    }
  }
}

export const moduleRegistry = new ModuleRegistry();
