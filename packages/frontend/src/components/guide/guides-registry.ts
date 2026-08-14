/**
 * Lazy index of guide Markdown files, same pattern as changelog-registry.ts
 * in this directory: the glob is deliberately NOT eager, so each guide file
 * becomes its own code-split chunk, fetched only when its slug/locale is
 * actually requested — instead of every locale's guides shipping in the
 * main bundle. Keys are relative paths like '../../guides/en/configure-deepl.md'.
 */
// One level deep only (guides/<locale>/<slug>.md). Deliberately excludes
// subdirectories like guides/en/changelog/, which changelog-registry.ts
// lazy-loads separately — globbing them here too would just duplicate that
// registration.
type Loader = () => Promise<string>;

const files = import.meta.glob('../../guides/*/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, Loader>;

/**
 * Returns the raw Markdown content for the given guide slug and locale.
 * Falls back to 'en' when the locale-specific file is missing — including
 * when the locale's guide directory doesn't exist at all yet (today, only
 * `guides/en/` ships; import.meta.glob simply has no keys for the other
 * fourteen locales, so this resolves to the English chunk for all of them
 * until per-locale guides land).
 */
export async function getGuideContent(slug: string, locale: string): Promise<string> {
  const key = `../../guides/${locale}/${slug}.md`;
  const fallbackKey = `../../guides/en/${slug}.md`;
  const load = files[key] ?? files[fallbackKey];
  if (!load) return `# ${slug}\n\nContent coming soon.`;
  return load();
}

export type GuideTopic = {
  slug: string;
  labelKey: string;
  /**
   * When true, this topic is entirely local-only (self-hosted/open-core
   * only) and is hidden from the Guide's topic list in cloud mode
   * (`cloudManaged`). Undefined/false topics are cloud-safe and always shown.
   */
  localOnly?: boolean;
};

export type GuideGroup = {
  titleKey: string;
  topics: GuideTopic[];
};

// Groups and slug order mirror the main sidebar (see Sidebar.tsx NAV_GROUPS):
// Setup → Translate → Review → Content → Maintenance, then the Translation
// Memory workspace view. The seven configure-* module how-tos live under
// Setup because modules are configured on the Config/Setup screen.
export const GUIDE_GROUPS: GuideGroup[] = [
  {
    titleKey: 'guide.groupSetup',
    topics: [
      { slug: 'usage-quick-setup', labelKey: 'guide.topicQuickSetup' },
      { slug: 'usage-vault', labelKey: 'guide.topicVault' },
      { slug: 'usage-config', labelKey: 'guide.topicConfig' },
      { slug: 'usage-docker', labelKey: 'guide.topicDocker', localOnly: true },
      { slug: 'configure-copilot', labelKey: 'guide.topicCopilot', localOnly: true },
      { slug: 'configure-deepseek', labelKey: 'guide.topicDeepseek' },
      { slug: 'configure-google', labelKey: 'guide.topicGoogle' },
      { slug: 'configure-claude', labelKey: 'guide.topicClaude' },
      { slug: 'configure-gpt', labelKey: 'guide.topicGpt' },
      { slug: 'configure-groq', labelKey: 'guide.topicGroq' },
      { slug: 'configure-openrouter', labelKey: 'guide.topicOpenrouter' },
      { slug: 'configure-generic-ai', labelKey: 'guide.topicGenericAi', localOnly: true },
      { slug: 'configure-deepl', labelKey: 'guide.topicDeepl' },
    ],
  },
  {
    titleKey: 'guide.groupTranslate',
    topics: [
      { slug: 'usage-multi-language-text', labelKey: 'guide.topicMultiLanguage' },
      { slug: 'usage-compare', labelKey: 'guide.topicCompare' },
      { slug: 'usage-routing', labelKey: 'guide.topicRouting' },
      { slug: 'usage-activity', labelKey: 'guide.topicActivity' },
      { slug: 'usage-pseudo-test', labelKey: 'guide.topicPseudoTest' },
    ],
  },
  {
    titleKey: 'guide.groupReview',
    topics: [
      { slug: 'usage-ai-review', labelKey: 'guide.topicAiReview' },
      { slug: 'usage-quality', labelKey: 'guide.topicQuality' },
    ],
  },
  {
    titleKey: 'guide.groupContent',
    topics: [
      { slug: 'usage-glossary', labelKey: 'guide.topicGlossary' },
      { slug: 'usage-category', labelKey: 'guide.topicCategory' },
    ],
  },
  {
    titleKey: 'guide.groupMaintenance',
    topics: [
      { slug: 'usage-orphans', labelKey: 'guide.topicOrphans' },
      { slug: 'usage-backup', labelKey: 'guide.topicBackup' },
    ],
  },
  {
    titleKey: 'guide.groupTranslationMemory',
    topics: [{ slug: 'usage-translation-memory', labelKey: 'guide.topicTranslationMemory' }],
  },
];
