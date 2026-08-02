/**
 * Multilingual aliases and special column name sets for CSV import/export.
 * Shared between the server-side importer and the frontend header validator.
 *
 * All keys and set entries are lower-cased so callers can normalise headers
 * with `header.toLowerCase()` before looking them up.
 */
import { LANGUAGE_REGISTRY } from './types/language.js';

/**
 * Maps lowercase translated language column names → language codes.
 * Covers all 15 supported languages as they appear in each of the 15 reference
 * CSVs (i.e., every language name in every supported UI language).
 */
export const LANGUAGE_COLUMN_ALIASES: Record<string, string> = {
  // ── English (en) ──────────────────────────────────────────────────────────
  anglais: 'en', // French
  englisch: 'en', // German
  inglés: 'en', // Spanish
  英語: 'en', // Japanese / Traditional Chinese
  英语: 'en', // Simplified Chinese
  영어: 'en', // Korean
  inglês: 'en', // Portuguese
  английский: 'en', // Russian
  inggris: 'en', // Indonesian
  inglese: 'en', // Italian
  ภาษาอังกฤษ: 'en', // Thai
  ingilizce: 'en', // Turkish (dotless lowercase)
  'i\u0307ngilizce': 'en', // Turkish (capital İ lowercased → i + U+0307)
  'tiếng anh': 'en', // Vietnamese

  // ── Simplified Chinese (zh-hans) ──────────────────────────────────────────
  'simplified chinese': 'zh-hans', // English alias
  'chinois simplifié': 'zh-hans', // French
  'chinesisch (vereinfacht)': 'zh-hans', // German
  'chino simplificado': 'zh-hans', // Spanish
  '中国語（簡体字）': 'zh-hans', // Japanese
  '중국어 (간체)': 'zh-hans', // Korean
  简体中文: 'zh-hans', // Simplified Chinese
  簡體中文: 'zh-hans', // Traditional Chinese
  'chinês (simplificado)': 'zh-hans', // Portuguese
  'упрощённый китайский': 'zh-hans', // Russian
  'mandarin sederhana': 'zh-hans', // Indonesian
  'cinese semplificato': 'zh-hans', // Italian
  ภาษาจีนตัวย่อ: 'zh-hans', // Thai
  'basitleştirilmiş çince': 'zh-hans', // Turkish
  'tiếng trung giản thể': 'zh-hans', // Vietnamese

  // ── Traditional Chinese (zh-hant) ─────────────────────────────────────────
  'traditional chinese': 'zh-hant', // English alias
  'chinois traditionnel': 'zh-hant', // French
  'chinesisch (traditionell)': 'zh-hant', // German
  'chino tradicional': 'zh-hant', // Spanish
  '中国語（繁体字）': 'zh-hant', // Japanese
  '중국어 (번체)': 'zh-hant', // Korean
  繁体中文: 'zh-hant', // Simplified Chinese
  繁體中文: 'zh-hant', // Traditional Chinese
  'chinês (tradicional)': 'zh-hant', // Portuguese
  'традиционный китайский': 'zh-hant', // Russian
  'mandarin tradisional': 'zh-hant', // Indonesian
  'cinese tradizionale': 'zh-hant', // Italian
  ภาษาจีนตัวเต็ม: 'zh-hant', // Thai
  'geleneksel çince': 'zh-hant', // Turkish
  'tiếng trung phồn thể': 'zh-hant', // Vietnamese

  // ── Korean (ko) ───────────────────────────────────────────────────────────
  coréen: 'ko', // French
  koreanisch: 'ko', // German
  coreano: 'ko', // Spanish, Portuguese, Italian
  韓国語: 'ko', // Japanese
  한국어: 'ko', // Korean
  韩语: 'ko', // Simplified Chinese
  韓語: 'ko', // Traditional Chinese
  корейский: 'ko', // Russian
  korea: 'ko', // Indonesian
  ภาษาเกาหลี: 'ko', // Thai
  korece: 'ko', // Turkish
  'tiếng hàn': 'ko', // Vietnamese

  // ── Japanese (ja) ─────────────────────────────────────────────────────────
  japonais: 'ja', // French
  japanisch: 'ja', // German
  japonés: 'ja', // Spanish
  日本語: 'ja', // Japanese / Traditional Chinese
  일본어: 'ja', // Korean
  日语: 'ja', // Simplified Chinese
  japonês: 'ja', // Portuguese
  японский: 'ja', // Russian
  jepang: 'ja', // Indonesian
  giapponese: 'ja', // Italian
  ภาษาญี่ปุ่น: 'ja', // Thai
  japonca: 'ja', // Turkish
  'tiếng nhật': 'ja', // Vietnamese

  // ── Spanish (es) ──────────────────────────────────────────────────────────
  espagnol: 'es', // French
  spanisch: 'es', // German
  español: 'es', // Spanish (also native name)
  スペイン語: 'es', // Japanese
  스페인어: 'es', // Korean
  西班牙语: 'es', // Simplified Chinese
  西班牙語: 'es', // Traditional Chinese
  espanhol: 'es', // Portuguese
  испанский: 'es', // Russian
  spanyol: 'es', // Indonesian
  spagnolo: 'es', // Italian
  ภาษาสเปน: 'es', // Thai
  'i\u0307spanyolca': 'es', // Turkish (capital İ lowercased)
  ispanyolca: 'es', // Turkish (dotless)
  'tiếng tây ban nha': 'es', // Vietnamese

  // ── French (fr) ───────────────────────────────────────────────────────────
  français: 'fr', // French (also native name)
  französisch: 'fr', // German
  francés: 'fr', // Spanish
  フランス語: 'fr', // Japanese
  프랑스어: 'fr', // Korean
  法语: 'fr', // Simplified Chinese
  '法語（français）': 'fr', // Traditional Chinese (lowercased)
  francês: 'fr', // Portuguese
  французский: 'fr', // Russian
  prancis: 'fr', // Indonesian
  francese: 'fr', // Italian
  ภาษาฝรั่งเศส: 'fr', // Thai
  fransızca: 'fr', // Turkish
  'tiếng pháp': 'fr', // Vietnamese

  // ── Russian (ru) ──────────────────────────────────────────────────────────
  russe: 'ru', // French
  russisch: 'ru', // German
  ruso: 'ru', // Spanish
  ロシア語: 'ru', // Japanese
  러시아어: 'ru', // Korean
  俄语: 'ru', // Simplified Chinese
  '俄語（русский）': 'ru', // Traditional Chinese (lowercased)
  russo: 'ru', // Portuguese, Italian
  русский: 'ru', // Russian (also native name)
  rusia: 'ru', // Indonesian
  ภาษารัสเซีย: 'ru', // Thai
  rusça: 'ru', // Turkish
  'tiếng nga': 'ru', // Vietnamese

  // ── Thai (th) ─────────────────────────────────────────────────────────────
  thai: 'th', // English alias / German
  thaïlandais: 'th', // French
  tailandés: 'th', // Spanish
  タイ語: 'th', // Japanese
  태국어: 'th', // Korean
  泰语: 'th', // Simplified Chinese
  '泰語（ภาษาไทย）': 'th', // Traditional Chinese (lowercased)
  tailandês: 'th', // Portuguese
  тайский: 'th', // Russian
  thailand: 'th', // Indonesian
  tailandese: 'th', // Italian
  ภาษาไทย: 'th', // Thai (also native name)
  tayca: 'th', // Turkish
  'tiếng thái': 'th', // Vietnamese

  // ── Vietnamese (vi) ───────────────────────────────────────────────────────
  vietnamese: 'vi', // English alias
  vietnamien: 'vi', // French
  vietnamesisch: 'vi', // German
  vietnamita: 'vi', // Spanish, Portuguese, Italian
  ベトナム語: 'vi', // Japanese
  베트남어: 'vi', // Korean
  越南语: 'vi', // Simplified Chinese
  '越南語（tiếng việt）': 'vi', // Traditional Chinese (lowercased)
  вьетнамский: 'vi', // Russian
  vietnam: 'vi', // Indonesian
  ภาษาเวียดนาม: 'vi', // Thai
  vietnamca: 'vi', // Turkish
  'tiếng việt': 'vi', // Vietnamese (also native name)

  // ── German (de) ───────────────────────────────────────────────────────────
  allemand: 'de', // French
  deutsch: 'de', // German (also native name)
  alemán: 'de', // Spanish
  ドイツ語: 'de', // Japanese
  독일어: 'de', // Korean
  德语: 'de', // Simplified Chinese
  德語: 'de', // Traditional Chinese
  alemão: 'de', // Portuguese
  немецкий: 'de', // Russian
  jerman: 'de', // Indonesian
  tedesco: 'de', // Italian
  ภาษาเยอรมัน: 'de', // Thai
  almanca: 'de', // Turkish
  'tiếng đức': 'de', // Vietnamese

  // ── Indonesian (id) ───────────────────────────────────────────────────────
  indonesian: 'id', // English alias
  indonésien: 'id', // French
  indonesisch: 'id', // German
  indonesio: 'id', // Spanish
  インドネシア語: 'id', // Japanese
  인도네시아어: 'id', // Korean
  印尼语: 'id', // Simplified Chinese
  印尼語: 'id', // Traditional Chinese
  indonésio: 'id', // Portuguese
  индонезийский: 'id', // Russian
  indonesia: 'id', // Indonesian
  indonesiano: 'id', // Italian
  ภาษาอินโดนีเซีย: 'id', // Thai
  endonezce: 'id', // Turkish
  'tiếng indonesia': 'id', // Vietnamese

  // ── Portuguese (pt-br) ────────────────────────────────────────────────────
  portuguese: 'pt-br', // English alias
  portugais: 'pt-br', // French
  portugiesisch: 'pt-br', // German
  portugués: 'pt-br', // Spanish
  ポルトガル語: 'pt-br', // Japanese
  포르투갈어: 'pt-br', // Korean
  葡萄牙语: 'pt-br', // Simplified Chinese
  葡萄牙語: 'pt-br', // Traditional Chinese
  português: 'pt-br', // Portuguese
  португальский: 'pt-br', // Russian
  portugis: 'pt-br', // Indonesian
  portoghese: 'pt-br', // Italian
  ภาษาโปรตุเกส: 'pt-br', // Thai
  portekizce: 'pt-br', // Turkish
  'tiếng bồ đào nha': 'pt-br', // Vietnamese

  // ── Turkish (tr) ──────────────────────────────────────────────────────────
  turkish: 'tr', // English alias
  turc: 'tr', // French
  türkisch: 'tr', // German
  turco: 'tr', // Spanish, Portuguese, Italian
  トルコ語: 'tr', // Japanese
  튀르키예어: 'tr', // Korean
  土耳其语: 'tr', // Simplified Chinese
  土耳其語: 'tr', // Traditional Chinese
  турецкий: 'tr', // Russian
  turki: 'tr', // Indonesian
  ภาษาตุรกี: 'tr', // Thai
  türkçe: 'tr', // Turkish (also native name)
  'tiếng thổ nhĩ kỳ': 'tr', // Vietnamese

  // ── Italian (it) ──────────────────────────────────────────────────────────
  italian: 'it', // English alias
  italien: 'it', // French
  italienisch: 'it', // German
  italiano: 'it', // Spanish, Portuguese, Italian (also native name)
  イタリア語: 'it', // Japanese
  이탈리아어: 'it', // Korean
  意大利语: 'it', // Simplified Chinese
  義大利語: 'it', // Traditional Chinese
  итальянский: 'it', // Russian
  italia: 'it', // Indonesian
  ภาษาอิตาลี: 'it', // Thai
  'i\u0307talyanca': 'it', // Turkish (capital İ lowercased)
  italyanca: 'it', // Turkish (dotless)
  'tiếng ý': 'it', // Vietnamese
};

/** All known lowercase translated names for the "Source" category column. */
export const SOURCE_COLUMN_NAMES: ReadonlySet<string> = new Set([
  'source', // English, French
  'herkunft', // German
  'origen', // Spanish
  '出所', // Japanese
  '소스', // Korean
  '来源', // Simplified Chinese
  '來源', // Traditional Chinese
  'fonte', // Portuguese
  'как получить', // Russian
  'sumber', // Indonesian
  'origine', // Italian
  'ต้นฉบับ', // Thai
  'kaynak', // Turkish
  'nguồn', // Vietnamese
]);

/** All known lowercase translated names for the "Need translation?" flag column. */
export const NEEDS_TRANSLATION_COLUMN_NAMES: ReadonlySet<string> = new Set([
  'need translation?', // English
  'need translation', // English (without ?)
  'besoin de traduction ?', // French
  'übersetzen?', // German
  'traducción requerida', // Spanish
  '翻訳が必要かどうか', // Japanese
  '번역 필요 여부', // Korean
  '是否需要翻译', // Simplified Chinese
  '是否需要翻譯', // Traditional Chinese
  'precisa de tradução?', // Portuguese
  'необходим ли перевод?', // Russian
  'apakah perlu diterjemahkan', // Indonesian
  'hai bisogno di una traduzione?', // Italian
  'ต้องการแปลหรือไม่', // Thai
  'çeviri gerekiyor mu?', // Turkish
  'muốn dịch chứ?', // Vietnamese
]);

/**
 * All known lowercase names for the optional context / notes column.
 * Includes both "Context" and "Notes" semantics in all supported languages.
 */
export const CONTEXT_COLUMN_NAMES: ReadonlySet<string> = new Set([
  // English
  'context',
  'notes',
  // French
  'contexte',
  // German
  'kontext',
  'notizen',
  // Spanish / Portuguese
  'contexto',
  'notas',
  // Japanese
  'コンテキスト',
  'メモ',
  // Korean
  '컨텍스트',
  '메모',
  // Chinese (both variants)
  '上下文',
  '备注', // Simplified Chinese (notes)
  '備註', // Traditional Chinese (notes)
  // Russian
  'контекст',
  'заметки',
  // Indonesian
  'konteks',
  'catatan',
  // Italian
  'contesto',
  'note',
  // Thai
  'บริบท',
  'หมายเหตุ',
  // Turkish
  'bağlam',
  'notlar',
  // Vietnamese
  'ngữ cảnh',
  'ghi chú',
]);

/**
 * Returns a Set of all known lowercase CSV header names — language columns and
 * special columns combined. Used for pre-import header validation.
 */
export function buildKnownHeadersSet(): Set<string> {
  const known = new Set<string>();

  for (const lang of LANGUAGE_REGISTRY) {
    known.add(lang.code.toLowerCase());
    known.add(lang.name.toLowerCase());
    known.add(lang.nativeName.toLowerCase());
  }

  for (const key of Object.keys(LANGUAGE_COLUMN_ALIASES)) {
    known.add(key);
  }

  for (const name of SOURCE_COLUMN_NAMES) known.add(name);
  for (const name of NEEDS_TRANSLATION_COLUMN_NAMES) known.add(name);
  for (const name of CONTEXT_COLUMN_NAMES) known.add(name);

  return known;
}
