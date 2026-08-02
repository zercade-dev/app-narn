/**
 * Shared "enable then prompt for the first missing credential" helper.
 *
 * After a module (or instance) is enabled, the caller derives the set of
 * credential keys the module requires and the keys already present in the vault,
 * then asks this helper to open the vault-key editor for the first one that is
 * still missing — but only when the vault is unlocked (a locked vault can't take
 * a key yet, and the missing-credential warning on the card already signals it).
 *
 * Callers differ only in how they derive the required keys (raw `requiredEnvVars`
 * vs per-instance `deriveInstanceCredentialKey`), so that derivation stays the
 * caller's responsibility and is passed in as `requiredKeys`.
 */
export function promptFirstMissingCredential(
  requiredKeys: readonly string[],
  presentKeys: readonly string[],
  options: Readonly<{ unlocked: boolean; onEditVaultKey: (key: string) => void }>,
): void {
  if (!options.unlocked) return;
  const missing = requiredKeys.filter((key) => !presentKeys.includes(key));
  if (missing.length > 0) options.onEditVaultKey(missing[0]);
}
