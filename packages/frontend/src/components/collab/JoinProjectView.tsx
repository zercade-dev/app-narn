import { useTranslation } from 'react-i18next';
import { JoinProjectForm } from './JoinProjectForm.js';

/**
 * Workspace-level "Join a project" view (`ShellView` `'join-project'`,
 * reachable via the `/join` deep link — see `lib/url-state.ts`).
 *
 * This is no longer reachable from the sidebar's "Page" group (that nav row
 * and the invite-code form both moved to the "Join" tab of the New Project
 * sheet — see `Sidebar.tsx` and {@link JoinProjectForm}). This view is kept
 * as a thin wrapper around the same form purely so a bookmarked/shared
 * `/join` URL keeps working; all the actual join logic lives in
 * `JoinProjectForm` now.
 */
export function JoinProjectView() {
  const { t } = useTranslation('collab');

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" data-testid="join-project-view">
      <div>
        <h1 className="text-lg font-semibold">{t('join.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('join.description')}</p>
      </div>
      <JoinProjectForm />
    </div>
  );
}
