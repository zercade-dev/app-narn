/**
 * The legacy LQA checks that used to be hard-coded in M10:
 * inline-tag equality and overflow ratio.
 *
 * They keep their historical issue `type` literals so persisted results and
 * downstream consumers (frontend badges, M9 retry feedback) are unaffected.
 * (A placeholder-parity check existed when `[bracket]` placeholders were a
 * supported syntax; placeholder protection is now handled by M17 masking and
 * the mask-integrity diagnostics.)
 */
import {
  LANG_NAMES,
  exceedsLengthLimit,
  getLengthLimit,
  utf8ByteLength,
  resolveAchievementMaxBytes,
} from '@zercade-dev/narn-shared';
import { tagsEqual } from '../M14-tag-parser.js';
import type { LQACheck } from './types.js';

export const tagEqualityCheck: LQACheck = {
  id: 'tag-equality',
  defaultSeverity: 'blocking',
  defaultEnabled: true,
  run(entry, translatedText) {
    if (!tagsEqual(entry.sourceText, translatedText)) {
      return [
        { type: 'tag-mismatch', detail: 'inline tags differ between source and translation' },
      ];
    }
    return [];
  },
};

/**
 * Hard per-language output limits imposed by the game editor (chars and UTF-8
 * bytes, grouped by script family — see shared/src/length-limits.ts).
 * Escalating the severity to `blocking` makes M9 auto-retry with an explicit
 * "provide a shorter version" instruction; at the default `warning` severity
 * the result is accepted but flagged `too-long`, so it surfaces in the
 * frontend "Too long" filter for targeted re-translation.
 */
export const lengthLimitCheck: LQACheck = {
  id: 'length-limit',
  defaultSeverity: 'warning',
  defaultEnabled: true,
  run(entry, translatedText, targetLanguage, ctx) {
    // Achievement-typed entries are governed solely by achievementLengthLimitCheck
    // (registered below); skip them here so an over-limit achievement is never
    // flagged twice.
    if (entry.achievementType === 'name' || entry.achievementType === 'description') return [];
    // The source language is never a translation target, so its limit must not
    // apply — guards the case where the source (e.g. English) is also enabled
    // as an active language.
    if (ctx.project && targetLanguage === ctx.project.sourceLanguage) return [];
    const limit = getLengthLimit(targetLanguage);
    if (!limit) return [];
    // The threshold comparison lives once in the shared `exceedsLengthLimit`;
    // chars/bytes are measured here only for the human-readable detail message.
    if (!exceedsLengthLimit(translatedText, limit)) return [];
    const chars = translatedText.length;
    const bytes = utf8ByteLength(translatedText);
    const langName = LANG_NAMES[targetLanguage] ?? targetLanguage;
    return [
      {
        type: 'too-long',
        detail:
          `translation is ${chars} characters / ${bytes} UTF-8 bytes; ` +
          `${langName} allows at most ${limit.maxChars} characters and ${limit.maxBytes} bytes`,
      },
    ];
  },
};

/**
 * Per-achievement UTF-8 byte limits, far tighter than the per-language limits
 * and user-configurable per project (`options.nameMaxBytes` /
 * `options.descriptionMaxBytes`; defaults 20 / 40). Applies only to entries
 * tagged as an achievement name or description (`StringEntry.achievementType`);
 * all other entries are handled by `lengthLimitCheck`. Warning severity by
 * default — flagged in the "Too long" filter, never blocking.
 */
export const achievementLengthLimitCheck: LQACheck = {
  id: 'achievement-length-limit',
  defaultSeverity: 'warning',
  defaultEnabled: true,
  run(entry, translatedText, targetLanguage, ctx) {
    if (ctx.project && targetLanguage === ctx.project.sourceLanguage) return [];
    const type = entry.achievementType;
    if (type !== 'name' && type !== 'description') return [];
    const maxBytes = resolveAchievementMaxBytes(type, ctx.options);
    const bytes = utf8ByteLength(translatedText);
    if (bytes <= maxBytes) return [];
    return [
      {
        type: 'too-long',
        detail: `achievement ${type} translation is ${bytes} UTF-8 bytes; at most ${maxBytes} bytes allowed`,
      },
    ];
  },
};

/**
 * The translation/source length ratio used by both the overflow check and the
 * gate's `LQAResult.overflowRatio`, defined once so the two can't diverge.
 */
export function computeOverflowRatio(sourceText: string, translatedText: string): number {
  return sourceText.length > 0 ? translatedText.length / sourceText.length : 0;
}

export const overflowCheck: LQACheck = {
  id: 'overflow',
  defaultSeverity: 'warning',
  defaultEnabled: true,
  run(entry, translatedText) {
    const ratio = computeOverflowRatio(entry.sourceText, translatedText);
    if (!entry.ignoreOverflow && ratio > entry.overflowRatio) {
      return [
        {
          type: 'overflow',
          detail: `translation length ratio ${ratio.toFixed(2)} exceeds ${entry.overflowRatio.toFixed(2)}`,
        },
      ];
    }
    return [];
  },
};
