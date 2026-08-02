/**
 * "Still working" indicator shown by a chat panel from the moment a request
 * is sent until the first streamed text delta arrives. A reasoning-capable
 * model can hold the connection open for many seconds with zero bytes on the
 * wire while it thinks — without this, that gap renders as nothing at all,
 * which reads as a hung request rather than a slow one. The live elapsed-
 * seconds counter is what actually distinguishes "working" from "stuck"; a
 * static spinner does not.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ThinkingIndicatorProps {
  /** `Date.now()`-style epoch-ms timestamp the request was sent at. */
  startedAt: number;
}

export function ThinkingIndicator({
  startedAt,
}: Readonly<ThinkingIndicatorProps>): React.JSX.Element {
  const { t } = useTranslation('common');
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() - startedAt) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div
      className="mr-auto flex max-w-[85%] items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-sm text-muted-foreground"
      data-testid="thinking-indicator"
    >
      <span className="flex gap-0.5" aria-hidden="true">
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
      </span>
      {t('thinking', { seconds })}
    </div>
  );
}

/**
 * Wraps `ThinkingIndicator` with a stable send-time timestamp: mounted only
 * while the caller's `awaitingFirstToken` is true, it captures `Date.now()`
 * once via a lazy `useState` initializer (not read inline in JSX — that would
 * re-read the clock on every re-render and reset the elapsed-time interval,
 * making the counter jump backward). Unmounts when `awaitingFirstToken` goes
 * false, so the NEXT episode gets a fresh timestamp.
 */
export function ThinkingIndicatorHost(): React.JSX.Element {
  const [startedAt] = useState(() => Date.now());
  return <ThinkingIndicator startedAt={startedAt} />;
}
