import { runWithTenant } from './pg/tenant-context.js';
// Import the store accessors from the registry, NOT the `index.js` barrel: the
// barrel re-exports THIS file (so cloud code can import `collectTenantExport`
// from the whitelisted `@zercade-dev/narn-server/storage`), and importing it
// back here would create a circular import at module-eval time.
import {
  getProjectStore,
  getStringStore,
  getRunStore,
  getGlossaryStore,
  getTemplateStore,
  getTranslationMemory,
  getGlobalConfigStore,
  getMemberStore,
} from './registry.js';
// SIDECAR_KINDS/SidecarKind are the single canonical list of per-run sidecar
// payloads (see pg-run-store.ts) — imported here (not re-listed) so this file
// can't independently drift from it. See SIDECAR_EXPORT_FIELD/SIDECAR_GETTER
// below for how that canonical list drives this file's exhaustiveness.
import { SIDECAR_KINDS, type SidecarKind } from './pg-run-store.js';
import type { RunStore } from './types.js';

/**
 * One run's sidecar payloads, keyed by the EXPORT field name (camelCase; the
 * `SidecarKind` strings are kebab-case) — see {@link SIDECAR_EXPORT_FIELD}.
 */
interface RunSidecarExport {
  details: unknown; // RunStore.getRunDetails
  verdicts: unknown; // RunStore.getVerdicts
  judgeLogs: unknown; // RunStore.getJudgeLogs
  sourceReview: unknown; // RunStore.getSourceReview
  glossarySuggestions: unknown; // RunStore.getGlossarySuggestions
  categorySuggestions: unknown; // RunStore.getCategorySuggestions
  relinkRetranslate: unknown; // RunStore.getRelinkRetranslate
}

/**
 * One tenant's data, aggregated into a single JSON-serializable object. The shape
 * is intentionally `unknown`-typed at the leaves: this is a verbatim dump of what
 * the read stores return, not a re-modelled view, so it stays correct as those
 * payloads evolve. `exportVersion` lets a future importer branch on the layout.
 *
 * Deliberately EXCLUDED (never read here): the vault and per-device `device_vaults`
 * (secret material — re-enrolled, never exported), `project_backups` (large, and
 * themselves derivable from this same data), `policy_acceptances` (an audit
 * record of the account, not the account's content), and `notifications`
 * (operational messages, not user content worth exporting).
 *
 * Runs are further scoped by the collaborator-own-run rule mirrored from
 * `assertRunVisible` in `middleware/authz.ts`: a project's
 * `strings`/`glossaries`/project fields are member-readable in full
 * regardless of role (the product's documented "read-only" model for
 * non-owned languages), but `runs` — and every sidecar attached to them
 * (verdicts, judge logs, source reviews, glossary/category suggestions,
 * relink-retranslate) — are visible to a `collaborator` member ONLY for runs
 * they started. Unlike `strings`/`glossaries`, RLS does not enforce this (it
 * only gates on project membership), so `collectTenantExport` applies the
 * same filter the route layer applies, or a collaborator's own export would
 * leak the owner's (and other collaborators') run history.
 */
export interface TenantExport {
  exportVersion: 1;
  userId: string;
  projects: Array<{
    project: unknown; // ProjectStore.loadProject
    strings: unknown; // StringStore.load
    glossaries: unknown[]; // GlossaryStore.getGlossary (full detail incl. terms) per summary
    runs: Array<{ run: unknown } & RunSidecarExport>; // run: RunStatus
  }>;
  translationMemory: unknown[]; // TranslationMemory.list
  templates: unknown[]; // TemplateStore.listTemplates
  globalConfig: unknown; // GlobalConfigStore.load
}

/**
 * Compile-time exhaustiveness guard: maps every canonical `SidecarKind` (from
 * `pg-run-store.ts`) to the export field name it fills on
 * {@link RunSidecarExport}. Because this is typed
 * `Record<SidecarKind, …>`, adding an 8th kind to `SIDECAR_KINDS` makes this
 * file FAIL TO COMPILE until a field name is added here — the same drift
 * class that let `judge-logs`/`relink-retranslate` silently miss an earlier
 * hand-maintained copy of the sidecar list (see
 * a sidecar-kind parity test). `readRunSidecars` below BUILDS
 * the per-run object by mapping over `SIDECAR_KINDS` through this table
 * (rather than hand-listing the seven fields), so the guard is structural,
 * not just a type-level trip-wire that could be worked around.
 */
const SIDECAR_EXPORT_FIELD: Record<SidecarKind, keyof RunSidecarExport> = {
  details: 'details',
  verdicts: 'verdicts',
  'judge-logs': 'judgeLogs',
  'source-review': 'sourceReview',
  'glossary-suggestions': 'glossarySuggestions',
  'category-suggestions': 'categorySuggestions',
  'relink-retranslate': 'relinkRetranslate',
};

/**
 * Companion to {@link SIDECAR_EXPORT_FIELD}: the `RunStore` getter that reads
 * each canonical kind. Also `Record<SidecarKind, …>` — same compile-time
 * exhaustiveness — so a new kind needs both its field name AND its reader
 * wired here before the file compiles again.
 */
const SIDECAR_GETTER: Record<
  SidecarKind,
  (runStore: RunStore, projectId: string, runId: string) => Promise<unknown>
> = {
  details: (rs, projectId, runId) => rs.getRunDetails(projectId, runId),
  verdicts: (rs, projectId, runId) => rs.getVerdicts(projectId, runId),
  'judge-logs': (rs, projectId, runId) => rs.getJudgeLogs(projectId, runId),
  'source-review': (rs, projectId, runId) => rs.getSourceReview(projectId, runId),
  'glossary-suggestions': (rs, projectId, runId) => rs.getGlossarySuggestions(projectId, runId),
  'category-suggestions': (rs, projectId, runId) => rs.getCategorySuggestions(projectId, runId),
  'relink-retranslate': (rs, projectId, runId) => rs.getRelinkRetranslate(projectId, runId),
};

/**
 * Reads every sidecar for one run, keyed by its export field name. Iterates
 * `SIDECAR_KINDS` (the canonical list) through {@link SIDECAR_GETTER}/
 * {@link SIDECAR_EXPORT_FIELD} rather than hand-listing the seven reads, so a
 * run's export object always has an entry for every kind the run store
 * persists — a future 8th kind is included automatically once it's wired into
 * the two tables above (and the file won't compile until it is).
 */
async function readRunSidecars(
  runStore: RunStore,
  projectId: string,
  runId: string,
): Promise<RunSidecarExport> {
  const entries = await Promise.all(
    SIDECAR_KINDS.map(async (kind) => {
      const value = await SIDECAR_GETTER[kind](runStore, projectId, runId);
      return [SIDECAR_EXPORT_FIELD[kind], value] as const;
    }),
  );
  return Object.fromEntries(entries) as unknown as RunSidecarExport;
}

/**
 * Collect every piece of `userId`'s exportable content into one in-memory object.
 *
 * Read-only: it never writes. It runs the whole aggregation inside
 * `runWithTenant({ userId })`, so each store read goes through the RLS-scoped
 * `TenantDb` path and returns ONLY this tenant's rows — there is no WHERE clause
 * to get wrong and no way to widen the blast radius from the app layer. A second
 * tenant's rows in the same database are simply invisible.
 *
 * Refuses an empty/blank `userId` up front: a blank `app.user_id` GUC is the one
 * value the RLS policies treat as "match nothing", so guarding it avoids an
 * empty-export-that-looks-like-success.
 */
export async function collectTenantExport(userId: string): Promise<TenantExport> {
  if (!userId || !userId.trim()) throw new Error('collectTenantExport: empty userId');

  return runWithTenant({ userId }, async () => {
    const projectStore = getProjectStore();
    const stringStore = getStringStore();
    const runStore = getRunStore();
    const glossaryStore = getGlossaryStore();

    const projectList = await projectStore.listProjects();
    const projects: TenantExport['projects'] = [];

    for (const summary of projectList) {
      const id = summary.id;
      const [project, strings, glossarySummaries, runList, membership] = await Promise.all([
        projectStore.loadProject(id),
        stringStore.load(id),
        glossaryStore.listGlossaries(id),
        runStore.listRuns(id),
        getMemberStore().getMembership(id),
      ]);

      // Resolve each glossary's full detail (listGlossaries returns summaries
      // without the terms); a full export needs the terms.
      const glossaries = await Promise.all(
        glossarySummaries.map((g) => glossaryStore.getGlossary(id, g.id)),
      );

      // Collaborator-own-run rule (see the TenantExport doc comment above) —
      // a legacy run with no createdBy is treated as the owner's, same as
      // assertRunVisible, so it is excluded here too.
      const visibleRunList =
        membership?.role === 'collaborator'
          ? runList.filter((run) => run.createdBy === userId)
          : runList;

      const runs = await Promise.all(
        visibleRunList.map(async (run) => {
          const sidecars = await readRunSidecars(runStore, id, run.runId);
          return { run, ...sidecars };
        }),
      );

      projects.push({ project, strings, glossaries, runs });
    }

    const [translationMemory, templates, globalConfig] = await Promise.all([
      getTranslationMemory().list(),
      getTemplateStore().listTemplates(),
      getGlobalConfigStore().load(),
    ]);

    return {
      exportVersion: 1,
      userId,
      projects,
      translationMemory,
      templates,
      globalConfig,
    };
  });
}
