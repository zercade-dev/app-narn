import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAutoSaveOptions<T> {
  save: (value: T) => Promise<void>;
  debounceMs?: number;
}

export interface UseAutoSave<T> {
  status: AutoSaveStatus;
  error: string | null;
  schedule: (value: T) => void;
  flush: () => Promise<void>;
}

export function useAutoSave<T>({ save, debounceMs = 600 }: UseAutoSaveOptions<T>): UseAutoSave<T> {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  // Keep the latest `save` without re-creating `run`/`schedule` every render —
  // callers typically pass an inline closure. Synced in a layout effect (not
  // during render — react-hooks/refs forbids mutating a ref while rendering),
  // which still runs synchronously after commit and before any event/effect
  // that could call `schedule`/`flush`.
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  const run = useCallback(async () => {
    if (!pending.current) return;
    const { value } = pending.current;
    pending.current = null;
    setStatus('saving');
    setError(null);
    try {
      await saveRef.current(value);
      setStatus('saved');
    } catch (e) {
      // Keep the caller's edited value; next schedule/flush retries. A 423 still
      // propagates via apiRequest's own vault-unlock handling before reaching here.
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void run();
      }, debounceMs);
    },
    [run, debounceMs],
  );

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await run();
  }, [run]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { status, error, schedule, flush };
}
