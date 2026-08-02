import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/utils';
import { apiRequest } from '../../hooks/use-api.js';
import { resolveNicknames } from '../../lib/collab-api.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useProjectScopedFetch } from '../orphans/use-project-scoped-fetch.js';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { ConfirmSheet } from '../ui/confirm-sheet';

/** Mirrors the server's `ProjectMember` (`packages/server/src/storage/types.ts`). */
export interface ProjectMember {
  projectId: string;
  userId: string;
  role: 'owner' | 'collaborator';
  writableLanguages: string[];
  joinedAt: string; // ISO 8601
}

interface MembersSectionProps {
  readonly projectId: string;
  readonly activeLanguages: string[];
  readonly sourceLanguage: string;
}

/** Fallback display when a member has no resolved nickname: a short id prefix. */
function shortenUserId(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}

export function MembersSection({
  projectId,
  activeLanguages,
  sourceLanguage,
}: Readonly<MembersSectionProps>) {
  const { t } = useTranslation('collab');
  const selfUserId = useProjectStore((s) => s.selfUserId);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  // Locally-edited (unsaved) writable-language sets, keyed by member userId.
  // Absent entries fall back to the member's own `writableLanguages`.
  const [pendingLanguages, setPendingLanguages] = useState<Record<string, string[]>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ProjectMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchMembers = useCallback(
    (id: string) => apiRequest<ProjectMember[]>(`/projects/${id}/members`),
    [],
  );

  // One bulk nickname lookup per members load, rather than one request per
  // row. Best-effort: a failed resolve just leaves every member on the
  // shortened-userId fallback, matching `loadSharedProjectNicknames`'s
  // "cosmetic gap, not a failure worth blocking on" swallow pattern. Memoized
  // with a stable (empty) dep array — `useProjectScopedFetch`'s effect re-runs
  // whenever its `reload` callback's identity changes, and `reload` depends on
  // this `onLoad`, so an unstable reference here would refetch on every
  // render.
  const handleMembersLoaded = useCallback((loaded: ProjectMember[]) => {
    const userIds = loaded.map((m) => m.userId);
    if (userIds.length === 0) return;
    resolveNicknames(userIds)
      .then((resolved) => setNicknames(resolved))
      .catch((err: unknown) => {
        console.error('[MembersSection] resolveNicknames failed:', err);
      });
  }, []);

  const {
    data: members,
    setData: setMembers,
    loading,
  } = useProjectScopedFetch<ProjectMember[]>(projectId, fetchMembers, [], {
    onLoad: handleMembersLoaded,
  });

  // The language grant choices a collaborator can be given: every active
  // language except the source (never writable by a collaborator — enforced
  // again server-side by the PATCH route).
  const writableLanguageChoices = activeLanguages.filter((lang) => lang !== sourceLanguage);

  const languagesFor = (member: ProjectMember): string[] =>
    pendingLanguages[member.userId] ?? member.writableLanguages;

  const nicknameFor = (member: ProjectMember): string =>
    nicknames[member.userId] ?? shortenUserId(member.userId);

  const toggleLanguage = (member: ProjectMember, lang: string, checked: boolean) => {
    const current = new Set(languagesFor(member));
    if (checked) current.add(lang);
    else current.delete(lang);
    setPendingLanguages((prev) => ({ ...prev, [member.userId]: [...current] }));
  };

  // Every writable choice already granted → the button reads/acts as
  // "unselect all" (clears the set); otherwise it grants every choice.
  const allLanguagesSelected = (member: ProjectMember): boolean =>
    writableLanguageChoices.length > 0 &&
    writableLanguageChoices.every((lang) => languagesFor(member).includes(lang));

  const toggleAllLanguages = (member: ProjectMember) => {
    const next = allLanguagesSelected(member) ? [] : [...writableLanguageChoices];
    setPendingLanguages((prev) => ({ ...prev, [member.userId]: next }));
  };

  const handleSave = async (member: ProjectMember) => {
    setSavingUserId(member.userId);
    try {
      const updated = await apiRequest<ProjectMember>(
        `/projects/${projectId}/members/${member.userId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ writableLanguages: languagesFor(member) }),
        },
      );
      setMembers((prev) => prev.map((m) => (m.userId === member.userId ? updated : m)));
      setPendingLanguages((prev) => {
        const next = { ...prev };
        delete next[member.userId];
        return next;
      });
      toast.success(t('sharing.memberUpdated'));
    } catch (err) {
      toast.error(t('sharing.memberUpdateFailed', { message: getErrorMessage(err) }));
    } finally {
      setSavingUserId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoving(true);
    try {
      await apiRequest(`/projects/${projectId}/members/${target.userId}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter((m) => m.userId !== target.userId));
      toast.success(t('sharing.memberRemoved'));
    } catch (err) {
      toast.error(t('sharing.memberRemoveFailed', { message: getErrorMessage(err) }));
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sharing.membersTitle')}</CardTitle>
        <CardDescription>{t('sharing.membersDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">{t('sharing.membersLoading')}</p>}
        {!loading && members.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="members-empty">
            {t('sharing.membersEmpty')}
          </p>
        )}
        {!loading && members.length > 0 && (
          <Table data-testid="members-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t('sharing.columnMember')}</TableHead>
                <TableHead>{t('sharing.columnJoined')}</TableHead>
                <TableHead>{t('sharing.columnLanguages')}</TableHead>
                <TableHead className="text-right">{t('sharing.columnActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.userId === selfUserId;
                return (
                  <TableRow key={member.userId} data-testid={`member-row-${member.userId}`}>
                    <TableCell data-testid={`member-nickname-${member.userId}`}>
                      {isSelf ? t('sharing.you') : `@${nicknameFor(member)}`}
                    </TableCell>
                    <TableCell>{new Date(member.joinedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {isSelf ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
                            disabled={savingUserId === member.userId}
                            data-testid={`member-lang-select-all-${member.userId}`}
                            onClick={() => toggleAllLanguages(member)}
                          >
                            {allLanguagesSelected(member)
                              ? t('sharing.unselectAllLanguages')
                              : t('sharing.selectAllLanguages')}
                          </button>
                          {writableLanguageChoices.map((lang) => (
                            <span key={lang} className="inline-flex items-center gap-1.5">
                              <Checkbox
                                id={`member-lang-${member.userId}-${lang}`}
                                checked={languagesFor(member).includes(lang)}
                                onCheckedChange={(checked) =>
                                  toggleLanguage(member, lang, checked === true)
                                }
                                disabled={savingUserId === member.userId}
                                data-testid={`member-lang-checkbox-${member.userId}-${lang}`}
                              />
                              <Label
                                htmlFor={`member-lang-${member.userId}-${lang}`}
                                className="cursor-pointer select-none font-normal"
                              >
                                {lang}
                              </Label>
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isSelf && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleSave(member)}
                            disabled={savingUserId === member.userId}
                            data-testid={`member-save-btn-${member.userId}`}
                          >
                            {savingUserId === member.userId
                              ? t('sharing.saving')
                              : t('sharing.save')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRemoveTarget(member)}
                            data-testid={`member-remove-btn-${member.userId}`}
                          >
                            {t('sharing.remove')}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ConfirmSheet
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={t('sharing.removeConfirmTitle')}
        description={t('sharing.removeConfirmBody', {
          name: removeTarget ? nicknameFor(removeTarget) : '',
        })}
        confirmLabel={removing ? t('sharing.removing') : t('sharing.removeConfirm')}
        confirmDisabled={removing}
        cancelDisabled={removing}
        onConfirm={() => void handleConfirmRemove()}
        cancelLabel={t('sharing.removeCancel')}
        cancelTestId="member-remove-cancel"
        confirmTestId="member-remove-confirm"
      />
    </Card>
  );
}
