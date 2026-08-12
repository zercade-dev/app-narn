import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useUiSettings } from '../../stores/ui-settings-store.js';
import { getGuideContent } from '../guide/guides-registry.js';
import { renderMarkdown } from '../guide/markdown.js';
import { AboutVersion } from '../guide/AboutVersion.js';

/**
 * About Narn page (sidebar Page group). Was previously nested inside the
 * Guide sidebar as the "About" group's `about-narn` topic; pulled out into its
 * own top-level entry. Reuses the guide markdown-loading pattern for its
 * content and renders the running build version as a footer (moved out of
 * `GuideView`, which no longer shows it).
 */
export function AboutNarnView() {
  const { t } = useTranslation('common');
  const { language } = useUiSettings();

  // getGuideContent is async (code-split per slug/locale — see
  // guides-registry.ts). The loaded content is tagged with the language it
  // answers; render-time "loading" is derived by comparing that against the
  // current language, rather than resetting state to null synchronously in
  // the effect body (which the react-hooks set-state-in-effect rule flags as
  // a cascading-render hazard). This also guards the async race a reader can
  // trigger by switching UI language while a load is in flight: the effect's
  // cleanup flips `ignore`, so a load that resolves after a newer language
  // was chosen writes nothing. An AbortController isn't a fit here — dynamic
  // `import()` has no abort signal to pass it.
  const [loaded, setLoaded] = useState<{ language: string; content: string } | null>(null);
  useEffect(() => {
    let ignore = false;
    getGuideContent('about-narn', language).then((md) => {
      if (!ignore) setLoaded({ language, content: md });
    });
    return () => {
      ignore = true;
    };
  }, [language]);

  const content = loaded && loaded.language === language ? loaded.content : null;

  return (
    <main className="flex-1 overflow-auto px-6 py-8" data-testid="about-narn-view">
      <div className="mx-auto max-w-[72ch] space-y-6">
        {content === null ? (
          <div
            className="flex items-center gap-2 py-3 text-sm text-muted-foreground"
            data-testid="about-narn-loading"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('loading')}
          </div>
        ) : (
          renderMarkdown(content)
        )}
        <AboutVersion />
      </div>
    </main>
  );
}
