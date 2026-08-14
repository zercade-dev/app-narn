/**
 * Static module index.
 *
 * Importing this file causes tsx watch to track all module source files,
 * so the dev server restarts automatically when any module changes.
 */
import type { ModuleManifest, TranslationModule } from '@zercade-dev/narn-shared';
// Manifests are the single source of truth in each module's manifest.json. Each module
// re-exports its own manifest (`export { manifest }`) from its package entry, so we import
// both the factory (default) and the manifest (named) through the package specifier here.
// A direct relative path to `../../../../modules/<id>/manifest.json` cannot be used: it
// resolves correctly for source execution (tsx/vitest run `src/modules/`) but NOT for the
// built server, whose `dist/src/modules/module-index.js` is one level deeper, so the same
// path points at the nonexistent `packages/modules/...` → ERR_MODULE_NOT_FOUND. The
// package re-export resolves to `modules/<id>/manifest.json` from both contexts because
// each module builds flat (`main: ./dist/index.js`), so its own `../manifest.json` is
// stable whether evaluated from `src/index.ts` or `dist/index.js`.
import createAnthropicModule, {
  manifest as anthropicManifest,
} from '@zercade-dev/narn-module-anthropic';
import createCopilotModule, { manifest as copilotManifest } from '@zercade-dev/narn-module-copilot';
import createDeepLModule, { manifest as deeplManifest } from '@zercade-dev/narn-module-deepl';
import createDeepSeekModule, {
  manifest as deepseekManifest,
} from '@zercade-dev/narn-module-deepseek';
import createGenericAIModule, {
  manifest as genericAiManifest,
} from '@zercade-dev/narn-module-generic-ai';
import createGoogleModule, { manifest as googleManifest } from '@zercade-dev/narn-module-google';
import createGroqModule, { manifest as groqManifest } from '@zercade-dev/narn-module-groq';
import createOpenAIModule, { manifest as openaiManifest } from '@zercade-dev/narn-module-openai';
import createOpenRouterModule, {
  manifest as openrouterManifest,
} from '@zercade-dev/narn-module-openrouter';
import createPseudoModule, { manifest as pseudoManifest } from '@zercade-dev/narn-module-pseudo';
import type { StaticModuleEntry } from './M6-module-registry.js';

// The re-exported manifest infers a wide structural type (e.g. `capabilities: string[]`,
// `costTier: string`), so the union-literal fields are not assignable to ModuleManifest
// via `satisfies` — an `as` assertion is required. Each manifest is the canonical
// manifest.json from its module, so the cast is sound.
export const STATIC_MODULES: StaticModuleEntry[] = [
  {
    manifest: anthropicManifest as ModuleManifest,
    factory: createAnthropicModule as (config: unknown) => TranslationModule,
  },
  {
    manifest: copilotManifest as ModuleManifest,
    factory: createCopilotModule as (config: unknown) => TranslationModule,
  },
  {
    manifest: deeplManifest as ModuleManifest,
    factory: createDeepLModule as (config: unknown) => TranslationModule,
  },
  {
    manifest: deepseekManifest as ModuleManifest,
    factory: createDeepSeekModule as (config: unknown) => TranslationModule,
  },
  {
    manifest: genericAiManifest as ModuleManifest,
    factory: createGenericAIModule as (config: unknown) => TranslationModule,
  },
  {
    manifest: googleManifest as ModuleManifest,
    factory: createGoogleModule as (config: unknown) => TranslationModule,
  },
  {
    manifest: groqManifest as ModuleManifest,
    factory: createGroqModule as (config: unknown) => TranslationModule,
  },
  {
    manifest: openaiManifest as ModuleManifest,
    factory: createOpenAIModule as (config: unknown) => TranslationModule,
  },
  {
    manifest: openrouterManifest as ModuleManifest,
    factory: createOpenRouterModule as (config: unknown) => TranslationModule,
  },
  {
    manifest: pseudoManifest as ModuleManifest,
    factory: createPseudoModule as (config: unknown) => TranslationModule,
  },
];
