/**
 * `useGlossaryGenAccept` — the shared "accept AI glossary suggestions" flow used
 * as the `onAccept` handler for every `GenerateGlossaryDialog` instance: the
 * whole-project one on the Glossary tab and the selection-scoped one opened from
 * the String Table's "AI Generation" bulk action. Extracted so the two callers
 * don't duplicate the create-glossary + create-terms + assign-to-matching-entries
 * sequence.
 *
 * Snapshots the project (fail-closed: aborts on a failed snapshot), creates each
 * accepted suggestion as a glossary with its terms, assigns the glossary to every
 * loaded entry whose source text matches one of its terms, refreshes entries, and
 * reports a summary toast. A locked vault (423) on a create/term request stops the
 * batch early (every subsequent request would also be locked) and reports partial
 * progress; other per-suggestion failures are recorded and skipped so one bad
 * suggestion doesn't abort the rest.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Glossary, GlossarySuggestion, GlossaryTerm } from '@zercade-dev/narn-shared';
import { termMatchesText } from '@zercade-dev/narn-shared';
import { apiRequest, ApiError } from './use-api.js';
import { toast } from '../lib/toast.js';
import { errorMessage } from '../lib/utils.js';
import { useStringStore } from '../stores/string-store.js';

/**
 * @param projectId the project to create/assign glossaries in
 * @param onDone    optional extra refresh to run alongside the entries reload
 *                  (e.g. GlossaryTab's own glossary-list reload) once accepted
 *                  suggestions have been persisted
 */
export function useGlossaryGenAccept(
  projectId: string,
  onDone?: () => Promise<unknown> | void,
): (suggestions: GlossarySuggestion[]) => Promise<void> {
  const { t } = useTranslation('glossary');
  const allEntries = useStringStore((s) => s.entries);
  const updateEntry = useStringStore((s) => s.updateEntry);
  const fetchEntries = useStringStore((s) => s.fetchEntries);

  return useCallback(
    async (suggestions: GlossarySuggestion[]) => {
      // Safety snapshot right before persisting accepted suggestions, so a bad
      // batch can be rolled back. Fail-closed: if the snapshot fails, surface the
      // error and create/assign nothing.
      try {
        await apiRequest(`/projects/${projectId}/backups/pre-accept`, { method: 'POST' });
      } catch (err) {
        toast.error(errorMessage(err, t('toastBackupError')));
        return;
      }

      let createdCount = 0;
      let failedCount = 0;
      let assignedCount = 0;
      // Set when a create/term POST returns 423: every subsequent request would
      // also be locked, so we stop the batch and report partial progress (the
      // shared client has already fired the unlock dialog for the first 423).
      let vaultLocked = false;
      // Accumulate per-entry glossary ids so an entry matching several new
      // glossaries gets all of them in one update (last-write-wins per entry).
      const pendingAssignments = new Map<string, Set<string>>();

      for (const suggestion of suggestions) {
        try {
          const created = await apiRequest<Glossary>(`/projects/${projectId}/glossaries`, {
            method: 'POST',
            body: JSON.stringify({ name: suggestion.name }),
          });
          // Add the glossary's terms concurrently (one round-trip each, but in
          // parallel rather than serially). Carry each term's AI-generated note
          // through to `notes` so it's persisted on the term and later used as
          // translation guidance by "Generate translations".
          await Promise.all(
            suggestion.sources.map((source) => {
              const notes = suggestion.termNotes?.[source];
              // Extracted translations (the "Include translations" generate
              // option) become the term's initial translations; absent = {}
              // as before, fillable later via "Generate term translations".
              const translations = suggestion.termTranslations?.[source] ?? {};
              return apiRequest<GlossaryTerm>(
                `/projects/${projectId}/glossaries/${created.id}/terms`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    source,
                    translations,
                    ...(notes ? { notes } : {}),
                  }),
                },
              );
            }),
          );
          createdCount++;
          for (const entry of allEntries) {
            if (suggestion.sources.some((src) => termMatchesText(src, entry.sourceText))) {
              const set = pendingAssignments.get(entry.id) ?? new Set<string>();
              set.add(created.id);
              pendingAssignments.set(entry.id, set);
            }
          }
        } catch (err) {
          // A locked vault fails every remaining request too — stop here and
          // report what landed rather than hammering the API with 423s.
          if (err instanceof ApiError && err.status === 423) {
            vaultLocked = true;
            break;
          }
          // Otherwise record the failure and keep creating the rest, so one bad
          // suggestion doesn't abort the whole batch.
          failedCount++;
        }
      }

      const entryMap = new Map(allEntries.map((e) => [e.id, e]));
      for (const [entryId, newIds] of pendingAssignments) {
        const entry = entryMap.get(entryId);
        if (!entry) continue;
        const current = entry.assignedGlossaryIds ?? [];
        const merged = Array.from(new Set([...current, ...newIds]));
        if (merged.length === current.length) continue;
        try {
          await updateEntry(projectId, entryId, { assignedGlossaryIds: merged });
          assignedCount++;
        } catch {
          // Best-effort assignment: a failed entry update shouldn't roll back the
          // glossaries already created. The user can re-assign from the Matches
          // panel below.
        }
      }

      await Promise.all([fetchEntries(projectId), onDone?.()]);

      const total = suggestions.length;
      if (vaultLocked) {
        toast.warning(t('toastGenerateVaultLocked', { created: createdCount, total }));
      } else if (failedCount > 0) {
        toast.warning(
          t('toastGeneratedPartial', {
            created: createdCount,
            total,
            failed: failedCount,
            entries: assignedCount,
          }),
        );
      } else {
        toast.success(t('toastGenerated', { glossaries: createdCount, entries: assignedCount }));
      }
    },
    [projectId, allEntries, updateEntry, fetchEntries, onDone, t],
  );
}
