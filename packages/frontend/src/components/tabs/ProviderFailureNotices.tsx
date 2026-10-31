import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import type { RunStatus } from '@zercade-dev/narn-shared';
import { PROVIDER_FAILURE_ROUTING_KEY } from '@/lib/run-kind';

/** The lasting repeated-failure lines on a run's card, one per failure group. */
export function ProviderFailureNotices({ run }: Readonly<{ run: RunStatus }>) {
  const { t } = useTranslation('strings');
  return run.providerFailureNotices?.map((notice) => (
    <div
      key={notice.id}
      className="mt-1 flex items-start gap-1 text-[10px] text-status-warn"
      data-testid={`run-provider-failure-${run.runId}-${notice.id}`}
    >
      <AlertCircle className="size-3 shrink-0" />
      <span className="min-w-0 break-words">
        {t('runs.providerFailureNotice', {
          model: notice.model,
          count: notice.count,
          message: notice.message,
        })}{' '}
        {t(PROVIDER_FAILURE_ROUTING_KEY[notice.routing])}
      </span>
    </div>
  ));
}
