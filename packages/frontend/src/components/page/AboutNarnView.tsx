import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useUiSettings } from '../../stores/ui-settings-store.js';
import { getGuideContent } from '../guide/guides-registry.js';
import { renderMarkdown } from '../guide/markdown.js';
import { AboutVersion } from '../guide/AboutVersion.js';
import { Button } from '@/components/ui/button';

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
  // guides-registry.ts). The loaded result is tagged with the language it
  // answers; render-time "loading" is derived by comparing that against the
  // current language, rather than resetting state to null synchronously in
  // the effect body (which the react-hooks set-state-in-effect rule flags as
  // a cascading-render hazard). This also guards the async race a reader can
  // trigger by switching UI language while a load is in flight: the effect's
  // cleanup flips `ignore`, so a load that resolves (or rejects) after a
  // newer language was chosen writes nothing. An AbortController isn't a fit
  // here — dynamic `import()` has no abort signal to pass it.
  //
  // A rejection (e.g. a stale hashed chunk 404ing after a deploy, or a
  // network blip) lands in the 'error' status rather than being left
  // unhandled — an unhandled rejection would leave the spinner spinning
  // forever with no way out. `retryToken` gives the reader a way out: the
  // Retry button bumps it, which re-runs this effect for the same language.
  const [loaded, setLoaded] = useState<
    | { language: string; status: 'ready'; content: string }
    | { language: string; status: 'error' }
    | null
  >(null);
  const [retryToken, setRetryToken] = useState(0);
  useEffect(() => {
    let ignore = false;
    getGuideContent('about-narn', language).then(
      (md) => {
        if (!ignore) setLoaded({ language, status: 'ready', content: md });
      },
      (err) => {
        console.error('[about-narn] failed to load guide content', err);
        if (!ignore) setLoaded({ language, status: 'error' });
      },
    );
    return () => {
      ignore = true;
    };
  }, [language, retryToken]);

  const loadedForCurrent = loaded && loaded.language === language ? loaded : null;
  const hasLoadError = loadedForCurrent?.status === 'error';
  const content = loadedForCurrent?.status === 'ready' ? loadedForCurrent.content : null;

  return (
    <main className="flex-1 overflow-auto px-6 py-8" data-testid="about-narn-view">
      <div className="mx-auto max-w-[72ch] space-y-6">
        {hasLoadError ? (
          <div className="space-y-3 py-3" data-testid="about-narn-error">
            <p className="text-sm text-destructive">{t('account:errorGeneric')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="about-narn-retry"
              onClick={() => setRetryToken((n) => n + 1)}
            >
              {t('collab:routing.retry')}
            </Button>
          </div>
        ) : content === null ? (
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
