import { useEffect } from 'react';
import { useUiSettings, type UiMode } from '../stores/ui-settings-store.js';
import { useGuideStore } from '../stores/guide-store.js';
import { useProjectStore } from '../stores/project-store.js';

export type { UiMode };

/**
 * The effective interface mode. A stored choice always wins. While none is
 * stored it reads as `advanced` until the project list has loaded, then the
 * first-run default is stored: `simple` for an empty list, `advanced` otherwise
 * (own or shared projects alike). Once stored it is never re-derived.
 *
 * A person who starts in `advanced` this way already has work in the app, so
 * the guided first run is set aside for them at the same moment: if they try
 * Simple later they get the quiet "Continue setup" item, not an overlay asking
 * them to redo it. A newcomer (`simple`) keeps the guide.
 */
export function useUiMode(): UiMode {
  const uiMode = useUiSettings((s) => s.uiMode);
  const setUiMode = useUiSettings((s) => s.setUiMode);
  const loaded = useProjectStore((s) => s.loaded);
  const projectCount = useProjectStore((s) => s.projects.length);

  useEffect(() => {
    if (uiMode !== null || !loaded) return;
    if (projectCount === 0) {
      setUiMode('simple');
      return;
    }
    useGuideStore.getState().dismissFirstRun();
    setUiMode('advanced');
  }, [uiMode, loaded, projectCount, setUiMode]);

  return uiMode ?? 'advanced';
}
