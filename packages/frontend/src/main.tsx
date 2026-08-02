import { StrictMode } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n/index.js';
import { activateTheme, applyThemeAttribute, readStoredTheme } from './themes/theme-registry.js';
import App from './App.js';
import { ErrorBoundary } from './components/error/ErrorBoundary.js';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

// Load the active theme's CSS/fonts before first paint (no-op for default).
// Top-level await is fine here: the module graph is ESM and the loading
// splash in index.html is visible while this resolves. If the theme's lazy
// chunk fails to load (e.g. transient network error), fall back to the
// default theme rather than wedging the app at the loading splash.
try {
  await activateTheme(readStoredTheme());
} catch {
  // Theme chunk failed to load (e.g. transient network error): fall back to
  // the default theme rather than wedging the app at the loading splash.
  // The stored choice is kept — the next successful load restores it.
  applyThemeAttribute('default');
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Dev-only axe-core accessibility audit. Placed after render() so the top-level
// await never delays the initial React paint. The dynamic import keeps the
// package out of production bundles; results stream to the devtools console.
if (import.meta.env.DEV) {
  const { default: axe } = await import('@axe-core/react');
  axe(React, ReactDOM, 1000);
}
