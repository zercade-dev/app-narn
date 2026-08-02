import { useTranslation } from 'react-i18next';
import type { JudgeLogEntry } from '@zercade-dev/narn-shared';

/** Renders one captured verbose log line — its message plus the notable parts
 * of its payload (the system/user prompt on a request, the raw response text on
 * a response), with anything else dumped as JSON. */
function RunLogEntryView({ entry }: Readonly<{ entry: JudgeLogEntry }>) {
  const meta = entry.meta ?? {};
  // The big, human-relevant fields get their own labeled blocks; the rest
  // (model, count, usage, finishReason, …) collapse into a compact JSON line.
  const big: Array<[string, unknown]> = [
    ['system', meta.system],
    ['user', meta.user],
    ['text', meta.text],
  ];
  const rest = Object.fromEntries(
    Object.entries(meta).filter(([k]) => !['system', 'user', 'text'].includes(k)),
  );
  const hasRest = Object.keys(rest).length > 0;

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
      <div className="font-mono font-medium">{entry.message}</div>
      {big.map(([label, value]) =>
        typeof value === 'string' && value.length > 0 ? (
          <div key={label} className="mt-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <pre className="mt-0.5 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-1.5 font-mono text-[11px]">
              {value}
            </pre>
          </div>
        ) : null,
      )}
      {hasRest && (
        <pre className="mt-1.5 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-1.5 font-mono text-[11px] text-muted-foreground">
          {JSON.stringify(rest, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Collapsible panel showing the verbose prompt/params and raw responses captured
 * for an AI run (judge, source-review, glossary-gen, category-gen). Present only
 * when the run was executed with a verbose-configured instance. Hidden when the
 * run captured no log.
 */
export function RunLogsPanel({
  logs,
  loading,
  testId = 'run-judge-logs',
}: Readonly<{ logs: JudgeLogEntry[] | undefined; loading: boolean; testId?: string }>) {
  const { t } = useTranslation('strings');
  if (loading || !logs || logs.length === 0) return null;
  return (
    <details className="mt-3 rounded-md border border-border/60" data-testid={testId}>
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground">
        {t('runs.judgeLogsTitle', { count: logs.length })}
      </summary>
      {/* Constrain growth so expanding the panel scrolls the log content itself
          rather than the whole page. */}
      <div className="max-h-[50vh] space-y-2 overflow-auto px-3 pb-3">
        {logs.map((entry, i) => (
          <RunLogEntryView key={`${entry.at}-${i}`} entry={entry} />
        ))}
      </div>
    </details>
  );
}
