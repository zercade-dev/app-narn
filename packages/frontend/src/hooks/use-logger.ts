import { useEffect } from 'react';
import type { LogPoolDropCounts } from '@zercade-dev/narn-shared';
import { useLoggerStore } from '../stores/logger-store.js';
import type { LogEntry } from '../stores/logger-store.js';
import { useVaultStore } from '../stores/vault-store.js';

export interface UseLoggerResult {
  entries: LogEntry[];
  /** Entries evicted from the info/priority pools since the last clear. */
  droppedCounts: LogPoolDropCounts;
  connected: boolean;
  clearEntries: () => void;
}

export function useLogger(): UseLoggerResult {
  const entries = useLoggerStore((s) => s.entries);
  const droppedCounts = useLoggerStore((s) => s.droppedCounts);
  const connected = useLoggerStore((s) => s.connected);
  const connect = useLoggerStore((s) => s.connect);
  const disconnect = useLoggerStore((s) => s.disconnect);
  const clearEntries = useLoggerStore((s) => s.clear);
  const vaultUnlocked = useVaultStore((s) => s.unlocked);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // The log stream is vault-gated: a stream opened while the vault was locked
  // died on the 423 response. Reconnect as soon as the vault unlocks —
  // connect() keeps a live stream and only replaces dead ones.
  useEffect(() => {
    if (vaultUnlocked) connect();
  }, [vaultUnlocked, connect]);

  return { entries, droppedCounts, connected, clearEntries };
}
