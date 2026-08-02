import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useManualEditStore, type ManualEditRecord } from '../../stores/manual-edit-store.js';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { useNicknameLabels } from '../../hooks/use-nickname-labels.js';
import { apiRequest } from '../../hooks/use-api.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

interface ManualEditsViewProps {
  projectId: string;
}

// Module-level stable reference: the `editsByProject[projectId] ?? []`
// selector below needs a fallback that doesn't change identity across
// renders. A fresh `[]` literal inline would return a brand-new array
// reference every render whenever the key is absent (the store's real
// initial state, before `fetchManualEdits` resolves — i.e. every real
// mount), which makes the useSyncExternalStore snapshot unstable and
// triggers React error #185 (Maximum update depth exceeded).
const EMPTY_EDITS: ManualEditRecord[] = [];

/**
 * The Activity tab's "Manual" sub-view: every recorded manual (human) text
 * edit for the project, newest-first. Fetched from
 * `GET /api/projects/:id/manual-edits` — owners see every edit, collaborators
 * only their own (server-side scoping, mirrors `RunsTab`'s runs list).
 *
 * The "Edited by" column reuses `useNicknameLabels` — the same bulk-resolve
 * logic behind `RunsTab`'s "Triggered by" column — and is shown under the
 * same `showTriggeredBy`-style condition (owner + sharedEver): a
 * collaborator only ever sees their own edits (nothing to attribute), and an
 * owner who never shared has no one else's edits to attribute either.
 */
export function ManualEditsView({ projectId }: Readonly<ManualEditsViewProps>) {
  const { t } = useTranslation('strings');
  const edits = useManualEditStore((s) => s.editsByProject[projectId] ?? EMPTY_EDITS);
  const fetchManualEdits = useManualEditStore((s) => s.fetchManualEdits);

  const access = useProjectStore((s) => accessFor(s, projectId));
  const selfUserId = useProjectStore((s) => s.selfUserId);
  const showEditedBy = access.role === 'owner' && access.sharedEver;

  useEffect(() => {
    if (projectId) void fetchManualEdits(projectId);
  }, [projectId, fetchManualEdits]);

  const editorIds = useMemo(() => edits.map((e) => e.createdBy), [edits]);
  const { labelFor } = useNicknameLabels(editorIds, showEditedBy, selfUserId);

  // "Recording paused" hint: the server only RECORDS manual edits while the
  // project is CURRENTLY shared (>=1 active collaborator besides the owner),
  // but this view is visible whenever the project has EVER been shared — so an
  // owner viewing after every collaborator has left sees a frozen history with
  // no indication why it stopped growing. A minimal, owner-only signal: reuse
  // the same `/projects/:id/members` endpoint the Sharing tab's members list
  // already calls (no new data path) — a collaborator's own GET returns only
  // their own row via RLS, so this check is owner-only by construction as well
  // as by the `access.role` guard below.
  const [memberCount, setMemberCount] = useState<number | null>(null);
  useEffect(() => {
    if (access.role !== 'owner') {
      return;
    }
    let cancelled = false;
    apiRequest<Array<{ userId: string }>>(`/projects/${projectId}/members`)
      .then((members) => {
        if (!cancelled) setMemberCount(members.length);
      })
      .catch(() => {
        if (!cancelled) setMemberCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, access.role]);
  const recordingPaused = access.role === 'owner' && memberCount !== null && memberCount <= 1;

  const columnCount = showEditedBy ? 5 : 4;

  return (
    <div className="space-y-3">
      {recordingPaused && (
        <p className="text-xs text-muted-foreground" data-testid="manual-edits-recording-paused">
          {t('runs.manualRecordingPaused')}
        </p>
      )}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('runs.manualStringColumn')}</TableHead>
              <TableHead>{t('runs.manualLanguageColumn')}</TableHead>
              <TableHead>{t('runs.manualChangeColumn')}</TableHead>
              <TableHead>{t('runs.manualWhenColumn')}</TableHead>
              {showEditedBy && <TableHead>{t('runs.manualEditedByColumn')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {edits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                  {t('runs.manualEmptyState')}
                </TableCell>
              </TableRow>
            ) : (
              edits.map((edit) => (
                <TableRow key={edit.id} data-testid={`manual-edit-row-${edit.id}`}>
                  <TableCell
                    className="max-w-[220px] truncate font-mono text-xs"
                    title={edit.sourcePreview ?? edit.entryKey}
                    data-testid={`manual-edit-string-${edit.id}`}
                  >
                    {edit.sourcePreview ?? edit.entryKey}
                  </TableCell>
                  <TableCell data-testid={`manual-edit-language-${edit.id}`}>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {edit.language}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="whitespace-pre-wrap break-words text-xs"
                    data-testid={`manual-edit-change-${edit.id}`}
                  >
                    <span
                      className={
                        edit.beforeText != null
                          ? 'text-muted-foreground line-through'
                          : 'text-muted-foreground'
                      }
                    >
                      {edit.beforeText ?? t('runs.manualNoBeforeText')}
                    </span>
                    {' → '}
                    <span>{edit.afterText}</span>
                  </TableCell>
                  <TableCell
                    className="text-sm whitespace-nowrap"
                    data-testid={`manual-edit-when-${edit.id}`}
                  >
                    {new Date(edit.createdAt).toLocaleString()}
                  </TableCell>
                  {showEditedBy && (
                    <TableCell data-testid={`manual-edit-by-${edit.id}`}>
                      {labelFor(edit.createdBy)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
