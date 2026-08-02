/**
 * The running NARN app version, injected at build time from the workspace-root
 * package.json via Vite `define` (see vite.config.ts). Read through a `typeof`
 * guard so it is safe under vitest, which does not apply the frontend `define` —
 * there it falls back to a dev placeholder. Surfaced in the Guide tab's About line.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';
