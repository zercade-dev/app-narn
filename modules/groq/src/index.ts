import {
  createProviderModule,
  type TranslationModule,
  type ModuleFactoryConfig,
  type ModuleManifest,
} from '@zercade-dev/narn-shared';
import manifest from '../manifest.json' with { type: 'json' };

export const createGroqModule = (config: ModuleFactoryConfig = {}): TranslationModule =>
  createProviderModule('groq', manifest as ModuleManifest, config);

// Re-export the manifest so the server's module-index can import it via the package
// specifier (`@zercade-dev/narn-module-groq`). The relative `../manifest.json`
// resolves from both src/index.ts and the flat dist/index.js.
export { manifest };

export default createGroqModule;
