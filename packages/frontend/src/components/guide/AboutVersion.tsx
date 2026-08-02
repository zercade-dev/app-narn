import { APP_VERSION } from '../../version.js';

/**
 * Footer shown on the "About Narn" page (sidebar Page group) — shows the
 * running NARN build version (from the workspace-root package.json, injected at
 * build time). Bumped once per release.
 */
export function AboutVersion() {
  return (
    <p className="px-1 text-xs text-muted-foreground" data-testid="about-version">
      NARN v{APP_VERSION}
    </p>
  );
}
