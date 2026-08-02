import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { useSystemStatusStore } from '@/stores/system-status-store.js';
import { MarqueeText } from './MarqueeText.js';
import { formatRemaining } from './restart-format.js';

const COLLAPSE_KEY = (restartAt: number) => `restart-banner-collapsed:${restartAt}`;
const DISMISS_RESTARTED_KEY = (t: number) => `restart-banner-dismiss-restarted:${t}`;
const DISMISS_CANCELLED_KEY = (t: number) => `restart-banner-dismiss-cancelled:${t}`;

function lsGet(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function lsSet(key: string, on: boolean): void {
  try {
    if (on) {
      localStorage.setItem(key, '1');
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Returns a millisecond timestamp (from Date.now()) that refreshes every second
 * while `active` is true. The lazy initializer seeds the value on first render
 * so the render body never calls Date.now() directly (satisfies react-hooks/purity).
 */
function useClientNow(active: boolean): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const ROW = 'flex items-center gap-2 px-3 py-0.5 text-xs leading-tight';

export function RestartBanners() {
  const { t } = useTranslation('system');
  const status = useSystemStatusStore((s) => s.status);
  const clockOffset = useSystemStatusStore((s) => s.clockOffset);

  // Tick whenever banners are enabled so serverClock stays fresh for B/C windows and
  // for detecting a later restart. The interval runs only where banners are
  // enabled (bannersEnabled=true) and the component returns null cheaply when
  // nothing is visible.
  const hasScheduledRestart = !!status?.bannersEnabled && status.restartAt != null;
  const clientNow = useClientNow(!!status?.bannersEnabled);
  const serverClock = clientNow + clockOffset;

  const remaining = status?.restartAt != null ? status.restartAt - serverClock : -1;
  const showCountdown = hasScheduledRestart && remaining > 0;

  // --- Banner A: collapse state (force-open in the last minute) ---
  const lastMinute = showCountdown && remaining <= 60_000;
  const collapseKey = status?.restartAt != null ? COLLAPSE_KEY(status.restartAt) : '';

  // Sync collapse state with localStorage when collapseKey changes.
  // Uses the React derived-state pattern (update during render when prev !== current)
  // to avoid a useEffect → setState cascade (which would trigger an extra render cycle
  // and triggers the react-hooks/set-state-in-effect lint rule).
  const [prevCollapseKey, setPrevCollapseKey] = useState(collapseKey);
  const [collapsed, setCollapsed] = useState(() => (collapseKey ? lsGet(collapseKey) : false));
  if (prevCollapseKey !== collapseKey) {
    setPrevCollapseKey(collapseKey);
    setCollapsed(collapseKey ? lsGet(collapseKey) : false);
  }
  const effectiveCollapsed = collapsed && !lastMinute;

  // --- Banner B / C dismissal (re-check on each relevant timestamp) ---
  const [, force] = useState(0);
  const startedAt = status?.serverStartedAt ?? 0;
  const cancelledAt = status?.restartCancelledAt ?? null;
  const withinWindow = (ts: number) => {
    if (!status) return false;
    const age = serverClock - ts;
    return age > 0 && age < status.restartedWindowMs;
  };

  const showRestarted =
    !!status?.bannersEnabled && withinWindow(startedAt) && !lsGet(DISMISS_RESTARTED_KEY(startedAt));
  const showCancelled =
    !!status?.bannersEnabled &&
    cancelledAt != null &&
    withinWindow(cancelledAt) &&
    !lsGet(DISMISS_CANCELLED_KEY(cancelledAt));

  if (!status?.bannersEnabled || (!showCountdown && !showRestarted && !showCancelled)) return null;

  const countdownText = status.restartMessage ?? t('countdown.message');

  return (
    <div className="w-full shrink-0">
      {showCountdown && (
        <div
          className={cn(ROW, 'border-b border-status-warn/40 bg-status-warn/15 text-status-warn')}
        >
          {!effectiveCollapsed && <MarqueeText text={countdownText} />}
          <span className="ml-auto shrink-0 font-mono tabular-nums">
            {formatRemaining(remaining)}
          </span>
          {!lastMinute && (
            <button
              type="button"
              className="shrink-0 rounded p-0.5 hover:bg-black/10"
              aria-label={effectiveCollapsed ? t('countdown.expand') : t('countdown.collapse')}
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                lsSet(collapseKey, next);
              }}
            >
              {effectiveCollapsed ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronUp className="size-3.5" />
              )}
            </button>
          )}
        </div>
      )}

      {showCancelled && cancelledAt != null && (
        <div className={cn(ROW, 'border-b border-border bg-muted text-muted-foreground')}>
          <MarqueeText text={t('cancelled.message')} />
          <button
            type="button"
            className="ml-auto shrink-0 rounded p-0.5 hover:bg-black/10"
            aria-label={t('cancelled.dismiss')}
            onClick={() => {
              lsSet(DISMISS_CANCELLED_KEY(cancelledAt), true);
              force((n) => n + 1);
            }}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {showRestarted && (
        <div
          className={cn(ROW, 'border-b border-status-info/40 bg-status-info/15 text-status-info')}
        >
          <MarqueeText text={t('restarted.message')} />
          <button
            type="button"
            className="ml-auto shrink-0 rounded p-0.5 hover:bg-black/10"
            aria-label={t('restarted.dismiss')}
            onClick={() => {
              lsSet(DISMISS_RESTARTED_KEY(startedAt), true);
              force((n) => n + 1);
            }}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
