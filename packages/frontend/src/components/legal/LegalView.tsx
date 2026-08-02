import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { LEGAL_PAGES, buildLegalUrl } from './legal-links.js';

export function LegalView() {
  const { t, i18n } = useTranslation('legal');
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-1 text-lg font-semibold">{t('title')}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{t('subtitle')}</p>
      <ul className="divide-y rounded-md border">
        {LEGAL_PAGES.map((p) => (
          <li key={p.slug}>
            <a
              href={buildLegalUrl(p.slug, lang)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
              data-testid={`legal-link-${p.slug}`}
            >
              <span>{t(p.labelKey)}</span>
              <ExternalLink className="size-4 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
