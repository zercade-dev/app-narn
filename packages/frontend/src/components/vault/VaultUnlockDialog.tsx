/**
 * VaultUnlockDialog — modal prompting for a password to unlock the encrypted
 * credential vault. On first use (no vault file exists) the entered
 * value becomes the vault's password. Rendered as an overlay sheet so it remains
 * accessible without needing a `dialog` shadcn primitive.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVaultStore } from '../../stores/vault-store.js';
import { useRefocusOnLoadingDone } from './use-refocus.js';
import { goToVaultSetup } from '../../lib/auth-redirect.js';
import { translatePolicyMessage } from '../../lib/password-policy.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface VaultUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
}

type TranslateFn = ReturnType<typeof useTranslation>['t'];

interface VaultUnlockErrorMessageProps {
  t: TranslateFn;
  error: string;
  errorDetails: string[] | null;
  countdownSecs: number | null;
  remainingAttempts: number | null;
}

/**
 * Renders the appropriate vault-unlock error body. Extracted from the dialog so
 * each error case is an independent statement rather than a nested ternary.
 */
function VaultUnlockErrorMessage({
  t,
  error,
  errorDetails,
  countdownSecs,
  remainingAttempts,
}: Readonly<VaultUnlockErrorMessageProps>) {
  if (error === 'too-many-attempts') {
    if (countdownSecs !== null && countdownSecs > 0) {
      const time = `${String(Math.floor(countdownSecs / 60)).padStart(2, '0')}:${String(countdownSecs % 60).padStart(2, '0')}`;
      return (
        <>
          {t('errorLockout')} {t('lockoutCountdown', { time })}
        </>
      );
    }
    return <>{t('errorLockout')}</>;
  }

  if (errorDetails) {
    return (
      <>
        {t('errorPasswordPolicy')}
        <ul className="list-disc pl-4 mt-0.5 text-xs space-y-0.5">
          {errorDetails.map((message) => (
            <li key={message}>{translatePolicyMessage(t, message)}</li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      {t('errorInvalidPassword')}
      {remainingAttempts !== null && (
        <span className="block text-xs mt-0.5">
          {t('remainingAttemptsHint', { count: remainingAttempts })}
        </span>
      )}
    </>
  );
}

export function VaultUnlockDialog({
  open,
  onOpenChange,
  onUnlocked,
}: Readonly<VaultUnlockDialogProps>) {
  const { t } = useTranslation('vault');
  const hasVault = useVaultStore((s) => s.hasVault);
  const setupRequired = useVaultStore((s) => s.setupRequired);
  const cloudManaged = useVaultStore((s) => s.cloudManaged);
  const loading = useVaultStore((s) => s.loading);
  const error = useVaultStore((s) => s.error);
  const errorDetails = useVaultStore((s) => s.errorDetails);
  const lockoutMs = useVaultStore((s) => s.lockoutMs);
  const remainingAttempts = useVaultStore((s) => s.remainingAttempts);
  const unlock = useVaultStore((s) => s.unlock);
  const clearError = useVaultStore((s) => s.clearError);
  const refresh = useVaultStore((s) => s.refresh);
  const vaultName = useVaultStore((s) => s.name);
  const [password, setPassword] = useState('');
  // Only used on the CREATE-vault form (no vault exists yet) — an existing
  // vault already has whatever name it was given at creation, so the unlock
  // form never shows this field.
  const [name, setName] = useState('');
  const [countdownSecs, setCountdownSecs] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards the background-refresh error-clear (see effect below) so a late
  // refresh() rejection can never wipe out a real "Invalid password" error
  // set by an unlock attempt that has already happened.
  const attemptedRef = useRef(false);

  // Seed countdown from lockoutMs during render when it changes
  const [prevLockoutMs, setPrevLockoutMs] = useState<number | null | undefined>(undefined);
  if (prevLockoutMs !== lockoutMs) {
    setPrevLockoutMs(lockoutMs);
    setCountdownSecs(lockoutMs !== null && lockoutMs > 0 ? Math.ceil(lockoutMs / 1000) : null);
  }

  // Tick countdown down each second; clear error when it reaches zero
  useEffect(() => {
    if (countdownSecs === null || countdownSecs <= 0) return;
    const id = setInterval(() => {
      setCountdownSecs((s) => {
        if (s === null || s <= 1) {
          clearError();
          return null;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [countdownSecs, clearError]);
  // Reset the password field during render when the dialog opens.
  const [prevOpen, setPrevOpen] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setPassword('');
      setName('');
    }
  }

  useEffect(() => {
    if (open) {
      clearError();
      // Background status refresh, not a real unlock attempt: `refresh()`
      // funnels a failure into the same store `error` field an unlock
      // attempt uses (see VaultUnlockErrorMessage), which would otherwise
      // render as "Invalid password" before the user has typed anything. On
      // failure, clear it right back out so only a REAL unlock attempt
      // (handleSubmit's own catch) can populate the error UI; this also
      // ensures the rejection is handled rather than left unhandled. Guard
      // with attemptedRef: if the user has already submitted an unlock
      // attempt (real error may now be in the store), a late refresh()
      // rejection must NOT clear it out from under them.
      refresh().catch(() => {
        if (!attemptedRef.current) clearError();
      });
    }
  }, [open, clearError, refresh]);

  // Re-focus the password input after each loading cycle (refresh or failed
  // unlock). When loading becomes true the input is disabled, which removes
  // browser focus; re-acquiring focus when loading ends restores the expected UX.
  useRefocusOnLoadingDone(inputRef, loading, open);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password.trim()) return;
    attemptedRef.current = true;
    try {
      // `name` is only meaningful when creating a new vault; the store/route
      // ignore it once a vault already exists.
      const { unlocked } = await unlock(password, hasVault ? undefined : name.trim() || undefined);
      if (unlocked) {
        setPassword('');
        setName('');
        onUnlocked?.();
        onOpenChange(false);
      }
    } catch {
      // error already captured in store
    }
  };

  // Once a named vault exists (locked or unlocked — the name is plaintext
  // metadata returned by /vault/status even before unlock), surface it in the
  // dialog title so the user can confirm which vault they are about to open.
  const title = hasVault
    ? vaultName
      ? `${t('unlockTitle')} — ${vaultName}`
      : t('unlockTitle')
    : t('createTitle');
  const description = hasVault ? t('unlockDescription') : t('createDescription');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-xl" initialFocus={inputRef}>
        <SheetHeader>
          <SheetTitle data-testid="vault-unlock-title">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {setupRequired || cloudManaged ? (
          <div className="px-4 py-3 space-y-3">
            <SheetFooter className="px-0">
              <Button type="button" data-testid="vault-setup-redirect" onClick={goToVaultSetup}>
                {hasVault ? t('goToVault') : t('setupRedirect')}
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
            {!hasVault && (
              <div className="space-y-1.5">
                <Label htmlFor="vault-name-input">{t('nameLabel')}</Label>
                <Input
                  id="vault-name-input"
                  data-testid="vault-name-input"
                  type="text"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  placeholder={t('namePlaceholder') ?? undefined}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="vault-password-input">{t('passwordLabel')}</Label>
              <Input
                id="vault-password-input"
                data-testid="vault-password-input"
                type="password"
                autoComplete="off"
                ref={inputRef}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && (
              <div
                className="text-sm text-destructive"
                role="alert"
                data-testid="vault-unlock-error"
              >
                <VaultUnlockErrorMessage
                  t={t}
                  error={error}
                  errorDetails={errorDetails}
                  countdownSecs={countdownSecs}
                  remainingAttempts={remainingAttempts}
                />
              </div>
            )}
            <SheetFooter className="px-0">
              <Button
                type="submit"
                disabled={loading || password.trim().length === 0}
                data-testid="vault-unlock-submit"
              >
                {loading ? t('working') : hasVault ? t('unlock') : t('create')}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
