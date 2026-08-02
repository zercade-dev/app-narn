/**
 * M10 pipeline types — a configurable list of LQA checks run by the
 * LQAGate (see ../M10-lqa-gate.ts).
 */
import type {
  GlossaryTerm,
  LQAIssue,
  LQASeverity,
  Project,
  StringEntry,
} from '@zercade-dev/narn-shared';
import { MASK_TOKEN_SOURCE, buildTermBoundaryRegex, escapeRegExp } from '@zercade-dev/narn-shared';

export interface LQACheckContext {
  /** Project the entry belongs to; undefined when no project context is available. */
  project?: Project;
  /**
   * Glossary terms assigned to the entry that have a translation for the
   * target language. Only populated when the check declares `needsGlossary`.
   */
  glossaryTerms: GlossaryTerm[];
  /** Effective check options from the project config (`lqaConfig.checks[id].options`). */
  options: Record<string, unknown>;
}

export interface LQACheck {
  id: string;
  /** Severity stamped on this check's issues unless overridden per project or per issue. */
  defaultSeverity: LQASeverity;
  /** Whether the check runs when the project has no explicit config for it. */
  defaultEnabled: boolean;
  /** True when the check needs the entry's glossary terms (fetched lazily by the runner). */
  needsGlossary?: boolean;
  run(
    entry: StringEntry,
    translatedText: string,
    targetLanguage: string,
    ctx: LQACheckContext,
  ): LQAIssue[] | Promise<LQAIssue[]>;
}

// `escapeRegExp` and the case-insensitive Unicode-aware whole-word matcher now
// have a single canonical definition in @zercade-dev/narn-shared. Re-exported here so
// existing importers (M20, M10 content-checks) keep their import paths.
export { escapeRegExp };
/** Case-insensitive, Unicode-aware whole-word matcher (same approach as M20). */
export const wordBoundaryRegExp = buildTermBoundaryRegex;

/**
 * Single definition of the M17 mask placeholder tokens — `{t:n}` / `{/t:n}`
 * (tag), `{v:n}` (variable), `{g:n}` (glossary), `{e:n}` (escape). Shared by
 * the parity checks so the token set has one source of truth.
 *
 * Compiled from the canonical shared `MASK_TOKEN_SOURCE` grammar (so the M10
 * checks, deepl, and pseudo can never drift) with the `gi` flags this module
 * relies on: `g` for the replace-all sweep and `i` so a mask token survives
 * casing differences. It is only ever used with `String.replace`, which resets
 * `lastIndex` after each call, so sharing the instance is safe. The exported
 * name is unchanged — the sibling M10 checks import it.
 */
export const MASK_PLACEHOLDER_RE = new RegExp(MASK_TOKEN_SOURCE, 'gi');
