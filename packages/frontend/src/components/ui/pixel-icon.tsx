import type { ComponentType } from 'react';
import { useUiSettings } from '@/stores/ui-settings-store.js';
import { SPRITES, SPRITE_GRID, type SpriteName } from './pixel-sprites.js';

type Props = {
  name: SpriteName;
  /** lucide icon rendered when `name` has no sprite, or outside the pixel theme. */
  fallback: ComponentType<{ className?: string }>;
  className?: string;
  /**
   * The icon's accessible name. Provide this ONLY when the icon is the sole
   * carrier of meaning for an icon-only control (e.g. no adjacent text and no
   * `aria-label` on the surrounding button) — it renders `role="img"` plus
   * this label. Omit it whenever an adjacent label already names the control;
   * the icon then defaults to decorative (`aria-hidden="true"`, no `role`),
   * which is what most call sites want and is the safe default when unsure.
   */
  'aria-label'?: string;
  /**
   * Explicit override of the decorative/meaningful choice described above.
   * `true` forces decorative even when `aria-label` is also passed (a call
   * site that wants the label for e.g. a tooltip but not for the icon
   * itself); `false` forces the labelled/`role="img"` rendering. Rarely
   * needed — the `aria-label` presence/absence default covers the common
   * cases.
   */
  'aria-hidden'?: boolean;
};

/**
 * lucide-react forwards arbitrary extra props (aria-label, aria-hidden,
 * data-*) straight through to the rendered <svg> via its `...rest` spread
 * (verified against lucide-react@1.24 source: Icon.mjs spreads `...rest`
 * onto the svg element). That's a wider contract than the public `fallback`
 * prop type above commits to, so this cast is scoped to the one call site
 * that relies on it — every real fallback passed in today is a lucide icon,
 * and the rendered-attribute test below pins the behavior so a future
 * non-conforming fallback fails loud rather than silently dropping its
 * aria-label/aria-hidden.
 *
 * Note this component always passes an explicit aria-hidden or aria-label —
 * never both, never neither — so lucide's own default a11y behavior
 * (`Icon.mjs`'s `!hasA11yProp(rest) && { 'aria-hidden': 'true' }`) never
 * needs to kick in here; relying on it was the original bug, because a prop
 * key present with an `undefined` value still satisfies `hasA11yProp`'s
 * `for...in` check and silently suppresses lucide's own default.
 */
type FallbackRuntimeProps = {
  className?: string;
  role?: 'img';
  'aria-label'?: string;
  'aria-hidden'?: 'true';
  'data-pixel-sprite': 'false';
};

/**
 * Renders a pixel sprite when one is registered for `name` AND the pixel
 * theme is active; otherwise renders the supplied lucide fallback. The sprite
 * only wins when BOTH conditions hold — techno, default, and minimal always
 * render the lucide icon even once sprites exist for `name`, because sprites
 * are pixel-theme-only (techno keeps smooth vector icons to suit its
 * Orbitron/neon identity and never gets a sprite set).
 *
 * Subscribes to the ui-settings store with a narrow `theme` selector, not the
 * whole store: switching theme at runtime (Settings allows this live) makes
 * every on-screen PixelIcon re-render and pick up the change immediately,
 * while unrelated settings changes (language, console filter, dark mode)
 * don't re-render icons that never subscribed to those fields. A one-shot DOM
 * read (e.g. `document.documentElement.dataset.theme`) would miss that live
 * switch and leave icons stale until an unrelated re-render happened to run.
 */
export function PixelIcon({
  name,
  fallback: Fallback,
  className,
  'aria-label': label,
  'aria-hidden': ariaHidden,
}: Props): React.JSX.Element {
  const theme = useUiSettings((s) => s.theme);
  const sprite = theme === 'pixel' ? SPRITES[name] : undefined;
  // Decorative by default (no accessible name to announce, aria-hidden) —
  // meaningful (role="img" + label) only once a caller supplies aria-label,
  // unless aria-hidden explicitly overrides that default either way.
  const decorative = ariaHidden ?? !label;

  if (!sprite) {
    const FallbackWithRuntimeProps = Fallback as ComponentType<FallbackRuntimeProps>;
    return (
      <FallbackWithRuntimeProps
        className={className}
        data-pixel-sprite="false"
        {...(decorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': label })}
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${SPRITE_GRID} ${SPRITE_GRID}`}
      className={className}
      shapeRendering="crispEdges"
      fill="currentColor"
      data-pixel-sprite="true"
      {...(decorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': label })}
    >
      {sprite.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
      ))}
    </svg>
  );
}
