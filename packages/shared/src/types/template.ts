import type { RoutingRule, RoutingRuleGroup } from './routing.js';
import type { ProjectModuleConfigEntry } from './project.js';

/**
 * Config-shaped subset of a project captured by "Save as template".
 *
 * Deliberately excludes everything that is not configuration: entries /
 * translations, runs, project id, name, timestamps, and anything
 * secret-shaped (secrets live in the credential vault, never in project
 * JSON). Routing rule / group ids are kept — they are part of the routing
 * configuration itself (the active group id references them).
 */
export interface ProjectTemplateConfig {
  /** Cosmetic project icon from the curated PROJECT_ICONS set. */
  icon?: string;
  sourceLanguage: string;
  activeLanguages: string[];
  routingRules: RoutingRule[];
  routingRuleGroups?: RoutingRuleGroup[];
  activeRoutingRuleGroupId?: string | null;
  moduleConfigs: Record<string, ProjectModuleConfigEntry>;
  forcedGlossaryIds?: string[];
  /**
   * Per-project enabled overrides for global (read-only) glossaries — the
   * contents of M8's `glossary-overrides.json`, keyed by global glossary id.
   */
  globalGlossaryOverrides?: Record<string, boolean>;
}

/** A saved project template stored under `PROJECTS_ROOT/templates/<id>.json`. */
export interface ProjectTemplate {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  config: ProjectTemplateConfig;
}

/**
 * Non-fatal issue reported when applying a template. Unknown module /
 * glossary references are kept on the created project (same posture as M9,
 * which treats unknown module ids as routable but fails them at execution)
 * and surfaced to the UI through this list.
 */
export interface TemplateApplyWarning {
  code: 'unknown-module' | 'unknown-glossary';
  /** The unknown module id or glossary id the template referenced. */
  subject: string;
  message: string;
}
