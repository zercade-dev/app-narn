/**
 * Pure, dependency-free helpers lifted out of M9 `TranslationEngine`. Each is a
 * self-contained function of its arguments — no engine `this` state (queues,
 * maps, registries, logger) — so they live here as free functions and the class
 * methods delegate to them unchanged. Most bodies are byte-identical relocations
 * of the former inline methods, but this file also carries new logic added
 * since: the achievement prompt-context and pairing helpers.
 */
import {
  type AchievementPromptContext,
  type GlobalConfig,
  isExcludedFromAi,
  type Project,
  PSEUDO_MODULE_ID,
  resolveAchievementMaxBytes,
  type StringEntry,
  type TranslationJob,
} from '@zercade-dev/narn-shared';

/**
 * Module-config fragment carrying the workspace-wide client-side rate limit,
 * injected into every module created for a translation job.
 */
export function rateLimitConfig(global: GlobalConfig): Record<string, unknown> {
  const rps = global.settings?.requestsPerSecond;
  return typeof rps === 'number' && rps > 0 ? { requestsPerSecond: rps } : {};
}

/**
 * Cache key for the per-(target language, assigned-glossary set) glossary group.
 * Entries with no explicit `assignedGlossaryIds` share the project-wide bucket.
 */
export function glossaryEntryKey(targetLang: string, entry: StringEntry): string {
  const ids = entry.assignedGlossaryIds;
  return ids !== undefined
    ? `${targetLang}\0${[...ids].sort().join('\0')}`
    : `${targetLang}\0__project__`;
}

/**
 * The set of module ids that may be routed for a run: every routing rule's
 * module plus the always-available `pseudo` module (so `pseudo-test` jobs route
 * without a user-defined rule — just enable the module + add the language). If
 * the module is not actually enabled, `processBatchJob` still reports
 * `module-disabled` authoritatively.
 */
export function deriveAvailableModuleIds(rules: { moduleId: string }[]): { id: string }[] {
  const ids = new Set<string>([PSEUDO_MODULE_ID]);
  for (const r of rules) ids.add(r.moduleId);
  return Array.from(ids, (id) => ({ id }));
}

/**
 * The entry's existing translation in `referenceLanguage`, attached to jobs as
 * LLM prompt context. Undefined when no reference language was requested, it
 * equals the job's target, or the entry has no text in it.
 */
export function jobReference(
  entry: StringEntry,
  targetLanguage: string,
  referenceLanguage?: string,
): TranslationJob['reference'] {
  if (!referenceLanguage || referenceLanguage === targetLanguage) return undefined;
  const text = entry.translations[referenceLanguage]?.text;
  return text ? { language: referenceLanguage, text } : undefined;
}

/** Example pairs demonstrating the desired style, keyed by target language. */
export type ExamplesByLanguage = Map<string, NonNullable<TranslationJob['examples']>>;

/** Hard cap on contributing example entries per run (also enforced by the route schema). */
export const MAX_RUN_EXAMPLES = 10;

/**
 * Resolves a run's exampleEntryIds into per-target-language
 * `{ sourceText, translatedText }` pairs. An id contributes to a language only
 * when the entry has a non-empty translation in it. Dropped silently: ids in
 * `excludeIds` (the run's own scope — an entry being translated must not
 * anchor itself), unknown ids, ignored entries, and anything past
 * {@link MAX_RUN_EXAMPLES} contributing entries. Returns undefined when no
 * pair survives.
 */
export function buildExamplesByLanguage(
  allEntries: StringEntry[],
  exampleEntryIds: string[] | undefined,
  excludeIds: ReadonlySet<string>,
  targetLanguages: string[],
): ExamplesByLanguage | undefined {
  if (!exampleEntryIds?.length) return undefined;
  const byId = new Map(allEntries.map((e) => [e.id, e]));
  const map: ExamplesByLanguage = new Map();
  let used = 0;
  for (const id of exampleEntryIds) {
    if (used >= MAX_RUN_EXAMPLES) break;
    if (excludeIds.has(id)) continue;
    const entry = byId.get(id);
    if (!entry || isExcludedFromAi(entry)) continue;
    let contributed = false;
    for (const lang of targetLanguages) {
      const text = entry.translations[lang]?.text;
      if (!text?.trim()) continue;
      const list = map.get(lang) ?? [];
      list.push({ sourceText: entry.sourceText, translatedText: text });
      map.set(lang, list);
      contributed = true;
    }
    if (contributed) used++;
  }
  return map.size > 0 ? map : undefined;
}

/**
 * Achievement prompt context for a job: the byte budget the LQA gate will
 * enforce (same resolver, same options bag) plus the linked counterpart's
 * source and usable translation. `pairMap` is built once per run from ALL
 * project entries keyed by achievementId. Returns undefined for entries not
 * tagged as an achievement name/description.
 */
export function buildAchievementPromptContext(
  entry: StringEntry,
  targetLanguage: string,
  project: Project,
  pairMap: Map<string, StringEntry[]>,
): AchievementPromptContext | undefined {
  const type = entry.achievementType;
  if (type !== 'name' && type !== 'description') return undefined;
  const options =
    (project.lqaConfig?.checks?.['achievement-length-limit']?.options as
      Record<string, unknown> | undefined) ?? {};
  const ctx: AchievementPromptContext = {
    type,
    maxBytes: resolveAchievementMaxBytes(type, options),
  };
  const gid = entry.achievementId;
  if (gid) {
    const counterpart = (pairMap.get(gid) ?? []).find(
      (e) =>
        e.id !== entry.id &&
        (e.achievementType === 'name' || e.achievementType === 'description') &&
        e.achievementType !== type,
    );
    if (counterpart) {
      const record = counterpart.translations[targetLanguage];
      const usable = record && (record.status === 'translated' || record.status === 'reviewed');
      ctx.counterpart = {
        type: counterpart.achievementType as 'name' | 'description',
        sourceText: counterpart.sourceText,
        ...(usable && record.text ? { translatedText: record.text } : {}),
      };
    }
  }
  return ctx;
}

/** One-per-run index of achievement-linked entries, keyed by achievementId. */
export function buildAchievementPairMap(entries: StringEntry[]): Map<string, StringEntry[]> {
  const map = new Map<string, StringEntry[]>();
  for (const e of entries) {
    if (!e.achievementId) continue;
    const bucket = map.get(e.achievementId) ?? [];
    bucket.push(e);
    map.set(e.achievementId, bucket);
  }
  return map;
}
