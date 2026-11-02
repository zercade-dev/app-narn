import { format, resolveConfig } from 'prettier';

/**
 * Serialises the free-tier snapshot the way the repo's Prettier config would, so a
 * freshly distilled `free-tier-data.json` passes `prettier --check` (and therefore
 * `make verify`) without a manual `prettier --write` afterwards.
 */
export async function formatSnapshotJson(value: unknown, filePath: string): Promise<string> {
  const config = (await resolveConfig(filePath)) ?? {};
  return format(JSON.stringify(value, null, 2), { ...config, filepath: filePath });
}
