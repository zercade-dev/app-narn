/**
 * Stage Details TRANSLATE popover draft config — persisted per-project so an
 * in-progress edit (module/model/effort, scope toggles, checked fields)
 * survives navigating away and back, mirroring `useColorTextStore.drafts`.
 *
 * Deliberately a SEPARATE persisted store from `stage-details-store.ts`: that
 * store is non-persisted UI state (selected language, chat open/focus) plus
 * the two mutating API actions, and its own header comment commits it to
 * staying "deliberately THIN". The codebase's existing precedent for a
 * persisted config-override slice living beside a thin non-persisted domain
 * store is `stage-assistant-store.ts` next to `stage-details-store.ts`
 * itself — this store follows that same split rather than adding `persist`
 * plus a `partialize` carve-out to the thin store.
 *
 * `checkedFields` is a `Set` at the call site but stored here as a plain
 * array: zustand's `persist` middleware JSON-serializes state, and no
 * existing persisted store in this codebase has a `Set`-aware
 * storage/serializer (`useSelectionStore` holds a `Set` but is never
 * persisted) — a plain array is the simpler choice, converted to/from `Set`
 * at the component boundary (StageDetailsTab).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StageDetailFieldId } from '@zercade-dev/narn-shared';

export interface StageDetailsDraftConfig {
  moduleId: string;
  model: string;
  reasoningEffort: string;
  currentOnly: boolean;
  staleOnly: boolean;
  checkedFields: StageDetailFieldId[];
}

/**
 * Functional form of {@link StageDetailsDraftStore.setDraft}: receives the
 * project's CURRENT stored draft (`undefined` when none exists yet) and returns
 * its replacement. Callers that merge a patch should prefer this over building
 * the replacement from render-time values, so two updates landing in the same
 * React commit compose instead of the second clobbering the first.
 */
export type StageDetailsDraftUpdater = (
  prev: StageDetailsDraftConfig | undefined,
) => StageDetailsDraftConfig;

interface StageDetailsDraftStore {
  /** Per-project draft config, keyed by project id. Absent = no local draft yet. */
  drafts: Record<string, StageDetailsDraftConfig>;
  /**
   * Replaces `projectId`'s whole draft entry — callers merge patches
   * themselves, either by passing the complete replacement config or (safer)
   * an updater that derives it from the current stored draft.
   */
  setDraft: (projectId: string, config: StageDetailsDraftConfig | StageDetailsDraftUpdater) => void;
}

export const useStageDetailsDraftStore = create<StageDetailsDraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (projectId, config) =>
        set((s) => ({
          drafts: {
            ...s.drafts,
            [projectId]: typeof config === 'function' ? config(s.drafts[projectId]) : config,
          },
        })),
    }),
    { name: 'narn-stage-details-draft' },
  ),
);
