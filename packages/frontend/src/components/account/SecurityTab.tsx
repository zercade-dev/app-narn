import { MfaSection } from './MfaSection.js';
import { DevicesSection } from './DevicesSection.js';

/**
 * Account → Security tab: two-factor authentication (`MfaSection`, moved in
 * verbatim — zero logic changes) plus the per-device credential-vault list
 * (`DevicesSection`). Split out of `AccountView` when the account page grew
 * tabs (Security / Data / Notifications).
 */
export function SecurityTab() {
  return (
    <div className="space-y-8" data-testid="account-security-tab">
      <MfaSection />
      <DevicesSection />
    </div>
  );
}
