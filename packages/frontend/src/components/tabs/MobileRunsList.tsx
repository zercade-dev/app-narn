import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { runTypeLabel } from '@zercade-dev/narn-shared';
import { useRunStore } from '../../stores/run-store.js';
import { Card } from '../ui/card';
import { RunProgressBar } from '../ui/run-progress-bar';
import { RunStatusBadge } from './RunStatusBadge.js';
import { chatRunData, chatTypeKey } from './run-status-ui.js';
import { RUN_TYPE_KEY, isChatRun } from '@/lib/run-kind';
import { relativeTime } from '@/lib/utils';
import { useRelativeTimeTick } from '../config/ModelRefreshControl.js';

/**
 * Read-only mobile presentation of the Activity tab: one card per run with
 * type, status badge, progress and counts. Same run store + polling as
 * RunsTab; deliberately NO actions (cancel/retry/pause are desktop-only —
 * mobile is read-only by design).
 */
export function MobileRunsList({ projectId }: Readonly<{ projectId: string }>) {
  const { t } = useTranslation('strings');
  const runs = useRunStore((s) => s.runs);
  const startPolling = useRunStore((s) => s.startPolling);
  // Stable sentinel Date for useRelativeTimeTick — identity never changes
  // across renders, only whether it's passed (vs. null) does. `useState`
  // (not `useRef`) because reading `.current` during render is disallowed.
  const [tickAnchor] = useState(() => new Date());

  useEffect(() => {
    if (projectId) startPolling(projectId);
    // No unmount cleanup here on purpose: a run started from any tab kicks
    // off the store's self-rescheduling poll loop, which is not tied to any
    // component's lifecycle — `fetchRuns` already self-terminates the loop
    // once no run is active (run-store.ts). Calling stopPolling() here would
    // kill that loop out from under a still-running run just because the user
    // navigated away from the mobile Activity list, silently defeating both the
    // run-failure toast and every surface's live run status for the rest of
    // that run.
  }, [projectId, startPolling]);

  const list = runs ?? [];
  // Keeps each card's relative-time label ("5m ago") fresh; ticks only
  // while there's at least one card to relabel.
  useRelativeTimeTick(list.length > 0 ? tickAnchor : null);
  return (
    <div className="space-y-3" data-testid="mobile-runs-list">
      <h2 className="text-lg font-semibold">{t('runs.title')}</h2>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="mobile-runs-empty">
          {t('runs.mobileEmpty')}
        </p>
      ) : (
        list.map((run) => {
          const isChat = isChatRun(run);
          const chatData = isChat ? chatRunData(run) : undefined;
          return (
            <Card
              key={run.runId}
              className="space-y-2 p-3"
              data-testid={`mobile-run-card-${run.runId}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 truncate text-sm font-medium">
                  {isChat && <MessageSquare className="size-3" />}
                  {isChat
                    ? t(chatTypeKey(chatData?.chatKind))
                    : t(RUN_TYPE_KEY[runTypeLabel(run.kind)])}
                </span>
                <RunStatusBadge status={run.status} />
              </div>
              <div className="flex items-center justify-between gap-2">
                {isChat ? (
                  // A chat session has no progress semantics (no total to
                  // complete against) — show the turn count instead of a
                  // bar, mirroring RunsTab's desktop chat row.
                  <span
                    className="flex-1 text-xs text-muted-foreground"
                    data-testid={`mobile-run-chat-turns-${run.runId}`}
                  >
                    {t('runs.chatTurns', { count: chatData?.turns ?? run.total })}
                  </span>
                ) : (
                  <RunProgressBar
                    completed={run.completed}
                    failed={run.failed}
                    total={run.total}
                    status={run.status}
                    aria-label={t('runs.stringsProgress', {
                      completed: run.completed,
                      total: run.total,
                    })}
                    className="flex-1"
                  />
                )}
                <span
                  className="shrink-0 text-xs text-muted-foreground"
                  title={new Date(run.startedAt).toLocaleString()}
                >
                  {relativeTime(new Date(run.startedAt))}
                </span>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
