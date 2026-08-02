// Nonce is injected at build time via Vite
const CSP_NONCE = '__CSP_NONCE__';

export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", `'nonce-${CSP_NONCE}'`, "'strict-dynamic'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'", 'http://localhost:3001'],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'object-src': ["'none'"],
  'media-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'frame-src': ["'none'"],
  'manifest-src': ["'self'"],
  'child-src': ["'self'", 'blob:'],
  'report-uri': ['/csp-violation'],
  'report-to': ['csp-endpoint'],
};
