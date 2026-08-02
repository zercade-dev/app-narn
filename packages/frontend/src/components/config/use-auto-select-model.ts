/**
 * Auto-selects a model on first successful discovery when the field is still
 * empty, then never overrides the user afterwards. Shared by `ModuleModelSelector`
 * and the Copilot selector — the only difference is whether a `preferredModel`
 * takes precedence over the cheapest one.
 *
 * On first discovery with no model chosen, seeds the field with the preferred
 * model (when it's among the discovered models) otherwise the cheapest, instead
 * of a hardcoded manifest default. A ref guards against re-selecting if the user
 * later clears the field by hand.
 */
import * as React from 'react';
import type { ModelInfo } from '@zercade-dev/narn-shared';
import { pickCheapestModel } from '@/lib/pick-cheapest-model';

export function useAutoSelectModel(
  value: string,
  models: ModelInfo[],
  loading: boolean,
  disabled: boolean | undefined,
  onValueChange: (value: string) => void,
  preferredModel?: string,
): void {
  const autoSelectedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoSelectedRef.current || disabled || loading) return;
    if (value !== '' || models.length === 0) return;
    const preferred = preferredModel ? models.find((m) => m.id === preferredModel) : undefined;
    const choice = preferred ?? pickCheapestModel(models);
    if (choice) {
      autoSelectedRef.current = true;
      onValueChange(choice.id);
    }
  }, [value, loading, models, disabled, onValueChange, preferredModel]);
}
