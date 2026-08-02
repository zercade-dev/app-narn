/**
 * Text Styler tool state: the user's custom palette colors, the AI-assistant
 * selection, the editor mode, and a PER-PROJECT editor draft
 * (`drafts[projectId]`). `customColors`, `mode`, and `assistant` stay global
 * (workspace-wide); only the draft is scoped per project. All persisted to
 * localStorage so switching tabs or reloading never loses work. Built-in
 * palettes are NOT stored here — they live as a readonly constant in
 * components/color-text/palettes.ts.
 *
 * v1 → v2 migration: the single global `draft` becomes `legacyDraft`, adopted
 * by the FIRST project whose Text Styler tab opens after the upgrade (see
 * {@link draftFor}); every project thereafter starts from an empty draft.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorTextMode = 'raw' | 'rich';

export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
}

export interface ColorTextAssistant {
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
}

const DEFAULT_ASSISTANT: ColorTextAssistant = {
  instanceId: null,
  model: null,
  reasoningEffort: null,
  verbose: false,
};

interface ColorTextState {
  customColors: PaletteColor[];
  /** Per-project editor drafts, keyed by project id. */
  drafts: Record<string, string>;
  /**
   * The pre-v2 single global draft, awaiting adoption by the first project
   * whose Text Styler tab opens post-upgrade (then nulled). `null` once no
   * legacy draft remains to migrate.
   */
  legacyDraft: string | null;
  mode: ColorTextMode;
  assistant: ColorTextAssistant;
  addColor: (name: string, hex: string) => void;
  removeColor: (id: string) => void;
  /**
   * Returns `projectId`'s draft. On the first access for a project, if a
   * {@link legacyDraft} is still pending it is adopted into that project (and
   * cleared) so a single pre-v2 draft carries into the first Text Styler tab
   * the user opens; every project afterwards starts from `''`.
   */
  draftFor: (projectId: string) => string;
  setDraft: (projectId: string, draft: string) => void;
  setMode: (mode: ColorTextMode) => void;
  setAssistantInstance: (id: string | null) => void;
  setAssistantModel: (model: string | null) => void;
  setAssistantReasoningEffort: (effort: string | null) => void;
  setAssistantVerbose: (verbose: boolean) => void;
}

export const useColorTextStore = create<ColorTextState>()(
  persist(
    (set, get) => ({
      customColors: [],
      drafts: {},
      legacyDraft: null,
      mode: 'raw',
      assistant: DEFAULT_ASSISTANT,
      addColor: (name, hex) =>
        set((s) => ({
          customColors: [
            ...s.customColors,
            { id: crypto.randomUUID(), name: name.trim(), hex: hex.toUpperCase() },
          ],
        })),
      removeColor: (id) =>
        set((s) => ({ customColors: s.customColors.filter((c) => c.id !== id) })),
      draftFor: (projectId) => {
        const s = get();
        if (projectId in s.drafts) return s.drafts[projectId];
        if (s.legacyDraft !== null) {
          const adopted = s.legacyDraft;
          set({ drafts: { ...s.drafts, [projectId]: adopted }, legacyDraft: null });
          return adopted;
        }
        return '';
      },
      setDraft: (projectId, draft) => set((s) => ({ drafts: { ...s.drafts, [projectId]: draft } })),
      setMode: (mode) => set({ mode }),
      // Clearing OR changing the instance clears model AND effort too — same
      // reasoning as `stage-assistant-store.ts`'s `setInstanceId`: a model id
      // (and its supported efforts) is only meaningful for the instance it was
      // discovered from.
      setAssistantInstance: (id) =>
        set((s) => ({
          assistant: {
            instanceId: id,
            model: id === s.assistant.instanceId ? s.assistant.model : null,
            reasoningEffort: id === s.assistant.instanceId ? s.assistant.reasoningEffort : null,
            // Carried across an instance change: `verbose` is a logging
            // preference, not a property of the selected provider.
            verbose: s.assistant.verbose,
          },
        })),
      setAssistantModel: (model) =>
        set((s) => ({ assistant: { ...s.assistant, model, reasoningEffort: null } })),
      // Not cleared by an instance/model change: it is a logging preference, not
      // a property of the selected provider.
      setAssistantVerbose: (verbose) => set((s) => ({ assistant: { ...s.assistant, verbose } })),
      setAssistantReasoningEffort: (reasoningEffort) =>
        set((s) => ({ assistant: { ...s.assistant, reasoningEffort } })),
    }),
    {
      name: 'translator-color-text',
      version: 2,
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Record<string, unknown>;
        const assistant = {
          ...DEFAULT_ASSISTANT,
          ...((state.assistant as Partial<ColorTextAssistant> | undefined) ?? {}),
        };
        // v2: the single global `draft` becomes `legacyDraft` (adopted by the
        // first project whose Text Styler tab opens — see `draftFor`), and
        // per-project `drafts` starts empty.
        if (version < 2) {
          const { draft, ...rest } = state;
          return {
            ...rest,
            assistant,
            drafts: {},
            legacyDraft: typeof draft === 'string' ? draft : null,
          };
        }
        return { ...state, assistant };
      },
    },
  ),
);
