/**
 * M19 - Global config zod schemas (validation only, no I/O).
 *
 * Extracted from `M19-global-config-store.ts` so both the file-backed
 * {@link GlobalConfigStore} and the Postgres `PgGlobalConfigStore` adapter can
 * share the EXACT same validation + unknown-key strip behavior.
 *
 * Why a separate module: the adapter must reuse these schemas, but importing
 * them from `M19-global-config-store.ts` would transitively pull `utils/fs.ts`
 * (and thus the M15 logger) into the storage registry's eager import graph. The
 * server test setup imports that registry before any test runs, which would
 * evaluate `fs.ts` ahead of a test's `vi.mock('…/M15-console-logger.js')` and
 * break suites that assert on the mocked logger (e.g. `fs-utils.coverage`). This
 * schema-only module imports nothing from `fs.ts`, so the adapter can reuse the
 * validation without dragging I/O into that graph. `M19-global-config-store.ts`
 * re-exports these so its public surface is unchanged.
 */
import { z } from 'zod';

export const moduleConfigEntrySchema = z.object({
  enabled: z.boolean().optional(),
  active: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()),
});

export const workspaceSettingsSchema = z.object({
  maxBackupsPerProject: z.number().int().min(1).optional(),
  overflowRatio: z.number().positive().optional(),
  // Global client-side rate limit for network-bound modules. 0 = disabled.
  requestsPerSecond: z.number().min(0).optional(),
  requestTimeoutMs: z.number().int().min(1000).optional(),
  // 0 = unlimited (omit the per-request cap; see core.ts DEFAULT_MAX_OUTPUT_TOKENS).
  maxOutputTokens: z.number().int().min(0).max(200000).optional(),
  batchGrouping: z.enum(['none', 'category', 'glossary', 'both']).optional(),
  ignoreBatchSizeLimit: z.boolean().optional(),
});

export const moduleInstanceSchema = z.object({
  instanceId: z.string(),
  baseModuleId: z.string(),
  displayName: z.string(),
});

export const globalConfigSchema = z.object({
  schemaVersion: z.number().int().optional(),
  moduleConfigs: z.record(z.string(), moduleConfigEntrySchema),
  moduleInstances: z.array(moduleInstanceSchema).optional(),
  settings: workspaceSettingsSchema.optional(),
});
