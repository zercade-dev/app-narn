import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logout } from '../../lib/auth-redirect.js';

/**
 * Account → Data tab: non-destructive data export plus a two-stage "danger
 * zone" account deletion. Talks to the cloud composition root's
 * `/auth/account/*` routes — these live OUTSIDE `/api`, so they use a plain
 * `fetch` rather than the vault-aware `apiRequest` helper (mirrors
 * `logout()` in lib/auth-redirect).
 *
 * Deletion is two-stage to gate an irreversible action behind an emailed,
 * one-time code: stage 1 requests the code; stage 2 confirms with the code plus
 * a typed-out email. On success the session is cleared via `logout()`.
 *
 * Extracted verbatim (same state, handlers, and test-ids) from the pre-tabs
 * `AccountView` when the account page grew tabs (Security / Data / Notifications).
 */
export function DataTab() {
  const { t } = useTranslation('account');
  const [stage, setStage] = useState<'idle' | 'sent'>('idle');
  const [token, setToken] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function requestDeletion() {
    setBusy(true);
    setError('');
    try {
      // Strict end-to-end: only reveal the confirm stage when the server actually
      // emailed the code (2xx). A failure (no email on file, relay down, or the
      // route unmounted) shows an error instead of a misleading "code sent".
      const res = await fetch('/auth/account/request-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        setError(t('errorGeneric'));
        return;
      }
      setStage('sent');
      // If the user has a verified TOTP factor, the server requires a fresh code
      // on confirm; surface the input so they can supply it. Non-fatal on failure:
      // the server still enforces MFA (returns a uniform 400), so the user can retry.
      try {
        const s = await fetch('/auth/mfa/status');
        if (s.ok) setMfaEnrolled(((await s.json()) as { enrolled?: boolean }).enrolled === true);
      } catch {
        // Leave the field hidden; the server remains the source of truth.
      }
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeletion() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/auth/account/confirm-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          confirmText: confirmText.trim(),
          ...(mfaEnrolled ? { mfaCode: mfaCode.trim() } : {}),
        }),
      });
      if (!res.ok) {
        setError(t('errorInvalidConfirmation'));
        return;
      }
      // Account is gone — clear client session + redirect to /login.
      await logout();
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  function exportData() {
    // Hard navigation lets the server's Content-Disposition trigger the download.
    globalThis.location.assign('/auth/account/export');
  }

  return (
    <div className="space-y-8" data-testid="account-data-tab">
      <section>
        <h2 className="text-base font-semibold">{t('exportTitle')}</h2>
        <p className="mb-2 text-sm text-muted-foreground">{t('exportDescription')}</p>
        <Button variant="outline" onClick={exportData} data-testid="account-export">
          {t('exportButton')}
        </Button>
      </section>

      <section className="rounded-md border border-destructive/40 p-4">
        <h2 className="text-base font-semibold text-destructive">{t('deleteTitle')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('deleteDescription')}</p>
        {error && (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {stage === 'idle' ? (
          <Button
            variant="destructive"
            disabled={busy}
            onClick={requestDeletion}
            data-testid="account-delete-request"
          >
            {t('deleteRequestButton')}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">{t('deleteTokenSent')}</p>
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('tokenPlaceholder')}
              aria-label={t('tokenPlaceholder')}
              autoComplete="off"
              data-testid="account-delete-token"
            />
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t('confirmPlaceholder')}
              aria-label={t('confirmPlaceholder')}
              autoComplete="off"
              data-testid="account-delete-confirm"
            />
            {mfaEnrolled && (
              <Input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t('deleteMfaCodePlaceholder')}
                aria-label={t('deleteMfaCodePlaceholder')}
                data-testid="account-delete-mfa-code"
              />
            )}
            <Button
              variant="destructive"
              disabled={busy || !token || !confirmText || (mfaEnrolled && !mfaCode.trim())}
              onClick={confirmDeletion}
              data-testid="account-delete-confirm-button"
            >
              {t('deleteConfirmButton')}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
