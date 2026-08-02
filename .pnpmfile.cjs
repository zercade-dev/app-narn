// TypeScript 7 (the native Go compiler) ships no programmatic API until TS 7.1, so the
// @typescript-eslint toolchain must keep resolving the TypeScript 6.0 API side-by-side
// (Microsoft's documented migration pattern). pnpm overrides cannot retarget a peer
// dependency, so this hook turns the `typescript` peer of @typescript-eslint/* into a
// real pinned dependency: those packages link their own private TS 6 copy while the
// workspace builds with TS 7. Lint here is not type-aware (no projectService), so the
// parser-only TS 6 API has no effect on lint results.
// Drop this file once typescript-eslint supports TS 7 (peer range currently <6.1.0).
const TS_FOR_ESLINT_TOOLCHAIN = '6.0.3';

function readPackage(pkg) {
  if (
    pkg.name &&
    pkg.name.startsWith('@typescript-eslint/') &&
    pkg.peerDependencies &&
    pkg.peerDependencies.typescript
  ) {
    delete pkg.peerDependencies.typescript;
    if (pkg.peerDependenciesMeta) {
      delete pkg.peerDependenciesMeta.typescript;
    }
    pkg.dependencies = { ...pkg.dependencies, typescript: TS_FOR_ESLINT_TOOLCHAIN };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
