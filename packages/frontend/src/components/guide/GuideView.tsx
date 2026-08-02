import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiSettings } from '../../stores/ui-settings-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
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
  const [activeSlug, setActiveSlug] = useState(firstVisibleSlug ?? '');

  // Render-phase reconcile (React's "adjusting state when a prop changes"
  // pattern): if cloudManaged flips true mid-session (after /vault/status
  // resolves) while a now-hidden local-only topic is selected, fall back to
  // the first still-visible topic rather than leaving stale hidden content
  // on screen. Guarded so it only fires on an actual mismatch — once
  // reconciled, activeSlug is in visibleSlugs and the condition is false.
  if (!visibleSlugs.has(activeSlug) && firstVisibleSlug && firstVisibleSlug !== activeSlug) {
    setActiveSlug(firstVisibleSlug);
  }

  const rawContent = getGuideContent(activeSlug, language);
  const content = cloudManaged ? stripLocalOnly(rawContent) : rawContent;
  const rendered = renderMarkdown(content);

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
        <div className="mx-auto max-w-[72ch]">{rendered}</div>
      </main>
    </div>
  );
}
