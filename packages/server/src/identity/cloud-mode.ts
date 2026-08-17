/**
 * Cycle-free read seam for "is this process running in cloud mode?".
 *
 * The answer is derived in `registry.ts` from which identity/vault adapters are
 * installed, and every caller OUTSIDE the identity chain should keep importing
 * `isCloudMode` from there (this module is re-exported by it, so both names
 * resolve to the same function).
 *
 * Callers INSIDE that chain must come through this module instead. `registry.ts`
 * eagerly constructs the local adapters, and `local-vault-store.ts` →
 * `utils/vault-file.ts` → `utils/fs.ts` → `M15-console-logger.ts`; so a direct
 * `registry.js` import from M15 closes the cycle
 * `M15 → registry → local-vault-store → vault-file → fs → M15`. A cycle in that
 * position is not merely inelegant: under Vitest's module runner the circular
 * re-entry resolves to the REAL module even when a suite has registered a
 * `vi.mock` for it, so any suite that transitively loads M15 silently loses its
 * mocks (it cost four unrelated tests in `fs-utils.coverage` and
 * `identity-vault-store`).
 *
 * So `registry.ts` registers its implementation here at load time, and this
 * module imports nothing. "Not registered" means no module capable of switching
 * cloud mode on has been loaded at all — cloud mode is only ever entered via
 * `registry.ts`'s own setters — so `false` is the correct answer then, not a
 * missing one.
 */
let resolveCloudMode: (() => boolean) | undefined;

/**
 * Installs the real implementation. Called by `registry.ts` at module load;
 * nothing else should call it.
 */
export function setCloudModeResolver(resolver: () => boolean): void {
  resolveCloudMode = resolver;
}

/**
 * True when a cloud composition root has installed a non-local identity
 * provider or vault store. Resolved through the registered function on EVERY
 * call, never cached: callers such as M15's `logger` are constructed at module
 * load, long before a composition root has decided the answer.
 */
export function isCloudMode(): boolean {
  return resolveCloudMode?.() ?? false;
}
