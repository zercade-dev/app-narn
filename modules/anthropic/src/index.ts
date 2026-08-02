import {
  createProviderModule,
  type TranslationModule,
  type ModuleFactoryConfig,
  type ModuleManifest,
} from '@zercade-dev/narn-shared';
import manifest from '../manifest.json' with { type: 'json' };

export const createAnthropicModule = (config: ModuleFactoryConfig = {}): TranslationModule =>
  createProviderModule('anthropic', manifest as ModuleManifest, config);

// Re-export the manifest so the server's module-index can import it via the package
// specifier (`@zercade-dev/narn-module-anthropic`). The relative `../manifest.json` resolves
// from both src/index.ts and the flat dist/index.js to modules/anthropic/manifest.json.
export { manifest };

export default createAnthropicModule;
