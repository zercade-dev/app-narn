import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Account → Security: two-factor authentication (TOTP) enrollment.
 *
 * Cloud-only. Talks to the cloud composition root's `/auth/mfa/*` routes
 * (OUTSIDE `/api`, so a plain `fetch` like the rest of AccountView), which
 * bridge the HttpOnly session cookie to the identity provider. The server
 * already ENFORCES aal2 once a factor is verified; this is the surface to
 * add/remove that factor:
 *
 *   not-enrolled → [Enable] → POST enroll → show QR + setup key →
 *   enter code → POST verify-enroll → enrolled
 *   enrolled → enter current code → POST unenroll → not-enrolled
 *
 * The QR + setup key are enrollment material the user MUST see (they go into the
 * authenticator app); everything else (factor secrets) stays server-side. No
 * recovery without a factor is the BYOK norm — the description links to the
 * security policy.
 */

interface MfaStatus {
  enrolled: boolean;
  factors: Array<{ id: string; friendlyName: string | null; createdAt: string | null }>;
}

interface EnrollResponse {
  factorId: string;
  qrCode: string | null;
  secret: string | null;
  uri: string | null;
}

type Phase = 'loading' | 'idle' | 'enrolling';

export function MfaSection() {
  const { t } = useTranslation('account');
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<MfaStatus>({ enrolled: false, factors: [] });
  const [enroll, setEnroll] = useState<EnrollResponse | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refreshStatus() {
    try {
      const res = await fetch('/auth/mfa/status');
      if (!res.ok) {
        setError(t('mfaErrorGeneric'));
        setPhase('idle');
        return;
      }
      setStatus((await res.json()) as MfaStatus);
      setPhase('idle');
    } catch {
      setError(t('mfaErrorGeneric'));
      setPhase('idle');
    }
  }

  useEffect(() => {
    // Mount-time status fetch. The setState calls happen only AFTER the awaited
    // fetch resolves (not synchronously in the effect body), so they cannot cause
    // the cascading render the set-state-in-effect rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshStatus();
    // refreshStatus is intentionally not a dependency — this is a mount-once fetch.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startEnroll() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/auth/mfa/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        setError(t('mfaErrorEnroll'));
        return;
      }
      setEnroll((await res.json()) as EnrollResponse);
      setCode('');
      setPhase('enrolling');
    } catch {
      setError(t('mfaErrorEnroll'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!enroll) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/auth/mfa/verify-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: enroll.factorId, code: code.trim() }),
      });
      if (!res.ok) {
        setError(t('mfaErrorVerify'));
        return;
      }
      setEnroll(null);
      setCode('');
      await refreshStatus();
    } catch {
      setError(t('mfaErrorVerify'));
    } finally {
      setBusy(false);
    }
  }

  function cancelEnroll() {
    setEnroll(null);
    setCode('');
    setError('');
    setPhase('idle');
  }

  async function disableMfa() {
    const factorId = status.factors[0]?.id;
    if (!factorId) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/auth/mfa/unenroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, code: disableCode.trim() }),
      });
      if (!res.ok) {
        setError(t('mfaErrorVerify'));
        return;
      }
      setDisableCode('');
      await refreshStatus();
    } catch {
      setError(t('mfaErrorVerify'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="account-mfa">
      <h2 className="text-base font-semibold">{t('mfaTitle')}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t('mfaDescription')}</p>
      {error && (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {phase === 'loading' ? (
        <p className="text-sm text-muted-foreground">{t('mfaLoading')}</p>
      ) : phase === 'enrolling' && enroll ? (
        <div className="space-y-3">
          <p className="text-sm">{t('mfaEnrollScan')}</p>
          {enroll.qrCode && (
            <img
              src={enroll.qrCode}
              alt={t('mfaQrAlt')}
              width={180}
              height={180}
              data-testid="mfa-qr"
            />
          )}
          {enroll.secret && (
            <p className="text-sm">
              {t('mfaSecretLabel')}: <code data-testid="mfa-secret">{enroll.secret}</code>
            </p>
          )}
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('mfaCodePlaceholder')}
            aria-label={t('mfaCodePlaceholder')}
            data-testid="mfa-code"
          />
          <div className="flex gap-2">
            <Button
              disabled={busy || !code.trim()}
              onClick={confirmEnroll}
              data-testid="mfa-confirm"
            >
              {t('mfaConfirmButton')}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={cancelEnroll}
              data-testid="mfa-cancel"
            >
              {t('mfaCancelButton')}
            </Button>
          </div>
        </div>
      ) : status.enrolled ? (
        <div className="space-y-3">
          <p className="text-sm" data-testid="mfa-status">
            ✓ {t('mfaStatusEnabled')}
          </p>
          <p className="text-sm text-muted-foreground">{t('mfaDisableHint')}</p>
          <Input
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('mfaCodePlaceholder')}
            aria-label={t('mfaCodePlaceholder')}
            data-testid="mfa-disable-code"
          />
          <Button
            variant="destructive"
            disabled={busy || !disableCode.trim()}
            onClick={disableMfa}
            data-testid="mfa-disable"
          >
            {t('mfaDisableButton')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm" data-testid="mfa-status">
            {t('mfaStatusNotEnabled')}
          </p>
          <Button disabled={busy} onClick={startEnroll} data-testid="mfa-enable">
            {t('mfaEnableButton')}
          </Button>
        </div>
      )}
    </section>
  );
}
