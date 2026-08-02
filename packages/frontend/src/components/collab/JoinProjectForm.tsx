import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { CollabApiError, getNickname, joinProject } from '../../lib/collab-api.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { NicknameSection } from './NicknameSection.js';

/** `CollabApiError` codes with a dedicated `collab:errors.<code>` message
 * (mirrors {@link NicknameSection}'s list — kept as a separate literal here
 * rather than a shared import, since the two components are independent
 * consumers and the set is small and stable). */
const KNOWN_ERROR_CODES = new Set([
  'invalid_invite',
  'nickname_required',
  'nickname_taken',
  'nickname_already_claimed',
  'already_member',
  'project_full',
  'cannot_join_own_project',
  'too_many_pending_invites',
  'join_failed',
  'unknown_error',
]);

interface JoinProjectFormProps {
  /** Called once, right after a successful join + activate (not on a
   * post-join refresh failure — the membership already exists either way,
   * but this hook is for the caller to react to the "fully settled" case,
   * e.g. {@link Sidebar} closing the New Project sheet). */
  readonly onJoined?: () => void;
}

/**
 * Invite-code redemption form: the nickname gate + invite-code input +
 * submit button, extracted out of the standalone {@link JoinProjectView} so
 * it can also be embedded as the "Join" tab of the New Project sheet
 * without duplicating the join logic.
 *
 * Gated on the caller having claimed a nickname first — the server enforces
 * this on `joinProject` too (`CollabApiError('nickname_required')`), but
 * redeeming a one-use invite code before you can even be recognized as a
 * collaborator would burn the code for nothing, so the client blocks earlier
 * with an inline {@link NicknameSection}.
 *
 * On a successful join: refetch the project list, best-effort refresh the
 * shared-project owner-nickname map (cosmetic only — never blocks the
 * navigation), activate the newly joined project, switch to the project
 * view, then notify the caller via `onJoined`.
 *
 * The join call and the post-join refresh/navigate are two separate
 * try/catches: once `joinProject` itself succeeds the membership exists
 * server-side regardless of what happens next, so a `fetchProjects` /
 * `activateProject` hiccup must NOT be reported as a generic join failure
 * (that would misleadingly suggest the invite code didn't work) and must NOT
 * navigate (or call `onJoined`) on a project list that failed to refresh. It
 * shows a distinct "joined, but…" toast and leaves the form as-is — the next
 * natural fetch (e.g. opening the sidebar) will pick up the new project.
 */
export function JoinProjectForm({ onJoined }: Readonly<JoinProjectFormProps>) {
  const { t } = useTranslation('collab');
  const [nicknameLoaded, setNicknameLoaded] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const loadSharedProjectNicknames = useProjectStore((s) => s.loadSharedProjectNicknames);
  const activateProject = useProjectStore((s) => s.activateProject);
  const setView = useViewStore((s) => s.setView);

  useEffect(() => {
    let cancelled = false;
    getNickname()
      .then((n) => {
        if (cancelled) return;
        setNickname(n);
      })
      .catch(() => {
        // Unknown: fall through to the nickname gate (safe default — worst
        // case is an extra claim-form render even for a user who already
        // has one, which the form itself would reject as
        // 'nickname_already_claimed').
      })
      .finally(() => {
        if (cancelled) return;
        setNicknameLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setJoining(true);
    let projectId: string;
    try {
      ({ projectId } = await joinProject(trimmed));
    } catch (err) {
      const errCode =
        err instanceof CollabApiError && KNOWN_ERROR_CODES.has(err.code)
          ? err.code
          : 'unknown_error';
      toast.error(t(`errors.${errCode}`));
      setJoining(false);
      return;
    }

    // The join itself succeeded — the membership exists server-side from
    // here on, so surface success immediately rather than making it
    // conditional on the client-side refresh below.
    toast.success(t('join.joinSuccess'));
    try {
      await fetchProjects();
      void loadSharedProjectNicknames().catch(() => {});
      await activateProject(projectId);
      setView('project');
      onJoined?.();
    } catch {
      toast.error(t('join.refreshFailed'));
    } finally {
      setJoining(false);
    }
  };

  if (!nicknameLoaded) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="join-loading">
        {t('nickname.loading')}
      </p>
    );
  }

  if (nickname === null) {
    return (
      <div className="space-y-3" data-testid="join-nickname-gate">
        <p className="text-sm text-muted-foreground">{t('join.nicknameFirst')}</p>
        <NicknameSection onClaimed={(claimed) => setNickname(claimed)} />
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="join-form">
      <Label htmlFor="join-code-input">{t('join.codePlaceholder')}</Label>
      <Input
        id="join-code-input"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={t('join.codePlaceholder')}
        data-testid="join-code-input"
      />
      <Button
        onClick={() => void handleJoin()}
        disabled={!code.trim() || joining}
        data-testid="join-submit-btn"
      >
        {joining ? t('join.joining') : t('join.joinButton')}
      </Button>
    </div>
  );
}
