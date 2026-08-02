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
  const { language } = useUiSettings();
  const content = getGuideContent('about-narn', language);
  const rendered = renderMarkdown(content);

  return (
    <main className="flex-1 overflow-auto px-6 py-8" data-testid="about-narn-view">
      <div className="mx-auto max-w-[72ch] space-y-6">
        {rendered}
        <AboutVersion />
      </div>
    </main>
  );
}
