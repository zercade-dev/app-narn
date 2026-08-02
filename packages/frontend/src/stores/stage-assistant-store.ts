/**
 * Stage-details chat assistant provider/model/effort override.
 *
 * The chat used to borrow whatever module/model the last stage-details
 * TRANSLATE run wrote to `project.stageDetailsConfig`, so there was no way to
 * chat with a different (e.g. stronger) model than the one used for bulk
 * translation. This store holds an optional override; when unset the project
 * config is still used, so existing projects behave exactly as before.
 *
 * Workspace-wide and localStorage-persisted, mirroring the Text Styler
 * assistant's slice in `color-text-store.ts`.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StageAssistantStore {
  instanceId: string | null;
  model: string | null;
  reasoningEffort: string | null;
  /**
   * Opt-in per-turn diagnostic logging (timings, prompt sizes, the prompt
   * itself) in the live log panel. OFF by default and deliberately independent
   * of the provider override — it is a debugging aid you switch on to explain a
   * slow reply, not part of the model selection.
   */
  verbose: boolean;
  setInstanceId: (id: string | null) => void;
  setModel: (model: string | null) => void;
  setReasoningEffort: (effort: string | null) => void;
  setVerbose: (verbose: boolean) => void;
}

export const useStageAssistantStore = create<StageAssistantStore>()(
  persist(
    (set) => ({
      instanceId: null,
      model: null,
      reasoningEffort: null,
      verbose: false,
      // Clearing OR changing the instance clears the model AND effort too: a
      // model id (and its supported efforts) is only meaningful for the
      // instance it was discovered from, and a half-set pair would either fail
      // the `instanceId && model` gate confusingly or, worse, pass it with a
      // model/effort that belongs to the previous provider. Re-setting the
      // SAME instance (e.g. a no-op re-render) preserves both.
      setInstanceId: (id) =>
        set((s) => ({
          instanceId: id,
          model: id === s.instanceId ? s.model : null,
          reasoningEffort: id === s.instanceId ? s.reasoningEffort : null,
        })),
      // Changing the model clears effort: an effort id is only meaningful for
      // the model it was discovered from (`supportedReasoningEfforts` differs
      // per model).
      setModel: (model) => set({ model, reasoningEffort: null }),
      setReasoningEffort: (reasoningEffort) => set({ reasoningEffort }),
      // Not cleared by an instance/model change: it is a logging preference, not
      // a property of the selected provider.
      setVerbose: (verbose) => set({ verbose }),
    }),
    { name: 'narn-stage-assistant' },
  ),
);
