import { getProjectStore, getRunStore, getMemberStore } from '../storage/registry.js';
import { RunNotFoundError, ForbiddenError, ProjectNotFoundError } from '../types/errors.js';
import { can, type Capability, type ProjectAccess, type RunStatus } from '@zercade-dev/narn-shared';
import { requireTenant } from '../storage/pg/tenant-context.js';

/**
 * Cross-tenant authorization for routes addressed only by `projectId` (no tenant
 * component in the path). The PG stores are RLS-scoped by `project_members`, so
 * `loadProject(id)` under the request's tenant context returns the project iff
 * the tenant is a member — otherwise it throws `ProjectNotFoundError` (→ 404),
 * the SAME response a genuinely missing project yields, so a non-member learns
 * nothing about existence. Awaited by every by-id route before it touches
 * tenant-scoped data. (Shared origin of the backup routers' gate.)
 */
export async function assertProjectMember(id: string): Promise<void> {
  // Throws ProjectNotFoundError (404) for a non-member or a missing project —
  // identical, by design (do NOT leak existence).
  await getProjectStore().loadProject(id);
}

/**
 * Cross-tenant run-control authorization. The background-run engines are
 * process-global singletons whose in-memory run maps are keyed by `runId` ALONE,
 * with no tenant/membership check, so RLS (which protects the DB) does not cover
 * them — authorization for a run-control route has to happen here instead.
 *
 * This gate provides it by loading the run through the RLS-scoped run store
 * under the request's tenant and the path `:projectId`: `getRun` filters on both
 * `run_id` AND `project_id`, and membership RLS hides projects the caller isn't
 * in. So the row resolves IFF the caller is a member of `projectId` AND `runId`
 * actually belongs to it — a runId from another project, or a projectId the
 * caller is not a member of, both miss → {@link RunNotFoundError} (404, the same
 * as a truly missing run, so no existence leak). Call BEFORE any engine method;
 * the returned status lets the read route reuse the now-authorized run if needed.
 *
 * Also enforces the collaborator own-run rule: a `collaborator` membership only
 * sees runs it started (`run.createdBy === callerUserId`) — an owner's or
 * another collaborator's run 404s the same way a foreign-project run does, so a
 * collaborator cannot even confirm a sibling run exists. A legacy run persisted
 * before `createdBy` existed has no `createdBy`, so the `!==` comparison hides
 * it from collaborators too (it is treated as the owner's). Owners are unaffected
 * — the rule only fires for `collaborator`.
 */
export async function assertRunVisible(projectId: string, runId: string): Promise<RunStatus> {
  const run = await getRunStore().getRun(projectId, runId);
  // null = not a member of `projectId`, OR `runId` is not in this project (incl.
  // another tenant's run). Indistinguishable from a missing run, by design.
  if (!run) throw new RunNotFoundError(runId);
  const membership = await getMemberStore().getMembership(projectId);
  if (membership?.role === 'collaborator' && run.createdBy !== requireTenant().userId) {
    // Collaborators see only their own runs. Same 404 as a missing
    // run — no existence leak; legacy runs (no createdBy) are the owner's.
    throw new RunNotFoundError(runId);
  }
  return run;
}

/**
 * Resolve the caller's membership of `projectId` and demand `capability`.
 * Non-member (or missing project) → ProjectNotFoundError (404, same as
 * assertProjectMember — no existence leak). Member without the capability →
 * ForbiddenError (403). Returns the access object so handlers can run further
 * per-language checks without a second membership query.
 */
export async function assertProjectAccess(
  projectId: string,
  capability: Capability,
): Promise<ProjectAccess> {
  const membership = await getMemberStore().getMembership(projectId);
  if (!membership) throw new ProjectNotFoundError(projectId);
  const access: ProjectAccess = {
    role: membership.role,
    writableLanguages: membership.writableLanguages,
  };
  if (!can(access, capability)) throw new ForbiddenError(capability.type);
  return access;
}

/**
 * String-entry patch guard: collaborators may patch ONLY the `translations`
 * field, and only language keys they can write. Owners pass unconditionally.
 * Shared by the single-entry PUT and the bulk PATCH (strings.ts).
 */
export function assertEntryPatchAllowed(
  access: ProjectAccess,
  patch: Record<string, unknown>,
): void {
  if (access.role === 'owner') return;
  for (const key of Object.keys(patch)) {
    if (key !== 'translations') throw new ForbiddenError('manage');
  }
  const translations = (patch.translations ?? {}) as Record<string, unknown>;
  for (const language of Object.keys(translations)) {
    if (!can(access, { type: 'write-language', language })) {
      throw new ForbiddenError(`write-language:${language}`);
    }
  }
}

/**
 * Stage-details PATCH guard (routes/stage-details.ts): collaborators may
 * write ONLY per-field `translations`, and only language keys they can write;
 * `sourceText` / `maxLength` are owner-only (manage-level project content,
 * like the entry patch's non-translations fields). Owners pass
 * unconditionally, so local/open-core mode — whose sole membership is always
 * `owner` — is a no-op, exactly like {@link assertEntryPatchAllowed}. Runs
 * BEFORE any mutation: a denied request applies nothing.
 */
export function assertStageDetailsPatchAllowed(
  access: ProjectAccess,
  body: Partial<
    Record<
      string,
      { sourceText?: unknown; maxLength?: unknown; translations?: Record<string, unknown> }
    >
  >,
): void {
  if (access.role === 'owner') return;
  for (const patch of Object.values(body)) {
    if (!patch) continue;
    if (patch.sourceText !== undefined || patch.maxLength !== undefined) {
      throw new ForbiddenError('manage');
    }
    for (const language of Object.keys(patch.translations ?? {})) {
      if (!can(access, { type: 'write-language', language })) {
        throw new ForbiddenError(`write-language:${language}`);
      }
    }
  }
}

/**
 * Stage-details translate-run guard (routes/stage-details.ts `POST
 * /translate`): collaborators may only start a run scoped to languages they
 * can write. An explicit `languages` list is checked language-by-language
 * (same shape as {@link assertStageDetailsPatchAllowed}'s translations loop);
 * an OMITTED `languages` list means the run covers every active language, which
 * is manage-level scope (a collaborator can never enumerate "all languages" as
 * a set they're individually granted), so it's denied like any other
 * `manage` action. Owners pass unconditionally. Runs BEFORE `enqueue`: a
 * denied request creates no run.
 */
export function assertStageDetailsTranslateAllowed(
  access: ProjectAccess,
  body: { languages?: string[] },
): void {
  if (access.role === 'owner') return;
  if (!body.languages) throw new ForbiddenError('manage');
  for (const language of body.languages) {
    if (!can(access, { type: 'write-language', language })) {
      throw new ForbiddenError(`write-language:${language}`);
    }
  }
}

/**
 * Glossary term-PATCH guard: collaborators may patch ONLY the `translations`
 * field, and only for languages they can glossary-edit. Owners pass
 * unconditionally. Shared by both term-PATCH routes (glossary.ts) — the
 * per-glossary-id route and the legacy default-glossary route — which were
 * previously two byte-identical inline copies of this check.
 */
export function assertGlossaryTermEditAllowed(
  access: ProjectAccess,
  body: {
    source?: unknown;
    notes?: unknown;
    constant?: unknown;
    translations?: Record<string, unknown>;
  },
): void {
  if (access.role === 'owner') return;
  if (body.source !== undefined || body.notes !== undefined || body.constant !== undefined) {
    throw new ForbiddenError('manage');
  }
  const languages = Object.keys(body.translations ?? {});
  if (!can(access, { type: 'glossary-edit', languages })) {
    throw new ForbiddenError('glossary-edit');
  }
}
