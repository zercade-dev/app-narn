export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

/**
 * Synthetic pseudo-localization language. It is a constant registry entry so
 * it can be enabled as a target language in any project, but it is never a
 * real shippable language: the router only ever assigns it to the pseudo
 * module (and the pseudo module only ever receives it), and the CSV export
 * can substitute its text into a real language column for in-game testing.
 */
export const PSEUDO_LANGUAGE_CODE = 'pseudo-test';

/** Module id of the pseudo-localization module (modules/pseudo). */
export const PSEUDO_MODULE_ID = 'pseudo';

export const LANGUAGE_REGISTRY: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh-hans', name: 'Simplified Chinese', nativeName: '中文（简体）' },
  { code: 'zh-hant', name: 'Traditional Chinese', nativeName: '中文（繁體）' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'pt-br', name: 'Portuguese', nativeName: 'Português (Brasil)' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: PSEUDO_LANGUAGE_CODE, name: 'Pseudo Test', nativeName: '⟦Ƥşèùδô Ŧèşţ⟧' },
];
