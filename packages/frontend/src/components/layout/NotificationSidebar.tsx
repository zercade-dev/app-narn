import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '../../stores/notification-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import {
  notificationContextFromStores,
  presentNotification,
  type NotificationAction,
  type PresentedNotification,
} from '../../lib/notification-presentation.js';
import type { Translate } from '../../lib/log-presentation/types.js';
import { TINT_AMBER, TINT_EMERALD, TINT_RED, TINT_SKY } from '../tabs/run-status-ui.js';

type Tone = PresentedNotification['tone'];

const TONE_TINT: Record<Tone, string> = {
  info: TINT_SKY,
  success: TINT_EMERALD,
  warning: TINT_AMBER,
  error: TINT_RED,
};

const TONE_ICON: Record<Tone, ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: CircleAlert,
};

interface NotificationSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The right-hand notifications panel opened from the console bar's bell.
 *
 * Opening it marks everything read except problems (a failed run, a run that
 * finished with problems): those stay unread until the person uses one of the
 * entry's actions or dismisses it.
 *
 * The polite live region sits outside the sheet so a failure that arrives
 * while the sheet is closed is still announced. It only speaks for problems
 * created after this component mounted, so a page load never reads out old
 * failures.
 */
export function NotificationSidebar({ open, onOpenChange }: Readonly<NotificationSidebarProps>) {
  const { t } = useTranslation(['account', 'logs', 'strings']);
  const translate = t as Translate;
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markInformationalRead = useNotificationStore((s) => s.markInformationalRead);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const [mountedAt] = useState(() => Date.now());

  // Once per opening, not per render.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) void markInformationalRead();
    wasOpen.current = open;
  }, [open, markInformationalRead]);

  const context = notificationContextFromStores(projects, activeProjectId);
  const presented = [...notifications]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((n) => ({ n, p: presentNotification(n, translate, context) }));

  const announcement =
    presented.find(
      ({ n, p }) => p.problem && n.readAt === null && Date.parse(n.createdAt) >= mountedAt,
    )?.p.title ?? '';

  const runAction = (id: string, problem: boolean, unread: boolean, action: NotificationAction) => {
    action.run();
    if (problem && unread) void markRead(id);
    onOpenChange(false);
  };

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="notification-live-region"
      >
        {announcement}
      </div>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          data-testid="notification-sidebar"
          className="w-full gap-0 motion-reduce:transition-none sm:max-w-md"
        >
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{t('notificationsTitle')}</SheetTitle>
            <SheetDescription>{t('notificationsSidebarDescription')}</SheetDescription>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={unreadCount === 0}
                onClick={() => void markAllRead()}
                data-testid="notification-mark-all-read"
              >
                {t('notificationsMarkAllRead')}
              </Button>
            </div>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {presented.length === 0 ? (
              <p
                className="px-1 py-6 text-center text-sm text-muted-foreground"
                data-testid="notification-sidebar-empty"
              >
                {t('notificationsEmpty')}
              </p>
            ) : (
              <ul className="space-y-2">
                {presented.map(({ n, p }) => {
                  const unread = n.readAt === null;
                  const Icon = TONE_ICON[p.tone];
                  return (
                    <li
                      key={n.id}
                      data-testid="notification-item"
                      data-notification-id={n.id}
                      data-unread={unread}
                      data-tone={p.tone}
                      className={cn(
                        'flex gap-3 rounded-md border p-3',
                        unread ? 'border-l-4 border-l-foreground/60 bg-muted/40' : 'bg-transparent',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded',
                          TONE_TINT[p.tone],
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn('break-words', unread ? 'font-semibold' : 'font-medium')}
                          >
                            {p.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="-mt-1 -mr-1 shrink-0"
                            onClick={() => void dismiss(n.id)}
                            aria-label={t('notificationsDismissItem', { title: p.title })}
                            title={t('notificationsDismiss')}
                            data-testid="notification-dismiss"
                          >
                            <X />
                          </Button>
                        </div>
                        {p.body && (
                          <p className="break-words text-sm text-muted-foreground">{p.body}</p>
                        )}
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          {unread && (
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <span
                                className="size-1.5 rounded-full bg-current"
                                aria-hidden="true"
                              />
                              {t('notificationsUnread')}
                            </span>
                          )}
                          <time dateTime={n.createdAt}>
                            {new Date(n.createdAt).toLocaleString()}
                          </time>
                        </p>
                        {p.actions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {p.actions.map((action) => (
                              <Button
                                key={action.id}
                                size="sm"
                                variant="outline"
                                disabled={action.disabled}
                                onClick={() => runAction(n.id, p.problem, unread, action)}
                                data-testid={`notification-action-${action.id}`}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
