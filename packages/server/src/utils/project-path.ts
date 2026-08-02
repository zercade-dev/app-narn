import path from 'path';
import { PathTraversalError } from '../errors/PathTraversalError.js';
import { getProjectsRoot } from '../config/env.js';

/**
 * Root directory under which every project folder lives. Single source of
 * truth shared by all routers and stores so a divergent copy cannot skip
 * path-traversal validation.
 */
export const PROJECTS_ROOT = getProjectsRoot();

/**
 * Validates `projectId` against path traversal by resolving it under
 * {@link PROJECTS_ROOT}, then returns the id unchanged. Throws
 * `PathTraversalError` for unsafe ids (slashes, `..`, NUL).
 */
export function ensureProjectId(projectId: string): string {
  resolveProjectPath(PROJECTS_ROOT, projectId);
  return projectId;
}

/**
 * Screens a single path segment for traversal vectors. Rejects an empty
 * segment, embedded path separators (`/`, `\`), parent-directory references
 * (`..`), and NUL bytes. A legitimate single-segment filename — e.g.
 * `backup.zip`, `strings.json` — passes (a lone `.` before an extension is not
 * `..`). `label` describes the segment in the thrown message.
 */
function screenSegment(segment: string, label: string): void {
  if (!segment) {
    throw new PathTraversalError(`${label} cannot be empty`);
  }
  if (segment.includes('/') || segment.includes('\\')) {
    throw new PathTraversalError(`Invalid ${label}: contains path separators`);
  }
  if (segment.includes('..')) {
    throw new PathTraversalError(`Invalid ${label}: contains parent directory references`);
  }
  if (segment.includes('\0')) {
    throw new PathTraversalError(`Invalid ${label}: contains null bytes`);
  }
}

export function resolveProjectPath(
  projectsRoot: string,
  projectId: string,
  ...rest: string[]
): string {
  // Reject dangerous projectId values BEFORE any processing.
  screenSegment(projectId, 'project ID');

  // Screen every additional segment with the same rules so the function is
  // safe-by-construction regardless of caller-side guards; the resolution net
  // below still backstops anything that slips through.
  for (const segment of rest) {
    screenSegment(segment, 'path segment');
  }

  // Now resolve the path
  const root = path.resolve(projectsRoot);
  const resolved = path.resolve(root, projectId, ...rest);

  // Verify the resolved path is within the root
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new PathTraversalError('Path traversal detected');
  }

  return resolved;
}
