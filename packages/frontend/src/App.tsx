import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell.js';
import { useVaultStore } from './stores/vault-store.js';
import { startSessionKeepalive } from './lib/session-keepalive.js';
import { useUrlSync } from './hooks/use-url-sync.js';

export default function App() {
  useUrlSync();
  // Cloud mode only: proactively refresh the session ahead of the ~1h
  // access-token rollover so an actively-using user is never logged out
  // mid-session. `cloudManaged` is server-derived (/api/vault/status) and false
  // in open-core — where /auth/refresh does not exist — so the keep-alive is
  // never started there. The scheduler funnels through the single-flight
  // `refreshSession`, so it cannot race the reactive 401 refresh.
  const cloudManaged = useVaultStore((s) => s.cloudManaged);
  useEffect(() => {
    if (!cloudManaged) return;
    return startSessionKeepalive();
  }, [cloudManaged]);

  return <AppShell />;
}
