import { getStringStore } from '../storage/registry.js';
import { assignGlossaryIds } from './M20-glossary-assigner.js';
import { logger } from './M15-console-logger.js';
import {
  getCurrentTenant,
  runWithTenant,
  type TenantContext,
} from '../storage/pg/tenant-context.js';

/**
 * Service to handle background synchronization of glossary assignments.
 * This is triggered when glossaries are changed or when a project is loaded
 * to ensure the 'assignedGlossaryIds' field in StringEntries remains up to date.
 */
export class GlossarySyncService {
  private syncPromises = new Map<string, Promise<void>>();
  // Set when syncProject is called while a sync is already in flight; the
  // running sync re-runs once after it settles so rapid-fire edits during a
  // sync aren't silently dropped.
  private dirty = new Set<string>();

  /**
   * Trigger an asynchronous sync for the given project.
   * Multiple calls for the same project are coalesced: a call made while a
   * sync is in flight marks the project dirty, and exactly one extra sync runs
   * once the current one settles (further calls collapse into that re-run).
   */
  syncProject(projectId: string): void {
    // Capture the tenant on the request thread (context active here) so the
    // detached `(async () => { … })()` body — which runs AFTER this request
    // returns — re-establishes it (each detached body is its own tenant seam)
    // and its `getStringStore().mutateAll` + `assignGlossaryIds` stay
    // tenant-scoped. Capturing here (not inside the closure) means the same
    // tenant flows into the `finally`-chained coalesced re-run, which fires off
    // any request context once the in-flight sync settles.
    const tenant = getCurrentTenant();
    if (this.syncPromises.has(projectId)) {
      // A sync is already running — record that another is needed and let the
      // in-flight one re-run once it finishes, rather than dropping the change.
      this.dirty.add(projectId);
      return;
    }
    this.startSync(projectId, tenant);
  }

  private startSync(projectId: string, tenant: TenantContext | undefined): void {
    // Re-establish the captured tenant around the whole detached body so its
    // `getStringStore().mutateAll` + `assignGlossaryIds` (which run after the
    // request returns) stay tenant-scoped. The captured tenant is also threaded
    // into the `finally`-chained coalesced re-run, which fires off any request
    // context. When no tenant was captured (trigger fired with no ambient
    // context) the body runs bare and stays fail-closed — `requireTenant()` then
    // throws inside, caught and logged below — rather than fabricating a tenant.
    const body = async (): Promise<void> => {
      try {
        // Load→assign→save through the per-project write lock so a concurrent
        // locked translation write (e.g. setTranslation during a run) can't
        // land between the load and the save and be overwritten by this stale
        // snapshot. assignGlossaryIds mutates the entries in place.
        let count = 0;
        let glossariesSkipped = 0;
        await getStringStore().mutateAll(projectId, async (entries) => {
          count = entries.length;
          if (entries.length === 0) return entries;
          ({ glossariesSkipped } = await assignGlossaryIds(projectId, entries));
          return entries;
        });
        if (count === 0) return;

        logger.info('Glossaries synced for project', {
          projectId,
          count,
          glossariesSkipped,
        });
      } catch (err) {
        logger.error('Failed to sync glossaries', { projectId, error: String(err) });
      } finally {
        // Coalesced changes arrived during this sync — chain one re-run to
        // catch up. Hand off atomically: start the re-run (which overwrites
        // this project's map entry with the new in-flight promise) BEFORE
        // clearing the old one, so `syncPromises` is never empty across the
        // handoff. An empty window would let `awaitSync`'s poll return early
        // and a concurrent `syncProject` start its own duplicate sync. The
        // re-run re-applies the SAME captured tenant (it runs off any request
        // context, so a fresh getCurrentTenant() there could be empty).
        if (this.dirty.delete(projectId)) {
          this.startSync(projectId, tenant);
        } else {
          this.syncPromises.delete(projectId);
        }
      }
    };

    const promise = tenant ? runWithTenant(tenant, body) : body();

    this.syncPromises.set(projectId, promise);
  }

  /**
   * Block until the project is fully settled — including any coalesced re-run
   * the in-flight sync chained on for changes that arrived mid-sync.
   */
  async awaitSync(projectId: string): Promise<void> {
    // Capture the promise once per iteration so the awaited value can never be
    // `undefined` (a separate has/get pair could read different map states).
    for (;;) {
      const p = this.syncPromises.get(projectId);
      if (!p) break;
      await p;
    }
  }
}

export const glossarySyncService = new GlossarySyncService();
