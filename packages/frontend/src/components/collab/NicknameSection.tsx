import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { CollabApiError, claimNickname, getNickname } from '../../lib/collab-api.js';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/** `^[a-z0-9-]{3,30}$` — mirrors the server's nickname validation. */
const NICKNAME_PATTERN = /^[a-z0-9-]{3,30}$/;

/** `CollabApiError` codes with a dedicated `collab:errors.<code>` message
 * (the full map used by {@link JoinProjectView} too); anything else — a
 * non-`CollabApiError`, or a code outside this set (e.g. `invalid_nickname`,
 * which client-side validation already prevents in practice) — falls back to
 * `errors.unknown_error`. */
const KNOWN_ERROR_CODES = new Set([
  'invalid_invite',
  'nickname_required',
  'nickname_taken',
  'nickname_already_claimed',
  'nickname_reserved',
  'already_member',
  'project_full',
  'cannot_join_own_project',
  'too_many_pending_invites',
  'join_failed',
  'unknown_error',
]);

interface NicknameSectionProps {
  /** Called once, right after a successful claim, with the newly claimed
   * nickname — lets a parent (e.g. `JoinProjectView`) react without a second
   * `getNickname()` round trip. */
  readonly onClaimed?: (nickname: string) => void;
  /** Suppresses the claim form, leaving only the read-only states. Set on
   * mobile viewports (issue #70), where claiming — a one-shot, permanent
   * write — has no place; an already-claimed nickname still displays. */
  readonly readOnly?: boolean;
}

type Status = 'loading' | 'claimed' | 'unclaimed';

/**
 * The caller's one-and-only, ever, display nickname: claimed → read-only
 * `@nick`; unclaimed → a claim form with live format validation.
 * Self-contained (fetches its own `getNickname()` on mount) so it drops into
 * both `AccountView` (a permanent settings section) and `JoinProjectView`
 * (an inline gate before the join form) without either caller lifting
 * nickname state.
 *
 * A `getNickname()` FAILURE is treated the same as `null` (unclaimed) rather
 * than blocking the form — the worst case is a wasted `claimNickname` round
 * trip the server rejects with `nickname_already_claimed`, which the form
 * surfaces like any other claim error.
 */
export function NicknameSection({ onClaimed, readOnly = false }: Readonly<NicknameSectionProps>) {
  const { t } = useTranslation('collab');
  const [status, setStatus] = useState<Status>('loading');
  const [nickname, setNickname] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getNickname()
      .then((n) => {
        if (cancelled) return;
        setNickname(n);
        setStatus(n === null ? 'unclaimed' : 'claimed');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('unclaimed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isValid = NICKNAME_PATTERN.test(value);

  const handleClaim = async () => {
    if (!isValid) return;
    setClaiming(true);
    try {
      await claimNickname(value);
      setNickname(value);
      setStatus('claimed');
      toast.success(t('nickname.claimSuccess'));
      onClaimed?.(value);
    } catch (err) {
      const code =
        err instanceof CollabApiError && KNOWN_ERROR_CODES.has(err.code)
          ? err.code
          : 'unknown_error';
      toast.error(t(`errors.${code}`));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div data-testid="nickname-section" className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{t('nickname.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('nickname.description')}</p>
      </div>

      {status === 'loading' ? (
        <p className="text-sm text-muted-foreground" data-testid="nickname-loading">
          {t('nickname.loading')}
        </p>
      ) : status === 'claimed' ? (
        <div data-testid="nickname-claimed">
          <p className="text-sm font-medium" data-testid="nickname-value">
            @{nickname}
          </p>
          <p className="text-sm text-muted-foreground">{t('nickname.immutableHint')}</p>
        </div>
      ) : readOnly ? (
        <p className="text-sm text-muted-foreground" data-testid="nickname-claim-on-desktop">
          {t('nickname.claimOnDesktop')}
        </p>
      ) : (
        <div className="space-y-2" data-testid="nickname-form">
          <Label htmlFor="nickname-input">{t('nickname.title')}</Label>
          <Input
            id="nickname-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('nickname.placeholder')}
            data-testid="nickname-input"
          />
          <p className="text-xs text-muted-foreground" data-testid="nickname-format-hint">
            {t('nickname.formatHint')}
          </p>
          <Button
            onClick={() => void handleClaim()}
            disabled={!isValid || claiming}
            data-testid="nickname-claim-btn"
          >
            {claiming ? t('nickname.claiming') : t('nickname.claimButton')}
          </Button>
        </div>
      )}
    </div>
  );
}
