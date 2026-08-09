import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PixelIcon } from '@/components/ui/pixel-icon';
import { cn } from '@/lib/utils';
import { presentEntry } from '@/lib/log-presentation/present.js';
import { visibleMeta } from '@/lib/log-presentation/fallback.js';
import type { LogGroup } from '@/lib/log-presentation/group.js';
import type { LogEntry } from '@/stores/logger-store.js';

const LEVEL_BADGE_VARIANT: Record<
  LogEntry['level'],
  'destructive' | 'outline' | 'secondary' | 'ghost'
> = {
  error: 'destructive',
  warn: 'secondary',
  info: 'outline',
  debug: 'ghost',
  notification: 'outline',
};

const LEVEL_BADGE_LABEL: Record<LogEntry['level'], string> = {
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
  notification: 'notif',
};

/** `key=value`, objects JSON-stringified. */
function formatMetaEntry([k, v]: [string, unknown]): string {
  return `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
}

/** One retained group member's timestamp + metadata (minus `stack`), compact. */
function memberDetailLine(member: LogEntry): string {
  const time = new Date(member.timestamp).toLocaleTimeString();
  if (!member.metadata) return time;
  const pairs = Object.entries(member.metadata).filter(([k]) => k !== 'stack');
  return pairs.length > 0 ? `${time} ${pairs.map(formatMetaEntry).join(' ')}` : time;
}

interface ConsoleLogRowProps {
  group: LogGroup;
  expanded: boolean;
  onToggle: () => void;
}

export function ConsoleLogRow({ group, expanded, onToggle }: Readonly<ConsoleLogRowProps>) {
  const { t } = useTranslation('logs');
  const { t: tConsole } = useTranslation('console');
  const entry = group.head;
  const presented = presentEntry(entry, t);
  const isLqaFailed = entry.message.startsWith('lqa:failed');
  const isLqaOverflow = entry.message.startsWith('lqa:overflow');
  const stack = typeof entry.metadata?.stack === 'string' ? entry.metadata.stack : null;

  return (
    <>
      <div className="flex gap-2 items-start">
        <span className="text-muted-foreground/60 shrink-0 text-[10px]">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <Badge
          variant={
            isLqaFailed
              ? 'destructive'
              : isLqaOverflow
                ? 'secondary'
                : LEVEL_BADGE_VARIANT[entry.level]
          }
          className={cn(
            'shrink-0 w-10 justify-center uppercase text-[10px] px-1',
            isLqaOverflow && 'bg-status-warn text-white',
            entry.level === 'notification' && 'bg-type-dialogue/15 text-type-dialogue',
          )}
        >
          {LEVEL_BADGE_LABEL[entry.level]}
        </Badge>
        {/* Log payload: program output, not UI chrome. `data-content` opts it out
            of the theme's display/pixel font, unreadable at this length. */}
        <span className="break-words flex-1" data-content>
          {presented.text}
          {/* A mapped presenter authored its whole line, so its metadata is
              redundant here. A fallback row hasn't — without this, a row like
              "Orphan — detected" would lose its count. */}
          {presented.isFallback && visibleMeta(entry.metadata).length > 0 && (
            <span className="text-muted-foreground/50 ml-1">
              {visibleMeta(entry.metadata).map(formatMetaEntry).join(' ')}
            </span>
          )}
          {group.count > 1 && (
            <Badge
              variant="outline"
              data-testid="console-repeat-count"
              title={tConsole('repeatCount', { count: group.count })}
              className="ml-1.5 px-1 text-[10px] align-middle"
            >
              ×{group.count}
            </Badge>
          )}
          {presented.action && (
            <button
              type="button"
              data-testid="console-log-action"
              onClick={presented.action.run}
              className="ml-2 underline underline-offset-2 hover:no-underline cursor-pointer bg-transparent"
            >
              {t(presented.action.labelKey)}
            </button>
          )}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={tConsole('showDetails')}
          title={tConsole('showDetails')}
          data-testid="console-details-toggle"
          className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <PixelIcon
            name="chevron-right"
            fallback={ChevronRight}
            className={cn('size-4 transition-transform', expanded && 'rotate-90')}
          />
        </button>
      </div>
      {expanded && (
        <pre
          data-testid="console-details"
          data-content
          className={cn(
            'mt-0.5 ml-24 text-[10px] whitespace-pre-wrap break-words leading-4',
            entry.level === 'error' || isLqaFailed
              ? 'text-status-fail'
              : 'text-muted-foreground/70',
          )}
        >
          {entry.message}
          {entry.metadata
            ? `\n${Object.entries(entry.metadata)
                .filter(([k]) => k !== 'stack')
                .map(formatMetaEntry)
                .join('\n')}`
            : ''}
          {stack ? `\n\n${stack}` : ''}
        </pre>
      )}
      {expanded && group.count > 1 && (
        <div
          data-testid="console-group-members"
          className="mt-0.5 ml-24 text-[10px] whitespace-pre-wrap break-words leading-4 text-muted-foreground/70"
        >
          {group.members.map((member) => (
            <div key={member.id}>{memberDetailLine(member)}</div>
          ))}
          {group.count > group.members.length && (
            <div>{tConsole('membersNotShown', { count: group.count - group.members.length })}</div>
          )}
        </div>
      )}
    </>
  );
}
