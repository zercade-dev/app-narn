import {
  createProviderModule,
  type TranslationModule,
  type ModuleFactoryConfig,
  type ModuleManifest,
} from '@zercade-dev/narn-shared';
import manifest from '../manifest.json' with { type: 'json' };

export const createGoogleModule = (config: ModuleFactoryConfig = {}): TranslationModule =>
  createProviderModule('google', manifest as ModuleManifest, config);

// Re-export the manifest so the server's module-index can import it via the package
// specifier (`@zercade-dev/narn-module-google`). The relative `../manifest.json` resolves
// from both src/index.ts and the flat dist/index.js to modules/google/manifest.json.
export { manifest };

export default createGoogleModule;
