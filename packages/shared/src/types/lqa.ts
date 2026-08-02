/** Severity of an LQA issue. `blocking` issues fail the gate (`passed === false`); `warning` issues never do. */
export type LQASeverity = 'blocking' | 'warning';

/**
 * Issue types emitted by the built-in legacy checks. The `LQAIssue.type`
 * field is intentionally an open string so pipeline checks can emit their
 * own types (e.g. `forbidden-term`) without widening this union;
 * consumers must treat unknown types as opaque.
 */
export type KnownLQAIssueType =
  'tag-mismatch' | 'placeholder-missing' | 'overflow' | 'too-long' | 'mask-mismatch';

export interface LQAIssue {
  type: string;
  detail: string;
  /** Id of the pipeline check that produced this issue. Absent on legacy persisted results. */
  checkId?: string;
  /**
   * Effective severity of the issue. Absent on legacy persisted results, in
   * which case `'overflow'` is a warning and every other type is blocking.
   */
  severity?: LQASeverity;
}

export interface TagNode {
  type: 'text' | 'tag' | 'error';
  content: string;
  children?: TagNode[];
  attributes?: Record<string, string>;
}

export interface LQAResult {
  /** True when no blocking issues were found. Warnings never fail the gate. */
  passed: boolean;
  issues: LQAIssue[];
  overflow: boolean;
  /** Actual ratio of translated length / source length */
  overflowRatio: number;
}

/** Per-check configuration stored on the project (`Project.lqaConfig.checks[checkId]`). */
export interface LQACheckConfig {
  /** Enable/disable the check. Absent ⇒ the check's `defaultEnabled`. */
  enabled?: boolean;
  /** Override the check's default severity. */
  severity?: LQASeverity;
  /** Check-specific options (forbidden term lists, regex assertions, ignore words, …). */
  options?: Record<string, unknown>;
}

/** Per-project LQA pipeline configuration. Additive and fully optional. */
export interface ProjectLQAConfig {
  checks?: Record<string, LQACheckConfig>;
}
