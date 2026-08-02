import { Component, type ReactNode } from 'react';
import { useSystemStatusStore } from '@/stores/system-status-store';

/**
 * Top-level crash boundary. A render crash may have taken i18next down, so the
 * fallback uses a HARDCODED English string (never `t()`) and points the user at the
 * bug-report address. `componentDidCatch` logs best-effort to the console.
 */
interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[narn] unhandled render error', error);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    // Class component — no hooks. Zustand's getState() is the supported
    // imperative read, and a re-render is not needed here: the boundary is
    // terminal until the user reloads.
    const supportEmail = useSystemStatusStore.getState().status?.supportEmail ?? null;
    return (
      <div role="alert" style={{ maxWidth: 480, margin: '4rem auto', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>
          Please reload the page.
          {supportEmail && (
            <>
              {' '}
              If it keeps happening, report it to{' '}
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
            </>
          )}
        </p>
        <button type="button" onClick={() => globalThis.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
