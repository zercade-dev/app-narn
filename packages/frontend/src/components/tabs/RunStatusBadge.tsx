import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/badge';
import { RunStatusCode } from '@zercade-dev/narn-shared';
import { TINT_AMBER, TINT_SKY, TINT_EMERALD, TINT_RED } from './run-status-ui.js';

/** Status → tinted badge, extracted from RunsTab's getStatusBadge so the
 * mobile runs list renders identical badges. */
export function RunStatusBadge({ status }: Readonly<{ status: RunStatusCode }>) {
  const { t } = useTranslation('strings');
  switch (status) {
    case RunStatusCode.Pending:
      return <Badge variant="secondary">{t('runs.statusPending')}</Badge>;
    case RunStatusCode.Queued:
      return (
        <Badge variant="secondary" className={TINT_AMBER}>
          {t('runs.statusQueued')}
        </Badge>
      );
    case RunStatusCode.Paused:
      return (
        <Badge variant="secondary" className={TINT_AMBER}>
          {t('runs.statusPaused')}
        </Badge>
      );
    case RunStatusCode.Running:
      return (
        <Badge variant="secondary" className={TINT_SKY}>
          {t('runs.statusRunning')}
        </Badge>
      );
    case RunStatusCode.Completed:
      return (
        <Badge variant="secondary" className={TINT_EMERALD}>
          {t('runs.statusCompleted')}
        </Badge>
      );
    case RunStatusCode.Failed:
      return (
        <Badge variant="secondary" className={TINT_RED}>
          {t('runs.statusFailed')}
        </Badge>
      );
    case RunStatusCode.Cancelled:
      return <Badge variant="outline">{t('runs.statusCancelled')}</Badge>;
    default: {
      // A new RunStatusCode must add a branch above; this fails the build.
      const _exhaustive: never = status;
      void _exhaustive;
      return null;
    }
  }
}
