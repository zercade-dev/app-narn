import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { Download } from 'lucide-react';
import { cn, getErrorMessage } from '@/lib/utils';
import { apiRequest } from '../../hooks/use-api.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { useProjectScopedFetch } from '../orphans/use-project-scoped-fetch.js';
import { Button, buttonVariants } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ConfirmSheet } from '../ui/confirm-sheet';

interface CreateBackupResponse {
  id: string;
  filename: string;
  downloadUrl: string;
  createdAt: string;
}

/** Mirrors the server's backup trigger taxonomy (modules/backup-trigger.ts). */
const TRIGGER_ORDER = ['manual', 'pre-import', 'pre-retranslate', 'pre-accept'] as const;
type BackupTrigger = (typeof TRIGGER_ORDER)[number];

const TRIGGER_LABEL_KEYS: Record<BackupTrigger, string> = {
  manual: 'triggerManual',
  'pre-import': 'triggerPreImport',
  'pre-retranslate': 'triggerPreRetranslate',
  'pre-accept': 'triggerPreAccept',
};

interface BackupEntry {
  /** Opaque store id — the addressing key for manifest/restore/delete. */
  id: string;
  /** Cosmetic, server-generated name for the download link + testids only. */
  filename: string;
  downloadUrl: string;
  createdAt: string;
  /** Absent on responses from older servers — treated as manual. */
  trigger?: BackupTrigger;
}

interface BackupManifest {
  projectId: string;
  createdAt: string;
  files: Array<{ path: string; size: number }>;
}

interface ListBackupsResponse {
  files: BackupEntry[];
}

interface RestoreResponse {
  projectId: string;
  filesRestored: number;
}

interface BackupTabProps {
  readonly projectId: string;
}

export function BackupTab({ projectId }: Readonly<BackupTabProps>) {
  const { t } = useTranslation('backup');
  const [creating, setCreating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [serverRestoreEntry, setServerRestoreEntry] = useState<BackupEntry | null>(null);
  const [serverRestoreManifest, setServerRestoreManifest] = useState<BackupManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<BackupEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backups list fetch is project-scoped: a project change re-fetches and the
  // explicit reloads after create/delete pass nothing (never stale). List fetch
  // errors are swallowed — the backups directory may not exist yet.
  const fetchBackups = useCallback(
    (id: string) => apiRequest<ListBackupsResponse>(`/projects/${id}/backups`).then((r) => r.files),
    [],
  );
  const {
    data: backups,
    loading: loadingList,
    setLoading: setLoadingList,
    reload: loadBackups,
  } = useProjectScopedFetch<BackupEntry[]>(projectId, fetchBackups, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await apiRequest<CreateBackupResponse>(`/projects/${projectId}/backups`, {
        method: 'POST',
      });
      toast.success(t('toastBackupCreated'));
      setLoadingList(true);
      await loadBackups();
    } catch (err) {
      toast.error(t('toastBackupFailed', { message: getErrorMessage(err) }));
    } finally {
      setCreating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleConfirmRestore = async () => {
    if (!selectedFile) {
      setConfirmOpen(false);
      return;
    }
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const result = await apiRequest<RestoreResponse>('/backup/restore', {
        method: 'POST',
        body: formData,
      });
      toast.success(t('toastRestoreSuccess'));
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // A restore overwrites the restored project's config/languages/strings
      // server-side; without this, those stay stale in the client stores until
      // a manual reload. Best-effort (fire-and-forget): a failed refresh here
      // must not turn an already-successful restore into a reported failure.
      void useProjectStore.getState().fetchProjects();
      void useStringStore.getState().fetchEntries(result.projectId);
    } catch (err) {
      toast.error(t('toastRestoreFailed', { message: getErrorMessage(err) }));
    } finally {
      setRestoring(false);
      setConfirmOpen(false);
    }
  };

  const handleOpenServerRestore = async (entry: BackupEntry) => {
    setServerRestoreManifest(null);
    setServerRestoreEntry(entry);
    setLoadingManifest(true);
    try {
      const manifest = await apiRequest<BackupManifest>(
        `/projects/${projectId}/backups/${entry.id}/manifest`,
      );
      setServerRestoreManifest(manifest);
    } catch {
      // Preview is best-effort — open confirmation without details
    } finally {
      setLoadingManifest(false);
    }
  };

  const handleConfirmServerRestore = async () => {
    if (!serverRestoreEntry) {
      setServerRestoreEntry(null);
      return;
    }
    setRestoring(true);
    try {
      await apiRequest<RestoreResponse>(
        `/projects/${projectId}/backups/${serverRestoreEntry.id}/restore`,
        { method: 'POST' },
      );
      toast.success(t('toastRestoreSuccess'));
      // Same client-state refresh as the file-upload restore path above — see
      // that comment. This restore is always scoped to the current `projectId`.
      void useProjectStore.getState().fetchProjects();
      void useStringStore.getState().fetchEntries(projectId);
    } catch (err) {
      toast.error(t('toastRestoreFailed', { message: getErrorMessage(err) }));
    } finally {
      setRestoring(false);
      setServerRestoreEntry(null);
      setServerRestoreManifest(null);
    }
  };

  // Group snapshots by trigger: manual backups first, then the automatic
  // pre-import / pre-retranslate safety snapshots.
  const groupedBackups = TRIGGER_ORDER.map((trigger) => ({
    trigger,
    items: backups.filter((b) => (b.trigger ?? 'manual') === trigger),
  })).filter((group) => group.items.length > 0);

  // "Restore to just before the import of <date>" affordance for auto snapshots.
  const itemLabel = (b: BackupEntry): string => {
    const date = new Date(b.createdAt).toLocaleString();
    if (b.trigger === 'pre-import') return t('itemPreImport', { date });
    if (b.trigger === 'pre-retranslate') return t('itemPreRetranslate', { date });
    return date;
  };

  const handleConfirmDelete = async () => {
    if (!deleteEntry) {
      setDeleteEntry(null);
      return;
    }
    setDeleting(true);
    try {
      await apiRequest(`/projects/${projectId}/backups/${deleteEntry.id}`, { method: 'DELETE' });
      toast.success(t('toastDeleteSuccess'));
      setLoadingList(true);
      await loadBackups();
    } catch (err) {
      toast.error(t('toastDeleteFailed', { message: getErrorMessage(err) }));
    } finally {
      setDeleting(false);
      setDeleteEntry(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <h2 className="text-xl font-semibold">{t('title')}</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('createSection')}</CardTitle>
            <CardDescription>{t('createDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleCreateBackup}
              disabled={creating}
              data-testid="backup-create-btn"
            >
              {creating ? t('creating') : t('createButton')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('restoreSection')}</CardTitle>
            <CardDescription>{t('restoreDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="backup-restore-file">{t('restoreSelectFile')}</Label>
              <Input
                id="backup-restore-file"
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleFileChange}
                data-testid="backup-restore-input"
              />
            </div>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!selectedFile || restoring}
              data-testid="backup-restore-btn"
            >
              {restoring ? t('restoring') : t('restoreButton')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('backupsListSection')}</CardTitle>
          <CardDescription>{t('backupsListDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList && (
            <p className="text-sm text-muted-foreground">{t('backupsListLoading')}</p>
          )}
          {!loadingList && backups.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="backup-no-backups">
              {t('backupsListEmpty')}
            </p>
          )}
          {!loadingList && backups.length > 0 && (
            <div className="space-y-4" data-testid="backup-list">
              {groupedBackups.map(({ trigger, items }) => (
                <div key={trigger} data-testid={`backup-group-${trigger}`}>
                  <h4 className="mb-2 text-sm font-medium">{t(TRIGGER_LABEL_KEYS[trigger])}</h4>
                  <ul className="space-y-2">
                    {items.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm"
                        data-testid="backup-list-item"
                      >
                        <span className="truncate text-muted-foreground">{itemLabel(b)}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleOpenServerRestore(b)}
                            disabled={restoring}
                            data-testid="backup-server-restore-btn"
                          >
                            {t('restoreButton')}
                          </Button>
                          <a
                            href={b.downloadUrl}
                            download={b.filename}
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                            data-testid="backup-download-link"
                            aria-label={t('downloadAria', { filename: b.filename })}
                            title={t('downloadAria', { filename: b.filename })}
                          >
                            <Download className="size-3.5" />
                            {t('download')}
                          </a>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteEntry(b)}
                            disabled={deleting}
                            data-testid="backup-delete-btn"
                          >
                            {t('deleteButton')}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('confirmTitle')}
        description={t('confirmBody')}
        confirmLabel={t('confirmConfirm')}
        confirmDisabled={restoring}
        cancelDisabled={restoring}
        onConfirm={handleConfirmRestore}
        cancelLabel={t('confirmCancel')}
        cancelTestId="backup-restore-cancel"
        confirmTestId="backup-restore-confirm"
      />

      <ConfirmSheet
        open={serverRestoreEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setServerRestoreEntry(null);
            setServerRestoreManifest(null);
          }
        }}
        title={t('confirmTitle')}
        description={t('confirmBody')}
        confirmLabel={t('confirmConfirm')}
        confirmDisabled={restoring}
        cancelDisabled={restoring}
        onConfirm={handleConfirmServerRestore}
        cancelLabel={t('confirmCancel')}
        cancelTestId="backup-server-restore-cancel"
        confirmTestId="backup-server-restore-confirm"
      >
        {loadingManifest && (
          <p className="px-4 py-2 text-sm text-muted-foreground">{t('previewLoading')}</p>
        )}
        {!loadingManifest && serverRestoreManifest && (
          <div className="px-4 py-2 text-sm space-y-1 border rounded-md mx-4 mt-2 bg-muted/40">
            <p>
              <span className="font-medium">{t('previewProject')}</span>{' '}
              {serverRestoreManifest.projectId}
            </p>
            <p>
              <span className="font-medium">{t('previewFiles')}</span>{' '}
              {serverRestoreManifest.files.length}
            </p>
            <p>
              <span className="font-medium">{t('previewCreatedAt')}</span>{' '}
              {new Date(serverRestoreManifest.createdAt).toLocaleString()}
            </p>
          </div>
        )}
      </ConfirmSheet>

      <ConfirmSheet
        open={deleteEntry !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteEntry(null);
        }}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmBody')}
        confirmLabel={deleting ? t('deleting') : t('deleteConfirm')}
        confirmDisabled={deleting}
        cancelDisabled={deleting}
        onConfirm={handleConfirmDelete}
        cancelLabel={t('confirmCancel')}
        cancelTestId="backup-delete-cancel"
        confirmTestId="backup-delete-confirm"
      />
    </div>
  );
}
