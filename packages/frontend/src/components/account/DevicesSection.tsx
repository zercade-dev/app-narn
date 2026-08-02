import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/**
 * Account → Security → Devices: lists the per-device credential-vault rows
 * (`device_vaults`) the caller has set up, and lets them "forget" one (delete
 * its vault row) — e.g. a lost/decommissioned machine — without touching the
 * vault's actual credentials on any other device.
 *
 * Cloud-only. Talks to the cloud composition root's `/auth/devices` routes
 * (OUTSIDE `/api`, so a plain `fetch` like the rest of this directory —
 * mirrors MfaSection):
 *
 *   GET    /auth/devices           → { devices: [{ deviceId, createdAt, updatedAt }] }
 *   DELETE /auth/devices/:deviceId → 200 { deleted: true }
 *
 * Never receives ciphertext/kdf_salt — only the row's identifying metadata.
 * A failed fetch just surfaces an error state, same as any other network
 * error.
 */

interface Device {
  deviceId: string;
  createdAt: string;
  updatedAt: string;
}

// 'error' is distinct from 'idle' so a failed fetch doesn't fall through to the
// "no devices" empty state below the error alert (they used to be conflated,
// showing both at once).
type Phase = 'loading' | 'idle' | 'error';

export function DevicesSection() {
  const { t } = useTranslation('account');
  const [phase, setPhase] = useState<Phase>('loading');
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    // Mount-time fetch. The setState calls happen only AFTER the awaited fetch
    // resolves (not synchronously in the effect body), mirroring MfaSection's
    // refreshStatus effect — so this cannot cause a cascading render. `cancelled`
    // guards against applying a stale response after unmount, the standard
    // cancelled-flag effect pattern.
    let cancelled = false;
    async function refreshDevices() {
      try {
        const res = await fetch('/auth/devices');
        if (cancelled) return;
        if (!res.ok) {
          setError(t('devicesError'));
          setPhase('error');
          return;
        }
        const body = (await res.json()) as { devices?: Device[] };
        setDevices(body.devices ?? []);
        setError('');
        setPhase('idle');
      } catch {
        if (!cancelled) {
          setError(t('devicesError'));
          setPhase('error');
        }
      }
    }
    void refreshDevices();
    return () => {
      cancelled = true;
    };
    // Mount-once fetch — intentionally no deps.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function forgetDevice(deviceId: string) {
    setBusyId(deviceId);
    setError('');
    try {
      const res = await fetch(`/auth/devices/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError(t('deviceForgetError'));
        return;
      }
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
      setPendingDeleteId(null);
    } catch {
      setError(t('deviceForgetError'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section data-testid="account-devices">
      <h2 className="text-base font-semibold">{t('devicesTitle')}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t('devicesDescription')}</p>
      {error && (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {phase === 'loading' ? (
        <p className="text-sm text-muted-foreground" data-testid="devices-loading">
          {t('devicesLoading')}
        </p>
      ) : phase === 'error' ? null : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="devices-empty">
          {t('devicesEmpty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {devices.map((d) => (
            <li
              key={d.deviceId}
              data-testid="device-row"
              data-device-id={d.deviceId}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs" title={d.deviceId}>
                  {d.deviceId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('deviceAddedLabel')}: {new Date(d.createdAt).toLocaleString()}
                  {' · '}
                  {t('deviceUpdatedLabel')}: {new Date(d.updatedAt).toLocaleString()}
                </p>
              </div>
              {pendingDeleteId === d.deviceId ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busyId === d.deviceId}
                    onClick={() => forgetDevice(d.deviceId)}
                    data-testid="device-forget-confirm"
                  >
                    {t('deviceForgetConfirm')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === d.deviceId}
                    onClick={() => setPendingDeleteId(null)}
                    data-testid="device-forget-cancel"
                  >
                    {t('deviceForgetCancel')}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  // Gate on ANY in-flight delete (not just this row's) — busyId/
                  // pendingDeleteId are single shared values, not per-row, so without
                  // this a second row could be armed while another row's DELETE is
                  // still in flight, desyncing busyId from the row that's actually busy
                  // and re-enabling its Confirm button mid-request.
                  disabled={busyId !== null}
                  onClick={() => setPendingDeleteId(d.deviceId)}
                  data-testid="device-forget"
                >
                  {t('deviceForgetButton')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
