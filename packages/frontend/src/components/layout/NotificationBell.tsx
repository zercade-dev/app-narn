import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationStore } from '../../stores/notification-store.js';
import { NotificationSidebar } from './NotificationSidebar.js';

/** Counts above this read "99+" so the badge never outgrows the console bar. */
const MAX_SHOWN = 99;

/**
 * The console bar's notifications bell: the unread count, and the sidebar it
 * opens. The pixel sprite set has no bell, so the lucide icon is used in every
 * theme.
 */
export function NotificationBell() {
  const { t } = useTranslation('console');
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [open, setOpen] = useState(false);
  const label =
    unreadCount > 0 ? t('notificationsBellUnread', { count: unreadCount }) : t('notificationsBell');

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative size-6"
        onClick={(e) => {
          // The bar's own buttons toggle the panel; this one has its own action.
          e.stopPropagation();
          setOpen((wasOpen) => !wasOpen);
        }}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={label}
        data-testid="notification-bell"
      >
        <Bell className="size-3.5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-bell-count"
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-3.5 rounded-full bg-primary px-0.5 text-center font-mono text-[9px] leading-3.5 text-primary-foreground"
          >
            {unreadCount > MAX_SHOWN ? `${MAX_SHOWN}+` : unreadCount}
          </span>
        )}
      </Button>
      <NotificationSidebar open={open} onOpenChange={setOpen} />
    </>
  );
}
