import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deriveInstanceCredentialKey, isValidInstanceSlug } from '@zercade-dev/narn-shared';
import { promptFirstMissingCredential } from './credential-prompt.js';
import { apiRequest } from '../../hooks/use-api.js';
import { resolveDefaultReasoningEffort } from '../../lib/default-reasoning-effort.js';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** The subset of module metadata the form needs from its base module. */
export interface AddInstanceBaseModule {
  id: string;
  name: string;
  /** The base module's declared credential vault keys (derived per instance). */
  requiredEnvVars: string[];
}

/**
 * Inline form for creating a named instance of a base module
 * (slug is immutable; display name is editable afterwards).
 */
export function AddInstanceForm({
  baseModule,
  unlocked,
  existingKeys,
  reservedSlugs,
  onCreated,
  onCancel,
  onEditVaultKey,
}: Readonly<{
  baseModule: AddInstanceBaseModule;
  /** Whether the credential vault is currently unlocked. */
  unlocked?: boolean;
  /** Vault keys that already exist (so we only prompt for missing ones). */
  existingKeys?: string[];
  /**
   * Module ids the slug must NOT equal — a slug matching a real module id is
   * rejected server-side ("slug-collides-with-module"). Defaults to just this
   * base module's own id when the caller doesn't pass the full set.
   */
  reservedSlugs?: readonly string[];
  onCreated: () => void;
  onCancel: () => void;
  /**
   * Open the vault editor focused on the given key. Optional: when omitted (or
   * the vault is locked) the post-create credential prompt is simply skipped.
   */
  onEditVaultKey?: (key: string) => void;
}>): React.JSX.Element {
  const { t } = useTranslation('config');
  // Start blank rather than seeding the base module id: a base-named instance
  // (e.g. "anthropic" → anthropic:anthropic) is now allowed, so pre-filling the
  // base id would create one on a blind Create. Forcing a deliberate slug choice
  // avoids that; the placeholder shows the expected shape instead.
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);
  // Reserve OTHER modules' ids so a colliding slug is blocked in the form (not
  // just rejected by the server), but allow the instance's OWN base id so a
  // base-named instance (e.g. copilot → copilot:copilot) is permitted.
  const reserved = new Set((reservedSlugs ?? [baseModule.id]).filter((s) => s !== baseModule.id));
  const slugReserved = reserved.has(slug);
  const slugValid = isValidInstanceSlug(slug) && !slugReserved;

  const handleCreate = async () => {
    setCreating(true);
    let created: { instanceId: string };
    try {
      created = await apiRequest<{ instanceId: string }>('/global-config/instances', {
        method: 'POST',
        body: JSON.stringify({
          baseModuleId: baseModule.id,
          slug,
          displayName: displayName.trim() || undefined,
        }),
      });
    } catch (err) {
      toast.error(t('instances.createFailed', { message: (err as Error).message }));
      setCreating(false);
      return;
    }
    try {
      // First enable of a brand-new instance: no model has been chosen yet, so
      // default `reasoningEffort` to 'disabled' when the model that will end up
      // auto-selected (the cheapest discovered one) supports an explicit
      // disabled state — otherwise leave `config` untouched, as before.
      const config: Record<string, unknown> = {};
      const reasoningEffort = await resolveDefaultReasoningEffort(created.instanceId);
      if (reasoningEffort) config.reasoningEffort = reasoningEffort;
      // Enable the new instance so its card appears immediately (same flow
      // as enabling any module; projects start with the instance switched off).
      await apiRequest(`/global-config/${encodeURIComponent(created.instanceId)}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: true, config }),
      });
      toast.success(t('instances.created'));
      // Prompt for the instance's required credentials right away (mirrors the
      // enable-a-plain-module flow in GlobalConfigView). Keys are the base
      // module's requiredEnvVars derived for this instance's slug; the shared
      // helper does the present-filter + first-missing + unlocked guard.
      const requiredKeys = baseModule.requiredEnvVars.map((v) =>
        deriveInstanceCredentialKey(v, slug),
      );
      if (onEditVaultKey) {
        promptFirstMissingCredential(requiredKeys, existingKeys ?? [], {
          unlocked: unlocked ?? false,
          onEditVaultKey,
        });
      }
    } catch (err) {
      // The instance exists even if enabling failed — surface the error but
      // still close the form and refresh so the list reflects reality.
      toast.error(t('instances.createFailed', { message: (err as Error).message }));
    } finally {
      setCreating(false);
      // Close the form and refresh the module list in both outcomes above.
      onCreated();
    }
  };

  return (
    <div
      className="rounded-md border bg-muted/30 p-3 space-y-2"
      data-testid={`instance-form-${baseModule.id}`}
    >
      <p className="text-sm font-medium">{t('instances.formTitle', { base: baseModule.name })}</p>
      <div className="space-y-1">
        <Label htmlFor={`instance-slug-${baseModule.id}`}>{t('instances.slugLabel')}</Label>
        <Input
          id={`instance-slug-${baseModule.id}`}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="my-ollama"
          className="w-64"
          data-testid="instance-slug-input"
        />
        {slug && slugReserved ? (
          <p className="text-xs text-destructive" data-testid="instance-slug-reserved">
            {t('instances.slugReserved', { slug })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('instances.slugHelp', { base: baseModule.id })}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`instance-name-${baseModule.id}`}>{t('instances.nameLabel')}</Label>
        <Input
          id={`instance-name-${baseModule.id}`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={`${baseModule.name} (${slug || 'slug'})`}
          className="w-64"
          data-testid="instance-name-input"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!slugValid || creating}
          onClick={() => void handleCreate()}
          data-testid="instance-create-button"
        >
          {creating ? t('instances.creating') : t('instances.createButton')}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} data-testid="instance-form-cancel">
          {t('instances.cancelButton')}
        </Button>
      </div>
    </div>
  );
}
