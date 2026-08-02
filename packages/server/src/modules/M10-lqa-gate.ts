/**
 * M10 — LQAGate
 *
 * Configurable pipeline of automated quality checks comparing source text to
 * a translation. The legacy checks (tag equality, overflow ratio) run by
 * default; advanced checks (glossary adherence,
 * forbidden terms, regex assertions) are opt-in per project via
 * `Project.lqaConfig.checks`. Emits `lqa:passed` / `lqa:failed` /
 * `lqa:overflow` events via M15.
 *
 * Invariant: `LQAResult.passed` means "no blocking issues". Warning-severity
 * issues are reported but never fail the gate, so they can never trigger the
 * M9 `retryWithFeedback` re-attempt.
 */
import type {
  GlossaryTerm,
  LQACheckConfig,
  LQAIssue,
  LQAResult,
  Project,
  StringEntry,
} from '@zercade-dev/narn-shared';
import { projectTargetLanguages } from '@zercade-dev/narn-shared';
import { logger as defaultLogger } from './M15-console-logger.js';
import { getGlossaryStore, getProjectStore } from '../storage/registry.js';
import { ALL_CHECKS, MASK_INTEGRITY_CHECK_ID } from './M10/registry.js';
import { computeOverflowRatio } from './M10/builtin-checks.js';
import type { LQACheck } from './M10/types.js';

interface LoggerLike {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

export type ProjectProvider = (projectId: string) => Promise<Project | undefined>;
export type GlossaryTermsProvider = (
  projectId: string | undefined,
  project: Project | undefined,
  entry: StringEntry,
  targetLanguage: string,
) => Promise<GlossaryTerm[]>;

export interface LQAGateDeps {
  logger?: LoggerLike;
  /** Ordered pipeline; defaults to the built-in registry. */
  checks?: readonly LQACheck[];
  projectProvider?: ProjectProvider;
  glossaryTermsProvider?: GlossaryTermsProvider;
}

/** Optional context for a gate run; without it the default pipeline config applies. */
export interface LQAGateContext {
  /** Project id used to load per-project pipeline config and glossary terms. */
  projectId?: string;
  /** Pre-loaded project (skips the `projectId` lookup). */
  project?: Project;
  /** Issues produced outside the pipeline (M17 mask diagnostics from M9). */
  extraIssues?: LQAIssue[];
}

const defaultProjectProvider: ProjectProvider = async (projectId) =>
  getProjectStore().loadProject(projectId);

const defaultGlossaryTermsProvider: GlossaryTermsProvider = async (
  projectId,
  project,
  entry,
  targetLanguage,
) => {
  if (!projectId) return [];
  const glossaryIds = entry.assignedGlossaryIds ?? project?.forcedGlossaryIds ?? [];
  return getGlossaryStore().getTermsForLanguage(
    projectId,
    targetLanguage,
    glossaryIds,
    project ? projectTargetLanguages(project) : undefined,
  );
};

export class LQAGate {
  private readonly logger: LoggerLike;
  private readonly checks: readonly LQACheck[];
  private readonly projectProvider: ProjectProvider;
  private readonly glossaryTermsProvider: GlossaryTermsProvider;

  constructor(deps: LQAGateDeps = {}) {
    this.logger = deps.logger ?? defaultLogger;
    this.checks = deps.checks ?? ALL_CHECKS;
    this.projectProvider = deps.projectProvider ?? defaultProjectProvider;
    this.glossaryTermsProvider = deps.glossaryTermsProvider ?? defaultGlossaryTermsProvider;
  }

  async check(
    source: StringEntry,
    translatedText: string,
    targetLanguage: string,
    ctx: LQAGateContext = {},
  ): Promise<LQAResult> {
    let project = ctx.project;
    if (!project && ctx.projectId) {
      try {
        project = await this.projectProvider(ctx.projectId);
      } catch {
        project = undefined; // missing project ⇒ default pipeline config
      }
    }
    const checksConfig = project?.lqaConfig?.checks ?? {};
    const configFor = (id: string): LQACheckConfig => checksConfig[id] ?? {};
    const isEnabled = (id: string, defaultEnabled: boolean): boolean =>
      configFor(id).enabled ?? defaultEnabled;

    const needsGlossary = this.checks.some(
      (c) => c.needsGlossary === true && isEnabled(c.id, c.defaultEnabled),
    );
    let glossaryTerms: GlossaryTerm[] = [];
    if (needsGlossary) {
      try {
        glossaryTerms = await this.glossaryTermsProvider(
          ctx.projectId ?? project?.id,
          project,
          source,
          targetLanguage,
        );
      } catch {
        glossaryTerms = [];
      }
    }

    const issues: LQAIssue[] = [];
    for (const check of this.checks) {
      const cfg = configFor(check.id);
      if (!isEnabled(check.id, check.defaultEnabled)) continue;
      const severity = cfg.severity ?? check.defaultSeverity;
      let checkIssues: LQAIssue[];
      try {
        checkIssues = await check.run(source, translatedText, targetLanguage, {
          project,
          glossaryTerms,
          options: cfg.options ?? {},
        });
      } catch (err) {
        this.logger.warn('lqa:check-error', {
          checkId: check.id,
          entryId: source.id,
          targetLanguage,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      for (const issue of checkIssues) {
        issues.push({ ...issue, checkId: check.id, severity: issue.severity ?? severity });
      }
    }

    // Engine-produced mask diagnostics, appended last to preserve the legacy
    // issue ordering of persisted results.
    if (ctx.extraIssues && ctx.extraIssues.length > 0) {
      const maskCfg = configFor(MASK_INTEGRITY_CHECK_ID);
      if (maskCfg.enabled ?? true) {
        const severity = maskCfg.severity ?? 'blocking';
        for (const issue of ctx.extraIssues) {
          issues.push({
            ...issue,
            checkId: issue.checkId ?? MASK_INTEGRITY_CHECK_ID,
            severity: issue.severity ?? severity,
          });
        }
      }
    }

    const overflowRatio = computeOverflowRatio(source.sourceText, translatedText);
    const overflow = issues.some((i) => i.type === 'overflow');
    const passed = issues.every((i) => i.severity !== 'blocking');

    const meta = {
      entryId: source.id,
      targetLanguage,
      overflowRatio,
      issueCount: issues.length,
    };
    if (overflow) this.logger.warn('lqa:overflow', meta);
    if (!passed) this.logger.warn('lqa:failed', meta);
    else if (!overflow) this.logger.info('lqa:passed', meta);

    return { passed, issues, overflow, overflowRatio };
  }
}

export const lqaGate = new LQAGate();
