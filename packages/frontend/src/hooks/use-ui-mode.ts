import { useEffect } from 'react';
import { useUiSettings, type UiMode } from '../stores/ui-settings-store.js';
import { useProjectStore } from '../stores/project-store.js';

export type { UiMode };

/**
 * The effective interface mode. A stored choice always wins. While none is
 * stored it reads as `advanced` until the project list has loaded, then the
 * first-run default is stored: `simple` for an empty list, `advanced` otherwise
 * (own or shared projects alike). Once stored it is never re-derived.
 */
export function useUiMode(): UiMode {
  const uiMode = useUiSettings((s) => s.uiMode);
  const setUiMode = useUiSettings((s) => s.setUiMode);
  const loaded = useProjectStore((s) => s.loaded);
  const projectCount = useProjectStore((s) => s.projects.length);

  useEffect(() => {
    if (uiMode === null && loaded) setUiMode(projectCount === 0 ? 'simple' : 'advanced');
  }, [uiMode, loaded, projectCount, setUiMode]);

  return uiMode ?? 'advanced';
}
