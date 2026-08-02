/**
 * Beta-slot UI gating. Some UI ships to the beta slot first and reaches the
 * default slot later. The gate is deliberately broad: any labeled slot
 * (SLOT_LABEL=BETA on a staging slot, LOCAL on the local compose stack) or a
 * vite dev build counts as "beta UI on"; unlabeled deployments (cloud prod,
 * self-hosted release builds) hide gated UI. Graduating a feature later just
 * removes its useBetaUi() call site.
 */
import { useSystemStatusStore } from '@/stores/system-status-store';

/**
 * Pure predicate — the testable seam (vitest itself runs with
 * `import.meta.env.DEV === true`, so the disabled path is only reachable
 * through this function).
 */
export function isBetaUiEnabled(slotLabel: string | null, isDev: boolean): boolean {
  return slotLabel != null || isDev;
}

/** True when beta-gated UI should be visible in this deployment. */
export function useBetaUi(): boolean {
  const slotLabel = useSystemStatusStore((s) => s.status?.slotLabel ?? null);
  return isBetaUiEnabled(slotLabel, import.meta.env.DEV);
}
