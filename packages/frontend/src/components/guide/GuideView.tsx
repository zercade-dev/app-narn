import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useUiSettings } from '../../stores/ui-settings-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { GUIDE_GROUPS, getGuideContent } from './guides-registry.js';
import { renderMarkdown } from './markdown.js';
import { stripLocalOnly } from './strip-local-only.js';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function GuideView() {
  const { t } = useTranslation('strings');
  const { language } = useUiSettings();
  const cloudManaged = useVaultStore((s) => s.cloudManaged ?? false);

  // In cloud mode, drop entirely-local topics and any group left empty.
  // Local/open-core mode renders GUIDE_GROUPS exactly as-is.
  const visibleGroups = useMemo(() => {
    if (!cloudManaged) return GUIDE_GROUPS;
    return GUIDE_GROUPS.map((group) => ({
      ...group,
      topics: group.topics.filter((topic) => !topic.localOnly),
    })).filter((group) => group.topics.length > 0);
  }, [cloudManaged]);

  const visibleSlugs = useMemo(
    () => new Set(visibleGroups.flatMap((group) => group.topics.map((topic) => topic.slug))),
    [visibleGroups],
  );
  const firstVisibleSlug = visibleGroups[0]?.topics[0]?.slug;

  // `openGuide(slug)` deep-links here from an in-context help affordance (e.g.
  // the Pseudo Test tooltip on the Data tab). AppShell unmounts this view when
  // `view !== 'guide'`, so the lazy initialiser is the live path — it opens ON
  // the requested topic instead of rendering topic #1 for a frame first.
  const pendingGuideSlug = useViewStore((s) => s.pendingGuideSlug);
  const [activeSlug, setActiveSlug] = useState(() => pendingGuideSlug ?? firstVisibleSlug ?? '');

  // Same render-phase "adjust state when a prop changes" pattern as the
  // cloudManaged reconcile below, covering the case where a deep-link arrives
  // while this view is already mounted. Tracking the last-honoured request (not
  // just comparing against activeSlug) is what lets the reader click away to
  // another topic afterwards without being yanked back. The store value itself
  // is cleared by the next `setView`, not from here — writing to it during
  // render would be a side effect, and from an effect a lint error.
  const [honouredSlug, setHonouredSlug] = useState(pendingGuideSlug);
  if (pendingGuideSlug && pendingGuideSlug !== honouredSlug) {
    setHonouredSlug(pendingGuideSlug);
    setActiveSlug(pendingGuideSlug);
  }

  // Render-phase reconcile (React's "adjusting state when a prop changes"
  // pattern): if cloudManaged flips true mid-session (after /vault/status
  // resolves) while a now-hidden local-only topic is selected, fall back to
  // the first still-visible topic rather than leaving stale hidden content
  // on screen. Guarded so it only fires on an actual mismatch — once
  // reconciled, activeSlug is in visibleSlugs and the condition is false.
  if (!visibleSlugs.has(activeSlug) && firstVisibleSlug && firstVisibleSlug !== activeSlug) {
    setActiveSlug(firstVisibleSlug);
  }

  // getGuideContent is async (guide markdown is code-split, one chunk per
  // slug/locale — see guides-registry.ts). The loaded result is tagged with
  // the request key it answers; render-time "loading" is derived by
  // comparing that key against the current one, rather than resetting state
  // to null synchronously in the effect body (which the react-hooks
  // set-state-in-effect rule flags as a cascading-render hazard). This also
  // guards the async race the reader can trigger by switching topic or UI
  // language while a load is in flight: the effect's cleanup flips `ignore`,
  // so a load that resolves (or rejects) after a newer selection was made
  // writes nothing — the stale `.then` is a no-op, and the key comparison
  // would have hidden it even if it weren't. An AbortController isn't a fit
  // here — dynamic `import()` has no abort signal to pass it.
  //
  // A rejection (e.g. a stale hashed chunk 404ing after a deploy, or a
  // network blip) lands in the 'error' status rather than being left
  // unhandled — an unhandled rejection would leave the spinner spinning
  // forever with no way out. `retryToken` gives the reader a way out: the
  // Retry button bumps it, which re-runs this effect against the same
  // slug/language.
  const [loadedGuide, setLoadedGuide] = useState<
    { key: string; status: 'ready'; content: string } | { key: string; status: 'error' } | null
  >(null);
  const [retryToken, setRetryToken] = useState(0);
  useEffect(() => {
    let ignore = false;
    const key = `${language}::${activeSlug}`;
    getGuideContent(activeSlug, language).then(
      (md) => {
        if (!ignore) setLoadedGuide({ key, status: 'ready', content: md });
      },
      (err) => {
        console.error('[guide] failed to load guide content', err);
        if (!ignore) setLoadedGuide({ key, status: 'error' });
      },
    );
    return () => {
      ignore = true;
    };
  }, [activeSlug, language, retryToken]);

  const currentGuideKey = `${language}::${activeSlug}`;
  const loadedForCurrent = loadedGuide && loadedGuide.key === currentGuideKey ? loadedGuide : null;
  const hasLoadError = loadedForCurrent?.status === 'error';
  const rawContent = loadedForCurrent?.status === 'ready' ? loadedForCurrent.content : null;
  const content =
    rawContent === null ? null : cloudManaged ? stripLocalOnly(rawContent) : rawContent;
  const rendered =
    content === null
      ? null
      : renderMarkdown(content, {
          // `[label](guide:<slug>)` cross-references switch topic in place.
          // Gated on `visibleSlugs` so a reference to a local-only topic
          // renders as plain text in cloud mode rather than as a control that
          // would select a topic the sidebar does not offer.
          onTopicLink: setActiveSlug,
          isTopicAvailable: (slug) => visibleSlugs.has(slug),
        });

  return (
    <div className="flex h-full" data-testid="guide-view">
      {/* Left navigation */}
      <aside className="w-56 shrink-0 border-r overflow-y-auto p-3 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.titleKey}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t(group.titleKey)}
            </p>
            <div className="space-y-0.5">
              {group.topics.map((topic) => (
                <Button
                  key={topic.slug}
                  variant={activeSlug === topic.slug ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => setActiveSlug(topic.slug)}
                  data-testid={`guide-topic-${topic.slug}`}
                >
                  {t(topic.labelKey)}
                </Button>
              ))}
            </div>
            <Separator className="mt-3" />
          </div>
        ))}
      </aside>

      {/* Content area — capped to a comfortable reading measure (~70ch). */}
      <main className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-[72ch]">
          {hasLoadError ? (
            <div className="space-y-3 py-3" data-testid="guide-content-error">
              <p className="text-sm text-destructive">{t('account:errorGeneric')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="guide-content-retry"
                onClick={() => {
                  // Clear the error immediately (in the click handler, not an
                  // effect) so the UI drops back to the loading state while
                  // the retried load is in flight — otherwise the error
                  // panel (Retry button included) stays on screen for the
                  // whole retry with no feedback that anything happened.
                  setLoadedGuide(null);
                  setRetryToken((n) => n + 1);
                }}
              >
                {t('collab:routing.retry')}
              </Button>
            </div>
          ) : rendered === null ? (
            <div
              className="flex items-center gap-2 py-3 text-sm text-muted-foreground"
              data-testid="guide-content-loading"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('loading')}
            </div>
          ) : (
            rendered
          )}
        </div>
      </main>
    </div>
  );
}
