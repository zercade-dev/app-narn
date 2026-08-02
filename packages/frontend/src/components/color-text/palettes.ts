/**
 * Built-in Color Text palettes. Read-only: no delete/edit affordance in the
 * UI, deliberately separate from the user's own colors
 * (color-text-store.customColors). Hex values are carried over verbatim from
 * the original reference tool. `labelKey`/swatch keys resolve in the
 * `colorText` i18n namespace (`groupX` / `swatches.<key>`).
 */
export interface BuiltinSwatch {
  key: string;
  hex: string;
}

export interface BuiltinGroup {
  id: 'dark-bg' | 'light-bg' | 'elements' | 'quality';
  labelKey: string;
  swatches: readonly BuiltinSwatch[];
}

export const BUILTIN_GROUPS: readonly BuiltinGroup[] = [
  {
    id: 'dark-bg',
    labelKey: 'groupDarkBg',
    swatches: [
      { key: 'title', hex: '#D3BC8E' },
      { key: 'normal', hex: '#FFFFFF' },
      { key: 'key1', hex: '#FFCC33' },
      { key: 'key2', hex: '#37FFFF' },
      { key: 'warn', hex: '#FF5E41' },
    ],
  },
  {
    id: 'light-bg',
    labelKey: 'groupLightBg',
    swatches: [
      { key: 'normal', hex: '#4A5366' },
      { key: 'secondary', hex: '#4A5366BF' },
      { key: 'key1', hex: '#F39000' },
      { key: 'key2', hex: '#3399CC' },
      { key: 'warn', hex: '#FF5E41' },
    ],
  },
  {
    id: 'elements',
    labelKey: 'groupElements',
    swatches: [
      { key: 'hydro', hex: '#80C0FF' },
      { key: 'pyro', hex: '#FF9999' },
      { key: 'anemo', hex: '#80FFD7' },
      { key: 'electro', hex: '#FFACFF' },
      { key: 'dendro', hex: '#99FF88' },
      { key: 'cryo', hex: '#99FFFF' },
      { key: 'geo', hex: '#FFE699' },
    ],
  },
  {
    id: 'quality',
    labelKey: 'groupQuality',
    swatches: [
      { key: 'gray', hex: '#CCCCCC' },
      { key: 'green', hex: '#ACFF44' },
      { key: 'blue', hex: '#50F4FF' },
      { key: 'purple', hex: '#F998FF' },
      { key: 'orange', hex: '#FFE14B' },
    ],
  },
];
