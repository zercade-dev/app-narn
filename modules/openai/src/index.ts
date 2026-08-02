import {
  createProviderModule,
  type TranslationModule,
  type ModuleFactoryConfig,
  type ModuleManifest,
} from '@zercade-dev/narn-shared';
import manifest from '../manifest.json' with { type: 'json' };

export const createOpenAIModule = (config: ModuleFactoryConfig = {}): TranslationModule =>
  createProviderModule('openai', manifest as ModuleManifest, config);

// Re-export the manifest so the server's module-index can import it via the package
// specifier (`@zercade-dev/narn-module-openai`). The relative `../manifest.json` resolves
// from both src/index.ts and the flat dist/index.js to modules/openai/manifest.json.
export { manifest };

export default createOpenAIModule;
