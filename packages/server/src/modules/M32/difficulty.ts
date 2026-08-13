/**
 * Deterministic difficulty scoring: maps a job to the minimum quality tier
 * (band) a bucket must have to attempt it. Higher bands are harder: long,
 * mask-dense, length-limited, toned, or hard-target-language strings fail
 * more on weak models, and every failure costs a full extra request.
 */
import type { DifficultyBand, FreewayJob, JobGroup } from './types.js';

/** Target languages that measurably depress gate-pass rates on small models. */
const VERY_HARD_LANGUAGES = new Set([
  'ja',
  'ko',
  'zh',
  'zh-CN',
  'zh-TW',
  'ar',
  'he',
  'hu',
  'fi',
  'th',
]);
const HARD_LANGUAGES = new Set(['tr', 'pl', 'cs', 'ru', 'el', 'vi']);

export function languageHardness(language: string): 0 | 1 | 2 {
  const base = language.split('-')[0];
  if (VERY_HARD_LANGUAGES.has(language) || VERY_HARD_LANGUAGES.has(base)) return 2;
  if (HARD_LANGUAGES.has(language) || HARD_LANGUAGES.has(base)) return 1;
  return 0;
}

export function difficultyBand(job: FreewayJob): DifficultyBand {
  let score = 0;
  const len = job.sourceText.length;
  if (len >= 200) score += 2;
  else if (len >= 80) score += 1;
  if (job.maskCount >= 3) score += 2;
  else if (job.maskCount >= 1) score += 1;
  if (job.hasLengthLimit) score += 3;
  if (job.glossaryTermCount >= 1) score += 1;
  if (job.tone !== undefined) score += 1;
  score += languageHardness(job.targetLanguage);
  if (score >= 6) return 4;
  if (score >= 4) return 3;
  if (score >= 2) return 2;
  return 1;
}

/** Stable-order grouping by (targetLanguage, band); jobs keep input order. */
export function groupJobs(jobs: FreewayJob[]): JobGroup[] {
  const map = new Map<string, JobGroup>();
  for (const job of jobs) {
    const band = difficultyBand(job);
    const key = `${job.targetLanguage} ${band}`;
    let group = map.get(key);
    if (!group) {
      group = { targetLanguage: job.targetLanguage, band, jobs: [] };
      map.set(key, group);
    }
    group.jobs.push(job);
  }
  return [...map.values()];
}
