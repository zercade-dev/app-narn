/**
 * Shared shapes for the enriched per-entry context that the AI generators
 * (glossary M28, category M29) optionally add to their prompts. The assembler
 * (`collectEntryContext`) lives in ai-sdk-provider; these are the leaf types it
 * and the prompt builders share.
 */

/** Which non-translation entry fields to include as context. */
export type EntryContextField = 'context' | 'sources' | 'categories';

/** A single translation record reduced to what the assembler needs. */
export interface EntryContextRecord {
  text: string;
  status: string;
}

/** Structural subset of a StringEntry the assembler reads (StringEntry satisfies it). */
export interface EntryContextSource {
  context?: string;
  sources?: string[];
  categories?: string[];
  translations?: Record<string, EntryContextRecord>;
}

/** Per-run selection of which context to assemble. */
export interface EntryContextOptions {
  fields: readonly EntryContextField[];
  languages: readonly string[];
}

/** Assembled, bounded context for one entry. Only populated keys are present. */
export interface EntryContext {
  context?: string;
  sources?: string[];
  categories?: string[];
  /** langCode -> bounded translated/reviewed text. */
  translations?: Record<string, string>;
}
