/**
 * Shared "which modules may be offered in a picker" predicate.
 *
 * The rule — offer *named instances* of a base module (so credentials/config stay
 * per-instance) and modules that can't have instances at all (`instanceable:
 * false`, e.g. DeepL), but never the bare instanceable base — was open-coded as
 * `Boolean(m.baseModuleId) || m.instanceable === false` across the judge,
 * source-review, and global-config module lists. `isSelectableRoutingModule`
 * (BatchConfigEditor) is this same rule plus a pseudo-module guard that only
 * matters to routing.
 */
import type { CostTier } from '@zercade-dev/narn-shared';

/** Minimal module shape this predicate needs. */
export interface OfferableModuleShape {
  /** Module id — used to check whether an instanceable base has instances. */
  id?: string;
  /** Set for named instances of a base module. */
  baseModuleId?: string;
  /** Whether named instances may be created for this module (absent ⇒ true). */
  instanceable?: boolean;
}

/**
 * Set of base module ids that already have at least one named instance, derived
 * from a module list (each instance carries its `baseModuleId`). Bases present
 * here are managed through their instances and are not offered directly.
 */
export function basesWithInstances(modules: readonly OfferableModuleShape[]): ReadonlySet<string> {
  return new Set(modules.flatMap((m) => (m.baseModuleId ? [m.baseModuleId] : [])));
}

/**
 * Whether a module should be offered directly in a picker. Offered:
 *  - a named instance of a base module (`baseModuleId` set);
 *  - a non-instanceable base (`instanceable === false`, e.g. DeepL);
 *  - an instanceable base that has *no* named instances yet — it is still being
 *    managed directly as a bare base (it renders its own config card and can be
 *    enabled), so a picker must offer it; once it gains an instance, its config
 *    moves to that instance and the bare base is managed through it instead.
 *
 * Pass `withInstances` (the set of base ids that already have instances, e.g.
 * from {@link basesWithInstances}) so an instanceable base is excluded only once
 * it actually has instances. When omitted, no base is treated as having
 * instances, so bare instanceable bases remain offerable.
 */
export function isOfferableModule(
  m: OfferableModuleShape & { id?: string },
  withInstances?: ReadonlySet<string>,
): boolean {
  if (Boolean(m.baseModuleId) || m.instanceable === false) return true;
  // Instanceable base: offer it directly only while it has no named instances.
  return m.id === undefined || !(withInstances?.has(m.id) ?? false);
}

/**
 * Whether a module/instance is enabled *and* active in global config, so it may
 * actually run. A picker should additionally gate on this so disabled or
 * deactivated instances are not offered. `enabled` must be explicitly true;
 * `active` defaults to active when absent (only an explicit `false` excludes).
 */
export function isEnabledModule(m: { enabled?: boolean; active?: boolean }): boolean {
  return m.enabled === true && m.active !== false;
}

/**
 * Cheapest-first cost-tier ranking, mirroring the server's selection fallback
 * (`M9/module-selection.ts` COST_TIER_ORDER) so a UI default shows the module
 * the server would pick on its own.
 */
export const COST_TIER_ORDER: Record<CostTier, number> = { free: 0, low: 1, medium: 2, high: 3 };
