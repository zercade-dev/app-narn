import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import path from 'path';
import { CSP_DIRECTIVES } from './src/security/csp.js';
// @ts-expect-error - build-time ESM utility, no type declarations.
import { stripComments, findComments, kindForPath } from './build/comments.mjs';
// @ts-expect-error - build-time ESM utility, no type declarations.
import { emitLicensesPlugin } from './build/licenses.mjs';
import { readFileSync } from 'node:fs';

// App version, read from the workspace-root manifest (package.json) and injected
// into the bundle below via `define`. Surfaced in the Guide tab's About line so the
// running build is identifiable. It is bumped ONCE PER RELEASE, by
// `make release-prep VERSION=…` (scripts/release-prep.mjs) — an individual change
// adds a changelog fragment instead, which that same script consolidates.
const APP_VERSION = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
  ) as { version: string }
).version;

// Strip every comment (HTML / CSS / JS) from the built bundle, then assert none
// survive. Production parity with the cloud server's static-page guarantee: e.g.
// Tailwind emits a `/*! tailwindcss … */` banner that would otherwise ship in the
// CSS. Runs at build only; index.html, emitted CSS, and JS chunks all pass through.
// JS parse failures are non-fatal (rolldown already strips JS comments) so a future
// syntax acorn can't read never breaks the build; HTML/CSS are enforced strictly.
function stripCommentsPlugin() {
  return {
    name: 'strip-comments',
    apply: 'build' as const,
    generateBundle(_options: unknown, bundle: Record<string, any>) {
      for (const [fileName, file] of Object.entries(bundle)) {
        const kind = kindForPath(fileName);
        if (!kind) continue;
        const isChunk = file.type === 'chunk';
        const original = isChunk ? file.code : file.source;
        if (typeof original !== 'string') continue; // binary asset
        let stripped: string;
        try {
          stripped = stripComments(original, kind);
        } catch (err) {
          if (kind === 'js') continue; // trust rolldown's already-stripped JS
          throw new Error(`strip-comments: failed to parse ${fileName}: ${(err as Error).message}`);
        }
        let remaining: Array<{ line: number; snippet: string }> = [];
        try {
          remaining = findComments(stripped, kind);
        } catch {
          remaining = [];
        }
        if (remaining.length > 0) {
          throw new Error(
            `strip-comments: ${fileName} still has ${remaining.length} comment(s) after stripping ` +
              `(e.g. line ${remaining[0].line}: ${remaining[0].snippet})`,
          );
        }
        if (isChunk) file.code = stripped;
        else file.source = stripped;
      }
    },
  };
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Coverage mode: the e2e harness collects raw V8 coverage over CDP, and the
// report step unbundles it
// via source maps — so a coverage-mode build must emit them (build.sourcemap below).
// Normal builds stay map-free.
const E2E_COVERAGE_MODE = process.env.E2E_COVERAGE === 'true';

// Ports (and the dev-server cache dir) are env-configurable so several
// server+frontend pairs can coexist on one machine (e.g. sharded e2e runs).
// Defaults preserve the single-pair behavior exactly.
const VITE_PORT = Number(process.env.VITE_PORT ?? 5173);
const API_PORT = Number(process.env.API_PORT ?? 3001);

// Generate a random nonce for this build
const BUILD_NONCE = generateBuildNonce();

function generateBuildNonce(): string {
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Buffer.from(array).toString('base64');
}

// Dev cannot use the nonce policy: Vite injects inline scripts (@vite/client
// bootstrap, react-refresh preamble) that carry no nonce, and 'strict-dynamic'
// disables the 'self' allowance for /@vite/client. The built app keeps the
// strict nonce-based policy (inject-nonce plugin below).
function generateDevCSPHeader(): string {
  const dev: Record<string, string[]> = {
    ...CSP_DIRECTIVES,
    'script-src': ["'self'", "'unsafe-inline'"],
    'connect-src': ["'self'", `http://localhost:${API_PORT}`, `ws://localhost:${VITE_PORT}`],
  };
  return Object.entries(dev)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'inject-nonce',
      transformIndexHtml(html, ctx) {
        if (ctx.server) {
          // Dev: drop the meta CSP (the relaxed dev header below governs) and
          // the placeholder nonces, which the browser would enforce verbatim.
          return html
            .replace(/^\s*<meta http-equiv="Content-Security-Policy".*\r?\n/m, '')
            .replace(/\s+nonce="__CSP_NONCE__"/g, '');
        }
        // Build: replace the placeholder nonce, then stamp the same nonce onto
        // every <script> tag Vite emits (the module entry + preload polyfill).
        // Without this, 'strict-dynamic' in the meta CSP blocks the static
        // <script type="module"> tags that carry no nonce attribute.
        return html
          .replace(/__CSP_NONCE__/g, BUILD_NONCE)
          .replace(/<script\b([^>]*?)>/g, (match, attrs: string) => {
            if (/\bnonce=/.test(attrs)) return match; // already has a nonce
            return `<script${attrs} nonce="${BUILD_NONCE}">`;
          });
      },
    },
    stripCommentsPlugin(),
    // The other half of the stripping above: comments go, and the licence
    // notices they carried are re-emitted beside the bundle as dist/LICENSES.txt,
    // read from each bundled package's own installed licence file. See
    // build/licenses.mjs for how the package set is derived (from the bundle,
    // not from a manifest) and THIRD-PARTY-NOTICES.md for what it means.
    emitLicensesPlugin(),
  ],
  // Parallel e2e workers give each Vite instance its own cache dir to avoid
  // concurrent dep-optimizer clashes; unset → Vite's default node_modules/.vite.
  cacheDir: process.env.VITE_CACHE_DIR,
  server: {
    port: VITE_PORT,
    // When a port is requested explicitly, failing beats silently drifting to
    // port+1 (a parallel-runner health check would attach to the wrong app).
    strictPort: process.env.VITE_PORT !== undefined,
    watch: {
      usePolling: true,
      // Coverage reports land inside the watched tree; without this, writing
      // the coverage report mid-suite triggers full page reloads of the app
      // under test (and polling re-scans it all).
      ignored: ['**/coverage/**'],
    },
    hmr: {
      host: 'localhost',
      clientPort: VITE_PORT,
    },
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
    headers: {
      'Content-Security-Policy': generateDevCSPHeader(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    },
  },
  // Built-app serving for fast e2e workers: vite preview serves the prebuilt
  // dist/ (no JIT transform, no watcher) and proxies /api like the dev server,
  // so each sharded e2e worker gets a static drop-in for the dev pair. Ports
  // are env-driven for isolated parallel workers, matching the server block
  // above.
  preview: {
    port: VITE_PORT,
    strictPort: process.env.VITE_PORT !== undefined,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@zercade-dev/narn-shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@/': path.resolve(__dirname, './src') + '/',
    },
  },
  build: {
    sourcemap: E2E_COVERAGE_MODE,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.names[0] === 'style.css') {
            return 'assets/style.css';
          }
          if (assetInfo.names[0] === 'main.js') {
            return 'assets/main.js';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
