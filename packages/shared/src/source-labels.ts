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
 *    language (en/es/fr) regardless of the language it was imported in, while
 *    the stored value and CSV import/export keep the EXACT imported text;
 *  - recognition: detecting that a label (in any language) is a known origin.
 *
 * Labels not present here are unknown/custom sources and are displayed
 * verbatim. The data is extracted directly from the reference CSVs (all rows
 * aligned across the 15 languages, no cross-language collisions); 12 canonical
 * labels. Multi-source CSV cells are comma-joined, so each `sources` element is
 * a single label looked up here individually.
 */

/** A canonical source label with its en/es/fr display forms and all recognized variants. */
export interface SourceLabelDef {
  /** Canonical English label (also the i18n-neutral key). */
  en: string;
  /** Spanish display form. */
  es: string;
  /** French display form. */
  fr: string;
  /**
   * Every recognized localized form across all 15 reference languages (plus a
   * few singular/plural inflections), used to map an imported label back to
   * this entry regardless of the import language. Includes the en/es/fr forms.
   */
  variants: readonly string[];
}

/** App UI languages that have a localized display form. */
export type SourceDisplayLocale = 'en' | 'es' | 'fr';

export const SOURCE_LABELS: readonly SourceLabelDef[] = [
  {
    en: 'Tab',
    es: 'Pestaña',
    fr: 'Option',
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
    es: 'Variable personalizada',
    fr: 'Variable personnalisée',
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
    es: 'Objeto',
    fr: 'Objets',
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
    es: 'Diagrama de nodos',
    fr: 'Graphique de nœuds',
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
    es: 'Grupo de control de interfaz',
    fr: "Groupe de contrôle d'interface",
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
    es: 'Placa de nombre',
    fr: 'Plaque',
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
    es: 'Globo de texto',
    fr: 'Bulle de texte',
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
    es: 'Logros',
    fr: 'Succès',
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
    es: 'Clasificación',
    fr: 'Classement',
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
    es: 'Interfaz de carga',
    fr: 'Interface de chargement',
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
    es: 'Gestión de chat de voz y texto',
    fr: 'Gestion du tchat par texte et audio',
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
    es: 'Facción',
    fr: 'Faction',
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
    for (const variant of [def.en, def.es, def.fr, ...def.variants]) {
      const key = normalizeLabel(variant);
      if (!map.has(key)) map.set(key, def);
    }
  }
  return map;
})();

function resolveDisplayLocale(locale: string): SourceDisplayLocale {
  const base = locale.toLowerCase().split('-')[0];
  return base === 'es' || base === 'fr' ? base : 'en';
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
 * Returns the display form of a source origin label in the app UI language
 * (en/es/fr). A label imported in any of the 15 reference languages is mapped
 * to the requested locale's form; an unknown/custom label is returned verbatim.
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
