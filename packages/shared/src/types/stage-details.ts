/**
 * Stage details — the three human-authored fields describing the stage a
 * project represents. Stored on Project (optional, absent until first
 * edited); translations are per-language and independent of
 * string-translation coverage. Staleness is DERIVED from timestamps, never
 * stored.
 */
export type StageDetailFieldId = 'name' | 'gameplayDetails' | 'stageDescription';

export const STAGE_DETAIL_FIELD_IDS = ['name', 'gameplayDetails', 'stageDescription'] as const;

export interface StageDetailTranslation {
  text: string;
  /** Producing module id, or 'manual' / 'chat' for hand-applied text. */
  moduleId: string;
  timestamp: number;
}

export interface StageDetailField {
  sourceText: string;
  /** Bumped on every source edit; drives derived staleness. */
  sourceUpdatedAt: number;
  /** Optional advisory char limit (UI counter only; never rejected server-side). */
  maxLength?: number;
  translations: Record<string, StageDetailTranslation>;
}

export interface StageDetails {
  name: StageDetailField;
  gameplayDetails: StageDetailField;
  stageDescription: StageDetailField;
}

export function emptyStageDetails(): StageDetails {
  const empty = (): StageDetailField => ({ sourceText: '', sourceUpdatedAt: 0, translations: {} });
  return { name: empty(), gameplayDetails: empty(), stageDescription: empty() };
}

/** A translation is stale when it predates the last source edit. Missing = not stale. */
export function isStaleTranslation(field: StageDetailField, lang: string): boolean {
  const t = field.translations[lang];
  return t !== undefined && t.timestamp < field.sourceUpdatedAt;
}
