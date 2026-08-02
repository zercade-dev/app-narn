import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useNotificationStore,
  type NotificationSeverity,
} from '../../stores/notification-store.js';
import { TINT_AMBER, TINT_SKY, TINT_RED } from '../tabs/run-status-ui.js';

/**
 * Account → Notifications tab: the flat-polled notification list (see
 * notification-store.ts) with per-item mark-read/dismiss actions and a
 * "mark all read" button. Not `keepMounted` in AccountView — this tab has no
 * local in-progress state to lose on unmount (it reads a
 * Zustand store whose data survives the unmount anyway), so re-fetching
 * fresh notifications on each tab visit is desirable rather than a
 * regression (see AccountView's keepMounted comment).
 *
 * Errors always render the generic `errorGeneric` copy rather than the
 * store's raw message, matching DataTab/DevicesSection's inline-alert
 * convention elsewhere in this directory.
 */

const SEVERITY_TINT: Record<NotificationSeverity, string> = {
  info: TINT_SKY,
  warning: TINT_AMBER,
  critical: TINT_RED,
};

export function NotificationsTab() {
  const { t } = useTranslation('account');
  // Scoped selectors (not a whole-store destructure) so this component only
  // re-renders on the fields it actually displays — the store also carries
  // internal poll bookkeeping (_timer/_running) that changes every 5-minute
  // tick and would otherwise force a re-render here for no visible reason.
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loading = useNotificationStore((s) => s.loading);
  const error = useNotificationStore((s) => s.error);
  const fetchNotifications = useNotificationStore((s) => s.fetch);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const dismiss = useNotificationStore((s) => s.dismiss);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="space-y-8" data-testid="account-notifications-tab">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('notificationsTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('notificationsDescription')}</p>
            {unreadCount > 0 && (
              <p className="text-sm font-medium" data-testid="notifications-unread-count">
                {t('notificationsUnreadCount', { count: unreadCount })}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={unreadCount === 0}
            onClick={() => void markAllRead()}
            data-testid="notifications-mark-all-read"
          >
            {t('notificationsMarkAllRead')}
          </Button>
        </div>

        {error && (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {t('errorGeneric')}
          </p>
        )}

        {loading && notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="notifications-loading">
            {t('notificationsLoading')}
          </p>
        ) : notifications.length === 0 && !error ? (
          // `!error` here: a failed fetch already surfaces the alert above —
          // without this guard, an empty (never-populated) `notifications`
          // array would ALSO render "You have no notifications," a
          // self-contradictory pairing with the error banner right above it.
          <p className="text-sm text-muted-foreground" data-testid="notifications-empty">
            {t('notificationsEmpty')}
          </p>
        ) : notifications.length > 0 ? (
          <ul className="space-y-2">
            {notifications.map((n) => {
              const unread = n.readAt === null;
              return (
                <li
                  key={n.id}
                  data-testid="notification-row"
                  data-notification-id={n.id}
                  data-read={!unread}
                  className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                    unread ? 'bg-muted/30' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={SEVERITY_TINT[n.severity]}>
                        {t(`notificationsSeverity.${n.severity}`)}
                      </Badge>
                      <span className="truncate font-medium">{n.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {unread && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void markRead(n.id)}
                        data-testid={`notification-mark-read-${n.id}`}
                      >
                        {t('notificationsMarkRead')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void dismiss(n.id)}
                      data-testid={`notification-dismiss-${n.id}`}
                    >
                      {t('notificationsDismiss')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
