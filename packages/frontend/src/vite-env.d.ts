/// <reference types="vite/client" />

// Injected by Vite `define` (vite.config.ts) from the workspace-root
// package.json's version. Typed as possibly-undefined because vitest does not
// apply the frontend `define`, so `version.ts` reads it through a typeof guard
// with a dev fallback.
declare const __APP_VERSION__: string | undefined;
