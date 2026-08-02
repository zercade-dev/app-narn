import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { MembersSection } from './MembersSection.js';
import { InvitesSection } from './InvitesSection.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface SharingTabProps {
  readonly projectId: string;
  readonly activeLanguages: string[];
  readonly sourceLanguage: string;
}

/**
 * Owner-only Sharing tab: who has access to this project (members,
 * per-collaborator writable languages) and how to grant more access
 * (invite codes). Reachability is gated upstream by `lib/tab-gating.ts`
 * (owner + cloud-managed only) and `AppShell` double-guards the render slot
 * with `accessFor(...).role === 'owner'`.
 *
 * Also owns the manual-edit-audit toggle: owner-only, PATCHes
 * `/projects/:id/manual-edit-audit` via the project store's
 * `setManualEditAuditEnabled`. Re-gated on `access.role === 'owner'` here
 * too (not just at the `AppShell` render slot), since this component is
 * unit-tested directly. Disabled — with an explanatory hint — while the
 * project has never been shared (`!access.sharedEver`): there's no one but
 * the owner to make manual edits, so there is nothing to audit yet.
 */
export function SharingTab({
  projectId,
  activeLanguages,
  sourceLanguage,
}: Readonly<SharingTabProps>) {
  const { t } = useTranslation('collab');
  const access = useProjectStore((s) => accessFor(s, projectId));
  const manualEditAuditEnabled = useProjectStore(
    (s) => s.projects.find((p) => p.id === projectId)?.manualEditAuditEnabled ?? false,
  );
  const setManualEditAuditEnabled = useProjectStore((s) => s.setManualEditAuditEnabled);
  const [savingAudit, setSavingAudit] = useState(false);

  const handleAuditToggle = async (checked: boolean) => {
    setSavingAudit(true);
    try {
      await setManualEditAuditEnabled(projectId, checked);
    } catch (err) {
      toast.error(t('sharing.auditToggleFailed', { message: getErrorMessage(err) }));
    } finally {
      setSavingAudit(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t('sharing.pageTitle')}</h2>
      {access.role === 'owner' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('sharing.auditToggleLabel')}</CardTitle>
            <CardDescription>{t('sharing.auditToggleHelp')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <span className="inline-flex items-center gap-2">
              <Checkbox
                id="manual-edit-audit-toggle"
                checked={manualEditAuditEnabled}
                onCheckedChange={(checked) => void handleAuditToggle(checked === true)}
                disabled={savingAudit || !access.sharedEver}
                data-testid="manual-edit-audit-toggle"
              />
              <Label
                htmlFor="manual-edit-audit-toggle"
                className="cursor-pointer select-none font-normal"
              >
                {t('sharing.auditToggleCheckboxLabel')}
              </Label>
            </span>
            {!access.sharedEver && (
              <p
                className="text-xs text-muted-foreground"
                data-testid="manual-edit-audit-unshared-hint"
              >
                {t('sharing.auditToggleUnsharedHint')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <MembersSection
        projectId={projectId}
        activeLanguages={activeLanguages}
        sourceLanguage={sourceLanguage}
      />
      <InvitesSection projectId={projectId} />
    </div>
  );
}
