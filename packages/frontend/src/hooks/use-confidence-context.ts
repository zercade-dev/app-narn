/**
 * Resolves the model-confidence run context from the current project's
 * strings: entry count plus a rough chars/4 + per-task-overhead token
 * estimate. Dialog callers pass their currently selected reasoning effort
 * ('' — the "model default" sentinel — is dropped so the picker falls back to
 * each model's own default effort).
 *
 * Beta-gated: returns undefined (→ ModelPicker renders no Confidence column)
 * unless useBetaUi() allows it — the confidence UI is beta-slot-only for now.
 */
import * as React from 'react';
import { PROMPT_OVERHEAD_TOKENS } from '@zercade-dev/narn-shared';
import type { AiTask, ModelConfidenceContext, ReasoningEffort } from '@zercade-dev/narn-shared';
import { useStringStore } from '@/stores/string-store';
import { useBetaUi } from './use-beta-ui.js';

export function useConfidenceContext(
  task: AiTask,
  effort?: string,
): ModelConfidenceContext | undefined {
  const betaUi = useBetaUi();
  const entries = useStringStore((s) => s.entries);
  return React.useMemo(() => {
    if (!betaUi) return undefined;
    const sourceChars = entries.reduce((sum, entry) => sum + entry.sourceText.length, 0);
    return {
      task,
      entryCount: entries.length,
      promptTokensEstimate: Math.ceil(sourceChars / 4) + PROMPT_OVERHEAD_TOKENS[task],
      ...(effort ? { effort: effort as ReasoningEffort } : {}),
    };
  }, [betaUi, entries, task, effort]);
}
