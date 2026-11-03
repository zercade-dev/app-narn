/** True for an always-free model id (OpenRouter-style `:free` suffix). */
export function isAlwaysFreeModel(modelId: string | undefined): boolean {
  return modelId !== undefined && modelId.endsWith(':free');
}
