/**
 * Localized "Source" origin-label catalog.
 *
 * The game's reference localization export (`other/references/*.csv`) carries a
 * "Source" column that categorizes each string (Tab, Custom Variable,
 * Achievement, UI Control Group, Node Graph, …). That column is LOCALIZED per
 * language, and on import its comma-split values become {@link
 * import('./types/string-entry.js').StringEntry.sources}.
 *
 * This catalog maps each canonical (English) source label to its localized form
 * in every reference language. It powers:
 *  - display translation: showing an imported source label in the app's UI
 *    language (every locale in {@link SOURCE_DISPLAY_LOCALES}) regardless of the
 *    language it was imported in, while the stored value and CSV import/export
 *    keep the EXACT imported text;
 *  - recognition: detecting that a label (in any language) is a known origin.
 *
 * Labels not present here are unknown/custom sources and are displayed
 * verbatim. The data is extracted directly from the reference CSVs (all rows
 * aligned across the 15 languages, no cross-language collisions); 12 canonical
 * labels. Multi-source CSV cells are comma-joined, so each `sources` element is
 * a single label looked up here individually.
 */

/**
 * App UI languages that have a localized display form — the single source of
 * truth for both the {@link SourceDisplayLocale} type and the runtime fallback
 * in `resolveDisplayLocale`.
 *
 * This MUST stay in step with the frontend's `UI_LANGS` / `UiLanguage`: a UI
 * language missing here silently renders source labels in English (that was the
 * de/ja/ru/tr defect). `shared` must NOT import from `frontend` — that is the
 * wrong dependency direction — so the two lists cannot be linked at the type
 * level, and a parity test in the test suite enforces it instead. Adding a UI
 * language means adding it here and giving every `SOURCE_LABELS` entry a display
 * form for it; that test fails with both edits named if you add only one.
 */
export const SOURCE_DISPLAY_LOCALES = [
  'en',
  'de',
  'es',
  'fr',
  'id',
  'it',
  'ja',
  'ko',
  'pt-br',
  'ru',
  'th',
  'tr',
  'vi',
  'zh-hans',
  'zh-hant',
] as const;

/** App UI languages that have a localized display form. */
export type SourceDisplayLocale = (typeof SOURCE_DISPLAY_LOCALES)[number];

/** A canonical source label with a display form per UI locale and all recognized variants. */
export interface SourceLabelDef {
  /** Canonical English label (also the i18n-neutral key). */
  en: string;
  /** German display form. (For `Tab` this is legitimately identical to English.) */
  de: string;
  /** Spanish display form. */
  es: string;
  /** French display form. */
  fr: string;
  /** Indonesian display form. */
  id: string;
  /** Italian display form. */
  it: string;
  /** Japanese display form. */
  ja: string;
  /** Korean display form. */
  ko: string;
  /** Brazilian Portuguese display form. */
  'pt-br': string;
  /** Russian display form. */
  ru: string;
  /** Thai display form. */
  th: string;
  /** Turkish display form. */
  tr: string;
  /** Vietnamese display form. */
  vi: string;
  /** Simplified Chinese display form. */
  'zh-hans': string;
  /** Traditional Chinese display form. */
  'zh-hant': string;
  /**
   * Every recognized localized form across all 15 reference languages (plus a
   * few singular/plural inflections), used to map an imported label back to
   * this entry regardless of the import language. Includes every display form.
   */
  variants: readonly string[];
}

export const SOURCE_LABELS: readonly SourceLabelDef[] = [
  {
    en: 'Tab',
    de: 'Tab',
    es: 'Pestaña',
    fr: 'Option',
    id: 'Tab',
    it: 'Scheda',
    ja: 'オプションタブ',
    ko: '탭',
    'pt-br': 'Aba',
    ru: 'Вкладка',
    th: 'แท็บ',
    tr: 'Sekme',
    vi: 'Thẻ Chọn',
    'zh-hans': '选项卡',
    'zh-hant': '選項卡',
    variants: [
      'Tab',
      'Pestaña',
      'Option',
      'Scheda',
      'Aba',
      'Вкладка',
      'Sekme',
      'Thẻ Chọn',
      'แท็บ',
      '탭',
      'オプションタブ',
      '选项卡',
      '選項卡',
    ],
  },
  {
    en: 'Custom Variable',
    de: 'Benutzerdefinierte Variable',
    es: 'Variable personalizada',
    fr: 'Variable personnalisée',
    id: 'Variabel Kustom',
    it: 'Variabile personalizzata',
    ja: 'カスタム変数',
    ko: '커스텀 변수',
    'pt-br': 'Variável Personalizada',
    ru: 'Настраиваемые переменные',
    th: 'ตัวแปรกำหนดเอง',
    tr: 'Özel Değişken',
    vi: 'Biến Số Tùy Chỉnh',
    'zh-hans': '自定义变量',
    'zh-hant': '自訂變量',
    variants: [
      'Custom Variable',
      'Variable personalizada',
      'Variable personnalisée',
      'Benutzerdefinierte Variable',
      'Variabile personalizzata',
      'Variável Personalizada',
      'Настраиваемые переменные',
      'Özel Değişken',
      'Variabel Kustom',
      'Biến Số Tùy Chỉnh',
      'ตัวแปรกำหนดเอง',
      '커스텀 변수',
      'カスタム変数',
      '自定义变量',
      '自訂變量',
    ],
  },
  {
    en: 'Item',
    de: 'Objekt',
    es: 'Objeto',
    fr: 'Objets',
    id: 'Item',
    it: 'Oggetto',
    ja: 'アイテム',
    ko: '아이템',
    'pt-br': 'Itens',
    ru: 'Предмет',
    th: 'ไอเทม',
    tr: 'Eşya',
    vi: 'Đạo Cụ',
    'zh-hans': '道具',
    'zh-hant': '道具',
    variants: [
      'Item',
      'Objeto',
      'Objets',
      'Objekt',
      'Oggetto',
      'Itens',
      'Предмет',
      'Eşya',
      'Đạo Cụ',
      'ไอเทม',
      '아이템',
      'アイテム',
      '道具',
    ],
  },
  {
    en: 'Node Graph',
    de: 'Knotendiagramm',
    es: 'Diagrama de nodos',
    fr: 'Graphique de nœuds',
    id: 'Grafik Node',
    it: 'Grafico dei nodi',
    ja: 'ノードグラフ',
    ko: '노드 그래프',
    'pt-br': 'Gráfico de Nódulos',
    ru: 'Схема узлов',
    th: 'โหนดกราฟ',
    tr: 'Düğüm Grafiği',
    vi: 'Đồ Thị',
    'zh-hans': '节点图',
    'zh-hant': '節點圖',
    variants: [
      'Node Graph',
      'Diagrama de nodos',
      'Graphique de nœuds',
      'Knotendiagramm',
      'Grafico dei nodi',
      'Gráfico de Nódulos',
      'Схема узлов',
      'Düğüm Grafiği',
      'Grafik Node',
      'Đồ Thị',
      'โหนดกราฟ',
      '노드 그래프',
      'ノードグラフ',
      '节点图',
      '節點圖',
    ],
  },
  {
    en: 'UI Control Group',
    de: 'Menüsteuerungsgruppen',
    es: 'Grupo de control de interfaz',
    fr: "Groupe de contrôle d'interface",
    id: 'Grup Kontrol Halaman',
    it: 'Gruppo comandi IU',
    ja: 'UIコントロールグループ',
    ko: '인터페이스 컨트롤 그룹',
    'pt-br': 'Grupo de Controle de Interface',
    ru: 'Группа элементов меню',
    th: 'กลุ่มควบคุม UI',
    tr: 'Kullanıcı Arayüzü Kontrol Grubu',
    vi: 'Nhóm Điều Khiển Giao Diện',
    'zh-hans': '界面控件组',
    'zh-hant': '介面控制元件組',
    variants: [
      'UI Control Group',
      'Grupo de control de interfaz',
      "Groupe de contrôle d'interface",
      'Menüsteuerungsgruppen',
      'Gruppo comandi IU',
      'Grupo de Controle de Interface',
      'Группа элементов меню',
      'Kullanıcı Arayüzü Kontrol Grubu',
      'Grup Kontrol Halaman',
      'Nhóm Điều Khiển Giao Diện',
      'กลุ่มควบคุม UI',
      '인터페이스 컨트롤 그룹',
      'UIコントロールグループ',
      '界面控件组',
      '介面控制元件組',
    ],
  },
  {
    en: 'Nameplate',
    de: 'Namensschild',
    es: 'Placa de nombre',
    fr: 'Plaque',
    id: 'Papan Nama',
    it: 'Targa',
    ja: 'ネームプレート',
    ko: '네임플레이트',
    'pt-br': 'Placa de Nome',
    ru: 'Табличка',
    th: 'ป้ายชื่อ',
    tr: 'İsim Levhası',
    vi: 'Bảng Hiệu',
    'zh-hans': '铭牌',
    'zh-hant': '銘牌',
    variants: [
      'Nameplate',
      'Placa de nombre',
      'Plaque',
      'Namensschild',
      'Targa',
      'Placa de Nome',
      'Табличка',
      'İsim Levhası',
      'Papan Nama',
      'Bảng Hiệu',
      'ป้ายชื่อ',
      '네임플레이트',
      'ネームプレート',
      '铭牌',
      '銘牌',
    ],
  },
  {
    en: 'Text Bubble',
    de: 'Textblase',
    es: 'Globo de texto',
    fr: 'Bulle de texte',
    id: 'Gelembung Teks',
    it: 'Fumetto',
    ja: 'テキストバブル',
    ko: '말풍선',
    'pt-br': 'Bolha de Texto',
    ru: 'Текстовый пузырь',
    th: 'บับเบิ้ลข้อความ',
    tr: 'Metin Balonu',
    vi: 'Khung Bong Bóng Văn Bản',
    'zh-hans': '文本气泡',
    'zh-hant': '文字氣泡',
    variants: [
      'Text Bubble',
      'Globo de texto',
      'Bulle de texte',
      'Textblase',
      'Fumetto',
      'Bolha de Texto',
      'Текстовый пузырь',
      'Metin Balonu',
      'Gelembung Teks',
      'Khung Bong Bóng Văn Bản',
      'บับเบิ้ลข้อความ',
      '말풍선',
      'テキストバブル',
      '文本气泡',
      '文字氣泡',
    ],
  },
  {
    en: 'Achievement',
    de: 'Errungenschaften',
    es: 'Logros',
    fr: 'Succès',
    id: 'Achievement',
    it: 'Obiettivi',
    ja: 'アチーブメント',
    ko: '업적',
    'pt-br': 'Conquista',
    ru: 'Достижение',
    th: 'ความสำเร็จ',
    tr: 'Başarım',
    vi: 'Thành Tựu',
    'zh-hans': '成就',
    'zh-hant': '成就',
    variants: [
      'Achievement',
      'Logros',
      'Succès',
      'Errungenschaften',
      'Obiettivi',
      'Conquista',
      'Достижение',
      'Başarım',
      'Thành Tựu',
      'ความสำเร็จ',
      '업적',
      'アチーブメント',
      '成就',
      'Logro',
      'Достижения',
      'Conquistas',
      'Obiettivo',
      'Errungenschaft',
      'Başarımlar',
    ],
  },
  {
    en: 'Leaderboard',
    de: 'Rangliste',
    es: 'Clasificación',
    fr: 'Classement',
    id: 'Papan Peringkat',
    it: 'Classifica',
    ja: 'ランキング',
    ko: '랭킹',
    'pt-br': 'Placar',
    ru: 'Рейтинг',
    th: 'กระดานจัดอันดับ',
    tr: 'Sıralama',
    vi: 'Bảng Xếp Hạng',
    'zh-hans': '排行榜',
    'zh-hant': '排行榜',
    variants: [
      'Leaderboard',
      'Clasificación',
      'Classement',
      'Rangliste',
      'Classifica',
      'Placar',
      'Рейтинг',
      'Sıralama',
      'Papan Peringkat',
      'Bảng Xếp Hạng',
      'กระดานจัดอันดับ',
      '랭킹',
      'ランキング',
      '排行榜',
    ],
  },
  {
    en: 'Loading Screen',
    de: 'Ladebildschirm',
    es: 'Interfaz de carga',
    fr: 'Interface de chargement',
    id: 'Halaman Loading',
    it: 'Schermata di caricamento',
    ja: 'ロード画面',
    ko: '로딩 화면',
    'pt-br': 'Tela de Carregamento',
    ru: 'Загрузочный экран',
    th: 'อินเทอร์เฟซการโหลด',
    tr: 'Yükleme Ekranı',
    vi: 'Giao Diện Tải',
    'zh-hans': '加载界面',
    'zh-hant': '載入介面',
    variants: [
      'Loading Screen',
      'Interfaz de carga',
      'Interface de chargement',
      'Ladebildschirm',
      'Schermata di caricamento',
      'Tela de Carregamento',
      'Загрузочный экран',
      'Yükleme Ekranı',
      'Halaman Loading',
      'Giao Diện Tải',
      'อินเทอร์เฟซการโหลด',
      '로딩 화면',
      'ロード画面',
      '加载界面',
      '載入介面',
    ],
  },
  {
    en: 'Manage Voice & Text Chat',
    de: 'Audio- und Textchat-Verwaltung',
    es: 'Gestión de chat de voz y texto',
    fr: 'Gestion du tchat par texte et audio',
    id: 'Manajemen Obrolan Suara dan Teks',
    it: 'Gestione chat vocale e di testo',
    ja: 'ボイスとテキストチャット管理',
    ko: '음성 및 채팅 관리',
    'pt-br': 'Gerenciar voz e bate-papo de texto',
    ru: 'Управление голосовым и текстовым чатом',
    th: 'การจัดการแชทเสียงและข้อความ',
    tr: 'Sesli Sohbet ve Metin Sohbeti Yönetimi',
    vi: 'Quản Lý Văn Bản & Giọng Nói',
    'zh-hans': '语音和文字聊天管理',
    'zh-hant': '語音和文字聊天管理',
    variants: [
      'Manage Voice & Text Chat',
      'Gestión de chat de voz y texto',
      'Gestion du tchat par texte et audio',
      'Audio- und Textchat-Verwaltung',
      'Gestione chat vocale e di testo',
      'Gerenciar voz e bate-papo de texto',
      'Управление голосовым и текстовым чатом',
      'Sesli Sohbet ve Metin Sohbeti Yönetimi',
      'Manajemen Obrolan Suara dan Teks',
      'Quản Lý Văn Bản & Giọng Nói',
      'การจัดการแชทเสียงและข้อความ',
      '음성 및 채팅 관리',
      'ボイスとテキストチャット管理',
      '语音和文字聊天管理',
      '語音和文字聊天管理',
    ],
  },
  {
    en: 'Faction',
    de: 'Fraktion',
    es: 'Facción',
    fr: 'Faction',
    id: 'Faksi',
    it: 'Fazione',
    ja: '陣営',
    ko: '진영',
    'pt-br': 'Facção',
    ru: 'Фракция',
    th: 'ฝ่าย',
    tr: 'Bağlılık',
    vi: 'Phe',
    'zh-hans': '阵营',
    'zh-hant': '陣營',
    variants: [
      'Faction',
      'Facción',
      'Fraktion',
      'Fazione',
      'Facção',
      'Фракция',
      'Bağlılık',
      'Faksi',
      'Phe',
      'ฝ่าย',
      '진영',
      '陣営',
      '阵营',
      '陣營',
    ],
  },
];

/** Trim + casefold; matches the recognition normalization used elsewhere. */
function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

/** Reverse index: every recognized variant (normalized) → its catalog entry. */
const VARIANT_TO_DEF: ReadonlyMap<string, SourceLabelDef> = (() => {
  const map = new Map<string, SourceLabelDef>();
  for (const def of SOURCE_LABELS) {
    for (const variant of [
      ...SOURCE_DISPLAY_LOCALES.map((locale) => def[locale]),
      ...def.variants,
    ]) {
      const key = normalizeLabel(variant);
      if (!map.has(key)) map.set(key, def);
    }
  }
  return map;
})();

/**
 * Maps a UI locale (possibly region-tagged, e.g. `es-MX`) to the display locale
 * whose form should be rendered, falling back to `en` for anything the catalog
 * does not carry. Driven off {@link SOURCE_DISPLAY_LOCALES} so adding a locale
 * is a single edit.
 */
function resolveDisplayLocale(locale: string): SourceDisplayLocale {
  const base = locale.toLowerCase().split('-')[0];
  return (SOURCE_DISPLAY_LOCALES as readonly string[]).includes(base)
    ? (base as SourceDisplayLocale)
    : 'en';
}

/**
 * Resolves a (possibly localized) source label to its catalog entry, or
 * `undefined` if it is an unknown/custom label. Matching is case-insensitive and
 * whitespace-insensitive across all recognized variants.
 */
export function getSourceLabelDef(raw: string): SourceLabelDef | undefined {
  return VARIANT_TO_DEF.get(normalizeLabel(raw));
}

/**
 * Returns the display form of a source origin label in the app UI language (any
 * of {@link SOURCE_DISPLAY_LOCALES}; anything else falls back to English). A
 * label imported in any of the 15 reference languages is mapped to the requested
 * locale's form; an unknown/custom label is returned verbatim.
 *
 * Display-only: the stored `StringEntry.sources` value and CSV import/export
 * always keep the exact imported text.
 */
export function getSourceLabel(raw: string, locale: string): string {
  const def = getSourceLabelDef(raw);
  return def ? def[resolveDisplayLocale(locale)] : raw;
}

/** True when `raw` is a recognized (catalogued) source origin label. */
export function isKnownSourceLabel(raw: string): boolean {
  return VARIANT_TO_DEF.has(normalizeLabel(raw));
}
