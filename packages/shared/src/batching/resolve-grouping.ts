/**
 * Resolve the effective batch-grouping configuration for a run.
 *
 * Precedence: per-project override → workspace default → built-in default
 * (`none` / not-ignored). The two axes resolve independently so a project can
 * override only the dimension while inheriting the workspace ignore-limit toggle
 * (or vice versa).
 */
import type { BatchGroupingDimension, Project, WorkspaceSettings } from '../types/project.js';

export interface ResolvedBatchGrouping {
  dimension: BatchGroupingDimension;
  ignoreSizeLimit: boolean;
}

export function resolveBatchGrouping(
  project: Pick<Project, 'batchGrouping' | 'ignoreBatchSizeLimit'> | null | undefined,
  workspace: WorkspaceSettings | null | undefined,
): ResolvedBatchGrouping {
  return {
    dimension: project?.batchGrouping ?? workspace?.batchGrouping ?? 'none',
    ignoreSizeLimit: project?.ignoreBatchSizeLimit ?? workspace?.ignoreBatchSizeLimit ?? false,
  };
}
