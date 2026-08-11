import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { logout } from '../../lib/auth-redirect.js';
import { useIsMobile } from '../../hooks/use-mobile-viewport.js';
import { useNotificationStore } from '../../stores/notification-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useSystemStatusStore } from '@/stores/system-status-store';
import { DesktopOnlyNotice } from '../common/DesktopOnlyNotice.js';
import { NicknameSection } from '../collab/NicknameSection.js';
import { SecurityTab } from './SecurityTab.js';
import { DataTab } from './DataTab.js';
import { NotificationsTab } from './NotificationsTab.js';

/**
 * Account view (cloud only): a tabbed shell over Security (MFA + devices),
 * Data (export + deletion), and Notifications (the flat-polled notification
 * list), plus a permanent Nickname section above the tabs — it's account-wide
 * identity, not scoped to any one tab, and `JoinProjectView` mounts the same
 * `NicknameSection` inline for the same reason. Local `useState` for the active
 * tab — NOT URL-routed — mirroring `BatchConfigEditor`'s internal tabs
 * (`EditorTab`).
 *
 * Security and Data render with `keepMounted` — Base UI's `Tabs.Panel`
 * unmounts an inactive panel by default, which would otherwise silently
 * discard in-progress state when the user switches away and back: an MFA
 * enrollment mid-flow (QR/secret, risking an orphaned unverified TOTP factor
 * on re-enroll) or a typed deletion-confirmation token (forcing a second
 * emailed code). Notifications is intentionally left lazy/remountable — it's
 * a read/act view with no in-progress state to lose (it reads a Zustand store
 * that already survives unmount on its own), so re-fetching fresh data on
 * each visit is desirable, not a regression.
 *
 * MOBILE (issue #70): the view itself is gated 'mobile' so signing out is
 * reachable from a phone, but only the session/identity strip survives — the
 * three tabs are REPLACED by <DesktopOnlyNotice>, not merely hidden, so their
 * panels never mount and their MFA/device/export/notification fetches never
 * fire on mobile. The nickname stays visible read-only (`readOnly`), which
 * suppresses the one-shot claim form.
 */
type AccountTab = 'security' | 'data' | 'notifications';

export function AccountView() {
  const { t } = useTranslation('account');
  const [tab, setTab] = useState<AccountTab>('security');
  const isMobile = useIsMobile();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const supportEmail = useSystemStatusStore((s) => s.status?.supportEmail ?? null);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8" data-testid="account-view">
      <section data-testid="account-nickname">
        <NicknameSection
          readOnly={isMobile}
          onClaimed={(n) => useProjectStore.setState({ selfNickname: n })}
        />
      </section>

      {isMobile ? (
        <DesktopOnlyNotice />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (v !== null) setTab(v as AccountTab);
          }}
        >
          <TabsList>
            <TabsTrigger value="security" data-testid="account-tab-security">
              {t('tabSecurity')}
            </TabsTrigger>
            <TabsTrigger value="data" data-testid="account-tab-data">
              {t('tabData')}
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="account-tab-notifications">
              {t('tabNotifications')}
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 min-w-4 px-1 text-[10px]"
                  data-testid="account-tab-notifications-unread-badge"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="security" keepMounted>
            <SecurityTab />
          </TabsContent>
          <TabsContent value="data" keepMounted>
            <DataTab />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
        </Tabs>
      )}

      <section>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => void logout()}
          data-testid="sign-out-button"
        >
          <LogOut className="size-4" />
          {t('signOut')}
        </Button>
      </section>

      {supportEmail && (
        <section>
          <p className="text-sm text-muted-foreground">
            {t('reportBugsPrefix')}{' '}
            <a
              className="underline"
              href={`mailto:${supportEmail}`}
              data-testid="account-bug-report"
            >
              {supportEmail}
            </a>
          </p>
        </section>
      )}
    </div>
  );
}
