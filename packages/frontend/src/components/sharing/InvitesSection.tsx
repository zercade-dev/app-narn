import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn, getErrorMessage } from '@/lib/utils';
import {
  CollabApiError,
  createInvite,
  getNickname,
  listInvites,
  revokeInvite,
  type InviteRecord,
} from '../../lib/collab-api.js';
import { useViewStore } from '../../stores/view-store.js';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';

interface InvitesSectionProps {
  readonly projectId: string;
}

type InviteStatus = 'pending' | 'redeemed' | 'revoked' | 'expired';

function statusFor(invite: InviteRecord): InviteStatus {
  if (invite.redeemedAt) return 'redeemed';
  if (invite.revokedAt) return 'revoked';
  if (new Date(invite.expiresAt).getTime() < Date.now()) return 'expired';
  return 'pending';
}

/**
 * Invite-code management for the Sharing tab: generating one-use codes
 * (shown exactly once) and reviewing/revoking a project's invite history.
 * Gated on the caller having claimed a nickname (`getNickname()`), which the
 * server also enforces on `createInvite` (`CollabApiError('nickname_required')`)
 * — the client-side callout just avoids a guaranteed-to-fail round trip.
 */
/** Whether the caller's nickname is known yet: `'loading'` until the initial
 * fetch settles, `'unknown'` if it FAILED (never resolved — see the
 * `nicknameResult` handling below), or `'loaded'` once `nickname` reflects
 * the server's answer (claimed value or `null`). Kept distinct from
 * `'unknown'` so a `getNickname()` failure can't be confused with a
 * successfully-resolved "no nickname yet" — the two used to collapse into
 * the same `nickname === null` state, which made a `listInvites` failure
 * (under the old combined `Promise.all`) falsely trigger the
 * nickname-required callout for users who actually have a nickname. */
type NicknameStatus = 'loading' | 'unknown' | 'loaded';

export function InvitesSection({ projectId }: Readonly<InvitesSectionProps>) {
  const { t } = useTranslation('collab');
  const setView = useViewStore((s) => s.setView);
  const [nickname, setNickname] = useState<string | null>(null);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('loading');
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [invitesLoadError, setInvitesLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Reset the loading/nickname-status flags during render when the project
  // changes (mirrors `useProjectScopedFetch`'s idiom); the effect below
  // re-fetches. Keeps the synchronous setState out of the effect body, which
  // `react-hooks/set-state-in-effect` flags as cascading-render-prone.
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setLoading(true);
    setInvitesLoadError(false);
    setNicknameStatus('loading');
  }

  useEffect(() => {
    let cancelled = false;
    // `allSettled` (not `all`) so a `listInvites` failure can't blank out an
    // already-successful `getNickname()` result (or vice versa) — each
    // outcome is handled independently below.
    Promise.allSettled([listInvites(projectId), getNickname()]).then(
      ([invitesResult, nicknameResult]) => {
        if (cancelled) return;
        if (invitesResult.status === 'fulfilled') {
          setInvites(invitesResult.value);
          setInvitesLoadError(false);
        } else {
          setInvitesLoadError(true);
          toast.error(
            t('invites.invitesLoadFailed', { message: getErrorMessage(invitesResult.reason) }),
          );
        }
        if (nicknameResult.status === 'fulfilled') {
          setNickname(nicknameResult.value);
          setNicknameStatus('loaded');
        } else {
          // Nickname unknown: leave `nicknameStatus` at 'unknown' rather than
          // guessing `null` — the render below shows neither the
          // nickname-required callout nor the generate button in this case.
          setNicknameStatus('unknown');
        }
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [projectId, t]);

  /** Maps a `CollabApiError` code to its specific toast; anything else (or a
   * non-CollabApiError) falls back to a generic message under `fallbackKey`. */
  const reportError = (err: unknown, fallbackKey: string) => {
    if (err instanceof CollabApiError) {
      if (err.code === 'nickname_required') {
        toast.error(t('invites.errorNicknameRequired'));
        return;
      }
      if (err.code === 'too_many_pending_invites') {
        toast.error(t('invites.errorTooManyPendingInvites'));
        return;
      }
    }
    toast.error(t(fallbackKey, { message: getErrorMessage(err) }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { code, invite } = await createInvite(projectId);
      setInvites((prev) => [invite, ...prev]);
      setNewCode(code);
    } catch (err) {
      reportError(err, 'invites.generateFailed');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (invite: InviteRecord) => {
    setRevokingId(invite.id);
    try {
      await revokeInvite(projectId, invite.id);
      setInvites((prev) =>
        prev.map((i) => (i.id === invite.id ? { ...i, revokedAt: new Date().toISOString() } : i)),
      );
      toast.success(t('invites.inviteRevoked'));
    } catch (err) {
      reportError(err, 'invites.revokeFailed');
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = async () => {
    if (!newCode) return;
    try {
      await navigator.clipboard.writeText(newCode);
      toast.success(t('invites.codeCopied'));
    } catch {
      // Clipboard access can fail (permissions/insecure context) — the code
      // stays visible and selectable in the dialog either way.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('invites.title')}</CardTitle>
        <CardDescription>{t('invites.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {nicknameStatus === 'loaded' && nickname === null ? (
          <div
            className="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
            data-testid="nickname-required-callout"
          >
            {t('invites.nicknameRequiredBody')}{' '}
            <button
              type="button"
              className="text-foreground underline"
              onClick={() => setView('account')}
              data-testid="nickname-required-link"
            >
              {t('invites.nicknameRequiredLink')}
            </button>
          </div>
        ) : nicknameStatus === 'loaded' ? (
          <Button
            onClick={() => void handleGenerate()}
            disabled={generating}
            data-testid="generate-invite-btn"
          >
            {generating ? t('invites.generating') : t('invites.generateButton')}
          </Button>
        ) : null}

        {loading && <p className="text-sm text-muted-foreground">{t('invites.loading')}</p>}
        {!loading && invitesLoadError && (
          <p className="text-sm text-destructive" data-testid="invites-load-error">
            {t('invites.loadErrorState')}
          </p>
        )}
        {!loading && !invitesLoadError && invites.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="invites-empty">
            {t('invites.empty')}
          </p>
        )}
        {!loading && !invitesLoadError && invites.length > 0 && (
          <Table data-testid="invites-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t('invites.columnCreated')}</TableHead>
                <TableHead>{t('invites.columnExpires')}</TableHead>
                <TableHead>{t('invites.columnStatus')}</TableHead>
                <TableHead className="text-right">{t('invites.columnActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => {
                const status = statusFor(invite);
                const isPending = status === 'pending';
                return (
                  <TableRow
                    key={invite.id}
                    data-testid={`invite-row-${invite.id}`}
                    className={cn(!isPending && 'opacity-50')}
                  >
                    <TableCell>{new Date(invite.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{new Date(invite.expiresAt).toLocaleString()}</TableCell>
                    <TableCell data-testid={`invite-status-${invite.id}`}>
                      {t(`invites.status.${status}`)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isPending && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleRevoke(invite)}
                          disabled={revokingId === invite.id}
                          data-testid={`invite-revoke-btn-${invite.id}`}
                        >
                          {revokingId === invite.id ? t('invites.revoking') : t('invites.revoke')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={newCode !== null} onOpenChange={(open) => !open && setNewCode(null)}>
        <DialogContent data-testid="invite-code-dialog">
          <DialogHeader>
            <DialogTitle>{t('invites.codeDialogTitle')}</DialogTitle>
            <DialogDescription>{t('invites.codeShownOnce')}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <code className="flex-1 font-mono text-sm" data-testid="invite-code-value">
              {newCode}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleCopy()}
              data-testid="invite-code-copy"
            >
              <Copy className="size-3.5" />
              {t('invites.copy')}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewCode(null)} data-testid="invite-code-dialog-close">
              {t('invites.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
