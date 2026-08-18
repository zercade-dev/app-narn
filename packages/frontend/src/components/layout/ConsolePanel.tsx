import { useState, useRef, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Trash2,
  Download,
  ArrowDownToLine,
  Lock,
} from 'lucide-react';
import { useLogger } from '../../hooks/use-logger.js';
import { useLoggerStore, type LogEntry } from '../../stores/logger-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { vaultLockedEvent } from '../../lib/vault-events.js';
import { useUiSettings, type ConsoleFilter } from '../../stores/ui-settings-store.js';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PixelIcon } from '@/components/ui/pixel-icon';
import { cn, downloadBlob } from '@/lib/utils';
import { ConsoleLogRow } from './ConsoleLogRow.js';
import { groupEntries } from '@/lib/log-presentation/group.js';
import { presentEntry } from '@/lib/log-presentation/present.js';

/** Distance (px) from the bottom within which the viewport counts as "pinned". */
const PIN_THRESHOLD_PX = 32;

/**
 * Lower-cased, searchable text for an entry: the friendly text a reader sees,
 * plus the raw message and metadata a developer would search for.
 */
function entryMatchesQuery(entry: LogEntry, query: string, friendly: string): boolean {
  if (friendly.toLowerCase().includes(query)) return true;
  if (entry.message.toLowerCase().includes(query)) return true;
  if (entry.metadata) {
    try {
      if (JSON.stringify(entry.metadata).toLowerCase().includes(query)) return true;
    } catch {
      // metadata that can't be serialised (e.g. circular) simply doesn't match
    }
  }
  return false;
}

const FILTER_LEVELS: ConsoleFilter[] = ['all', 'error', 'warn', 'info', 'debug', 'notifications'];

/** Export file formats offered by the console panel. */
type ExportFormat = 'json' | 'text';

/** i18n label key per export format — shared by the option list and the trigger label. */
const EXPORT_FORMAT_LABEL_KEYS: Record<ExportFormat, string> = {
  json: 'exportFormatJson',
  text: 'exportFormatText',
};

/** Format a single metadata `[key, value]` pair as `key=value` (objects JSON-stringified). */
function formatMetaEntry([k, v]: [string, unknown]): string {
  return `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
}

/** Render one log entry as a single readable line: `[ISO] LEVEL message meta…`. */
function entryToTextLine(entry: LogEntry): string {
  const timestamp = new Date(entry.timestamp).toISOString();
  const level = entry.level.toUpperCase();
  const meta = entry.metadata ? Object.entries(entry.metadata).map(formatMetaEntry).join(' ') : '';
  return `[${timestamp}] ${level} ${entry.message}${meta ? ` ${meta}` : ''}`;
}

interface ConsolePanelProps {
  open: boolean;
  onToggle: () => void;
}

export function ConsolePanel({ open, onToggle }: Readonly<ConsolePanelProps>) {
  'use no memo'; // TanStack Virtual's useVirtualizer() returns functions the
  // React Compiler cannot memoize safely, so opt this component out.
  const { t } = useTranslation('console');
  const { t: tLogs } = useTranslation('logs');
  const vaultUnlocked = useVaultStore((s) => s.unlocked);
  const vaultExists = useVaultStore((s) => s.hasVault);
  const {
    entries,
    droppedCounts: rawDroppedCounts,
    serverDroppedCounts: rawServerDroppedCounts,
    connected,
    clearEntries,
  } = useLogger();
  const captureStatus = useLoggerStore((s) => s.captureStatus);
  const captureError = useLoggerStore((s) => s.captureError);
  const refreshCaptureStatus = useLoggerStore((s) => s.refreshCaptureStatus);
  const setCaptureActive = useLoggerStore((s) => s.setCaptureActive);
  const downloadCapture = useLoggerStore((s) => s.downloadCapture);
  // Tolerate an absent `droppedCounts`/`serverDroppedCounts` (e.g. a test
  // double or an older useLogger() shape that predates the field) rather than
  // crashing the whole panel on `.info`.
  const droppedCounts = rawDroppedCounts ?? { info: 0, priority: 0 };
  const serverDroppedCounts = rawServerDroppedCounts ?? { info: 0, priority: 0 };
  // The two sides are disjoint, so they add: `droppedCounts` is what THIS
  // browser's pool evicted, while `serverDroppedCounts` is fixed at the first
  // connect of the page session (see logger-store) and so only covers server
  // history from before this client's stream existed. Everything the server
  // shed afterwards was already delivered here and is counted, if at all, by
  // this browser's own evictions.
  const totalDropped =
    droppedCounts.info +
    droppedCounts.priority +
    serverDroppedCounts.info +
    serverDroppedCounts.priority;
  const consoleFilter = useUiSettings((s) => s.consoleFilter);
  const setConsoleFilter = useUiSettings((s) => s.setConsoleFilter);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [panelHeight, setPanelHeight] = useState(200);
  const [search, setSearch] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  // Whether the viewport is pinned to (near) the bottom. Drives auto-scroll:
  // we only chase new entries while the user is already at the bottom.
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  // True when entries arrived while the user was scrolled up; shows the
  // "Jump to latest" affordance.
  const [hasNewWhileScrolled, setHasNewWhileScrolled] = useState(false);
  // Errors are "unread" if they arrived while the panel was closed. While the
  // panel is open everything is visible, so the marker resets on both open and
  // close transitions and the count is forced to zero while open.
  const [lastSeenAt, setLastSeenAt] = useState(() => Date.now());
  const dragStateRef = useRef<{ startY: number; startH: number } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Set while we scroll the viewport ourselves, so the scroll listener doesn't
  // mistake our own programmatic scroll for the user scrolling away.
  const programmaticScrollRef = useRef(false);

  function handleResizeStart(e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault();
    dragStateRef.current = { startY: e.clientY, startH: panelHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragStateRef.current) return;
      const maxH = Math.round(globalThis.innerHeight * 0.9);
      const delta = dragStateRef.current.startY - ev.clientY;
      setPanelHeight(Math.max(80, Math.min(maxH, dragStateRef.current.startH + delta)));
    };
    const onUp = () => {
      dragStateRef.current = null;
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('mouseup', onUp);
    };
    globalThis.addEventListener('mousemove', onMove);
    globalThis.addEventListener('mouseup', onUp);
  }

  function getFilteredEntries() {
    const query = search.trim().toLowerCase();
    return entries.filter((e) => {
      const levelOk =
        consoleFilter === 'all'
          ? true
          : consoleFilter === 'notifications'
            ? e.level === 'notification'
            : e.level === consoleFilter;
      if (!levelOk) return false;
      return query === '' || entryMatchesQuery(e, query, presentEntry(e, tLogs).text);
    });
  }
  const filteredEntries = getFilteredEntries();
  const groups = groupEntries(filteredEntries);

  // eslint-disable-next-line react-hooks/incompatible-library -- the 'use no memo' directive above opts this component out of the React Compiler, which is the documented TanStack Virtual integration.
  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  // Download the currently filtered entries (both level filter and search
  // applied) in the selected format. Runs in the browser, so a wall-clock
  // timestamp for the filename is fine.
  //
  // Includes the dropped counts alongside the entries: they're what started
  // this whole feature (an exported log read clean even though the run had
  // 142 failed entries the ring buffer had already evicted before export).
  // The on-screen marker shows them; the file must too, or someone reading it
  // offline has no way to tell entries are missing.
  function handleExport(): void {
    const stamp = new Date().getTime();
    const blob =
      exportFormat === 'text'
        ? new Blob(
            [
              [
                totalDropped > 0 ? `# ${t('droppedEntries', { count: totalDropped })}` : undefined,
                ...filteredEntries.map(entryToTextLine),
              ]
                .filter((line) => line !== undefined)
                .join('\n'),
            ],
            { type: 'text/plain' },
          )
        : new Blob(
            [
              JSON.stringify(
                { droppedCounts, serverDroppedCounts, entries: filteredEntries },
                null,
                2,
              ),
            ],
            { type: 'application/json' },
          );
    const extension = exportFormat === 'text' ? 'txt' : 'json';
    downloadBlob(blob, `console-logs-${stamp}.${extension}`);
  }

  function toggleExpand(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function isAtBottom(el: HTMLDivElement): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_THRESHOLD_PX;
  }

  function scrollToBottom(behavior: ScrollBehavior): void {
    // Suppress the scroll listener while we drive the viewport ourselves, so the
    // intermediate frames of a smooth scroll don't transiently flip the pin off.
    programmaticScrollRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior });
    setPinnedToBottom(true);
    setHasNewWhileScrolled(false);
  }

  // Track whether the viewport is pinned to the bottom via a scroll listener on
  // the virtualizer's scroll element. Re-attaches when the panel opens.
  useEffect(() => {
    const el = parentRef.current;
    if (!open || !el) return;
    const onScroll = () => {
      // Ignore the burst of scroll events our own programmatic scroll emits;
      // once the viewport settles at the bottom, clear the flag.
      if (programmaticScrollRef.current) {
        if (isAtBottom(el)) programmaticScrollRef.current = false;
        return;
      }
      const atBottom = isAtBottom(el);
      setPinnedToBottom(atBottom);
      if (atBottom) setHasNewWhileScrolled(false);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [open]);

  // Auto-scroll to the latest entry only while pinned to the bottom. When the
  // user has scrolled up, leave their viewport alone and remember that new
  // entries arrived so the "Jump to latest" affordance can appear. Keyed on the
  // newest entry's id (not just length): the store caps entries at a fixed max,
  // so under heavy logging the length stops changing while content still does.
  const newestEntryId = entries.length > 0 ? entries[entries.length - 1].id : null;
  useEffect(() => {
    if (!open || filteredEntries.length === 0) return;
    if (pinnedToBottom) {
      // Instant follow: smooth scrolling can't keep up with a high log rate and
      // its async animation fights the pin listener.
      scrollToBottom('auto');
    } else {
      setHasNewWhileScrolled(true);
    }
    // pinnedToBottom / filteredEntries read fresh each render; this effect fires
    // on new content, not on pin-state changes (Jump to latest re-pins itself).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestEntryId, filteredEntries.length, open]);

  // Re-measure items after expand/collapse so the virtualizer picks up the
  // new row height without waiting for the next ResizeObserver tick.
  useEffect(() => {
    virtualizer.measure();
  }, [expandedIds, virtualizer]);

  // Pull the capture status once whenever the panel opens, so the toggle and
  // download button reflect the server's current state (e.g. a capture
  // started from another tab/session).
  useEffect(() => {
    if (!open) return;
    void refreshCaptureStatus();
  }, [open, refreshCaptureStatus]);

  // While the panel is open AND a capture is active, poll the status every 5s
  // so entryCount/droppedCount/bytes keep advancing on screen during a long
  // run. Lives here, not in the store, so a background tab with the panel
  // closed never pays for it.
  useEffect(() => {
    if (!open || !captureStatus?.active) return;
    const interval = setInterval(() => {
      void refreshCaptureStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [open, captureStatus?.active, refreshCaptureStatus]);

  // Surface a server-refused capture start (all capture slots busy) once via
  // the app's shared toast pattern, then clear the flag so it doesn't re-fire.
  useEffect(() => {
    if (captureError !== 'slots-exhausted') return;
    toast.error(t('captureSlotsExhausted'));
    useLoggerStore.setState({ captureError: null });
  }, [captureError, t]);

  // Mark entries as seen on every open/close transition. State is adjusted
  // during render (not in an effect) so the closed bar never paints a frame
  // counting errors the user just watched scroll by while the panel was open.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setLastSeenAt(Date.now());
  }

  const unreadErrorCount = open
    ? 0
    : entries.filter((e) => e.level === 'error' && e.timestamp > lastSeenAt).length;

  return (
    <div
      role="region"
      aria-label={t('title')}
      className="border-t bg-muted text-muted-foreground flex flex-col overflow-hidden transition-[height] duration-200 ease-out shrink-0"
      style={{ height: open ? panelHeight : 32 }}
    >
      {/* Resize handle */}
      {open && (
        <div
          onMouseDown={handleResizeStart}
          className="h-1 cursor-row-resize hover:bg-foreground/20 transition-colors shrink-0"
          aria-hidden="true"
        />
      )}
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-8 text-xs select-none shrink-0">
        <button
          type="button"
          onClick={onToggle}
          data-testid="console-toggle"
          title={connected ? t('statusConnected') : t('statusDisconnected')}
          className="flex items-center gap-2 flex-1 text-left bg-transparent cursor-pointer h-full"
        >
          <Circle
            className={cn(
              'size-2 fill-current',
              // Red only when something is actually wrong: stream disconnected
              // or errors arrived unseen. At rest the dot stays quiet.
              !connected || unreadErrorCount > 0 ? 'text-status-fail' : 'text-muted-foreground/40',
            )}
          />
          <span className="font-semibold">{t('title')}</span>
          {vaultExists && !vaultUnlocked && (
            <span
              data-testid="vault-locked-banner"
              role="button"
              tabIndex={0}
              title={t('vaultLockedUnlockHint')}
              aria-label={t('vaultLockedUnlockHint')}
              className="inline-flex items-center gap-1 font-mono text-[12px] leading-none px-1 py-0.5 rounded bg-status-warn/15 hover:bg-status-warn/25 text-status-warn cursor-pointer"
              onClick={(e) => {
                // Stop the click from also firing the parent console-toggle
                // button's onClick — this chip has its own action.
                e.stopPropagation();
                globalThis.dispatchEvent(vaultLockedEvent({}));
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                // Prevent the parent button from also reacting to the key,
                // and (for Space) stop the page from scrolling.
                e.preventDefault();
                e.stopPropagation();
                globalThis.dispatchEvent(vaultLockedEvent({}));
              }}
            >
              <PixelIcon name="lock" fallback={Lock} className="size-2.5" />
              {t('vaultLocked')}
            </span>
          )}
          {unreadErrorCount > 0 && (
            <span
              data-testid="console-unread-errors"
              aria-label={t('unreadErrors', { count: unreadErrorCount })}
              title={t('unreadErrors', { count: unreadErrorCount })}
              className="font-mono text-[11px] leading-none px-1 py-0.5 rounded bg-status-fail/10 text-status-fail"
            >
              {unreadErrorCount}
            </span>
          )}
        </button>
        {open && (
          <>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
              <SelectTrigger
                size="sm"
                className="h-6 text-[10px] uppercase font-mono"
                aria-label={t('exportFormat')}
                title={t('exportFormat')}
                data-testid="console-export-format"
              >
                {/* Render-function maps the selected format to its human label;
                    without it base-ui prints the raw id ("json"/"text"). */}
                <SelectValue>
                  {(value: ExportFormat | null) =>
                    value ? t(EXPORT_FORMAT_LABEL_KEYS[value]) : ''
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(EXPORT_FORMAT_LABEL_KEYS) as [ExportFormat, string][]).map(
                  ([format, labelKey]) => (
                    <SelectItem key={format} value={format} label={t(labelKey)} className="text-xs">
                      {t(labelKey)}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              disabled={filteredEntries.length === 0}
              onClick={(e) => {
                e.stopPropagation();
                handleExport();
              }}
              aria-label={t('exportLogs')}
              title={t('exportLogs')}
              data-testid="console-export-action"
            >
              <Download className="size-3.5" />
            </Button>
            <label
              htmlFor="console-capture-toggle"
              title={t('captureTooltip')}
              className="flex items-center gap-1 text-[10px] font-mono uppercase cursor-pointer select-none"
            >
              <Checkbox
                id="console-capture-toggle"
                data-testid="console-capture-toggle"
                className="size-3.5"
                checked={captureStatus?.active ?? false}
                onCheckedChange={(checked) => {
                  void setCaptureActive(checked === true);
                }}
              />
              {t('captureLabel')}
            </label>
            {captureStatus && captureStatus.entryCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[10px] font-mono"
                onClick={(e) => {
                  e.stopPropagation();
                  void downloadCapture();
                }}
                data-testid="console-capture-download"
              >
                <ArrowDownToLine className="size-3" />
                {t('captureDownload', { captured: captureStatus.entryCount })}
                {captureStatus.droppedCount > 0 && (
                  <span className="text-status-warn">
                    {t('captureDropped', { dropped: captureStatus.droppedCount })}
                  </span>
                )}
              </Button>
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={(e) => {
            e.stopPropagation();
            clearEntries();
          }}
          aria-label={t('clear')}
          data-testid="console-clear"
        >
          <PixelIcon name="trash-2" fallback={Trash2} className="size-4" />
        </Button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? t('collapse') : t('expand')}
          className="bg-transparent cursor-pointer"
        >
          {open ? (
            <PixelIcon name="chevron-down" fallback={ChevronDown} className="size-4" />
          ) : (
            <PixelIcon name="chevron-up" fallback={ChevronUp} className="size-4" />
          )}
        </button>
      </div>

      {/* Virtualised log list */}
      {open && (
        <>
          {/* Level filter bar + search */}
          <div className="flex items-center gap-1 px-3 py-0.5 shrink-0 border-b border-border/40">
            <Tabs
              value={consoleFilter}
              onValueChange={(v) => v && setConsoleFilter(v as ConsoleFilter)}
            >
              <TabsList variant="line" className="group-data-horizontal/tabs:h-fit gap-0.5 p-0">
                {FILTER_LEVELS.map((level) => (
                  <TabsTrigger
                    key={level}
                    value={level}
                    data-testid={`filter-${level}`}
                    className="flex-none px-1.5 py-0 text-[10px] font-mono uppercase leading-5"
                  >
                    {t(`filter_${level}`, { defaultValue: level === 'all' ? 'All' : level })}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              data-testid="console-search"
              className="h-6 ml-auto max-w-48 text-[11px] font-mono"
            />
          </div>

          <div className="relative flex-1 min-h-0 flex flex-col">
            <div ref={parentRef} className="flex-1 overflow-auto font-mono text-[11px]">
              {totalDropped > 0 && (
                <div
                  data-testid="console-dropped-marker"
                  className="px-3 py-0.5 text-muted-foreground/60 italic"
                >
                  {t('droppedEntries', { count: totalDropped })}
                </div>
              )}
              {groups.length === 0 && (
                <div data-testid="console-empty" className="px-3 py-2 text-muted-foreground/60">
                  {t('empty')}
                </div>
              )}
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((vRow) => {
                  const group = groups[vRow.index];
                  const entry = group.head;
                  const isLqaFailed = entry.message.startsWith('lqa:failed');
                  const isLqaOverflow = entry.message.startsWith('lqa:overflow');
                  return (
                    <div
                      key={vRow.key}
                      data-index={vRow.index}
                      data-testid="console-log-row"
                      ref={virtualizer.measureElement}
                      className={cn(
                        'absolute top-0 left-0 w-full flex flex-col py-0.5 px-3',
                        (isLqaFailed || entry.level === 'error') && 'text-status-fail',
                        isLqaOverflow && 'text-status-warn',
                      )}
                      style={{ transform: `translateY(${vRow.start}px)` }}
                    >
                      <ConsoleLogRow
                        group={group}
                        expanded={expandedIds.has(entry.id)}
                        onToggle={() => toggleExpand(entry.id)}
                      />
                    </div>
                  );
                })}
              </div>
              <div ref={bottomRef} />
            </div>
            {!pinnedToBottom && hasNewWhileScrolled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => scrollToBottom('smooth')}
                aria-label={t('jumpToLatest')}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 h-6 gap-1 px-2 text-[11px] shadow-md"
              >
                <ArrowDownToLine className="size-3" />
                {t('jumpToLatest')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
