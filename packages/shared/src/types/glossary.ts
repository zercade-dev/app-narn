export interface GlossaryTerm {
  id: string;
  source: string;
  translations: Record<string, string>;
  /**
   * When true the term is treated as a constant during translation:
   * matches in the source text are masked as `{g:N}` placeholders so the
   * translation backend never sees them, then restored using the target
   * language's translation while preserving the original case pattern of
   * the matched occurrence.
   */
  constant?: boolean;
  notes?: string;
}

/** Metadata common to a {@link Glossary} and its {@link GlossarySummary}. */
export interface GlossaryMeta {
  id: string;
  projectId: string;
  name: string;
  readOnly?: boolean;
  enabled?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface GlossarySummary extends GlossaryMeta {
  termCount: number;
}

export interface Glossary extends GlossaryMeta {
  terms: GlossaryTerm[];
  /**
   * Timestamp of the last successful push to DeepL. When the glossary is
   * modified after this point (e.g. by a bulk import) the UI surfaces a
   * "re-push required" indicator (`updatedAt > pushedToDeepLAt`).
   */
  pushedToDeepLAt?: number;
}
