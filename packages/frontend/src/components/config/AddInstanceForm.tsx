import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deriveInstanceCredentialKey,
  isValidInstanceSlug,
  parseModuleInstanceId,
} from '@zercade-dev/narn-shared';
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
 * Slugs already used by instances of `baseModuleId`, read off a `GET /api/modules`
 * listing — which includes every registered instance regardless of whether it is
 * enabled, so it is a complete picture. Feeds {@link AddInstanceForm}'s
 * `takenSlugs`.
 */
export function instanceSlugsOf(
  modules: readonly { id: string; baseModuleId?: string }[],
  baseModuleId: string,
): string[] {
  return modules
    .filter((m) => m.baseModuleId === baseModuleId)
    .map((m) => parseModuleInstanceId(m.id)?.slug)
    .filter((s): s is string => s !== undefined);
}

/** Fallback slug stem used when the base module id is not itself slug-shaped. */
const FALLBACK_SLUG_STEM = 'instance';

/**
 * First free slug in the sequence `<base>`, `<base>-2`, `<base>-3`, … — the value
 * the creation form opens with, so the user never has to invent an id. Gaps are
 * filled rather than skipped, and the result always satisfies
 * {@link isValidInstanceSlug} (a base module id that isn't slug-shaped falls back
 * to the `instance…` stem; no registered module id does today).
 */
export function suggestInstanceSlug(baseModuleId: string, takenSlugs?: Iterable<string>): string {
  const taken = new Set(takenSlugs ?? []);
  const stem = isValidInstanceSlug(baseModuleId) ? baseModuleId : FALLBACK_SLUG_STEM;
  if (!taken.has(stem)) return stem;
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
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
  takenSlugs,
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
  /** Slugs already used by instances of this base module — the suggestion skips them. */
  takenSlugs?: readonly string[];
  onCreated: () => void;
  onCancel: () => void;
  /**
   * Open the vault editor focused on the given key. Optional: when omitted (or
   * the vault is locked) the post-create credential prompt is simply skipped.
   */
  onEditVaultKey?: (key: string) => void;
}>): React.JSX.Element {
  const { t } = useTranslation('config');
  // Both inputs open pre-filled so a plain "Create" works with no typing: the
  // slug is the first free `<base>`/`<base>-2`/… value, and the display name
  // mirrors the server's own default for an omitted name. A base-named instance
  // (e.g. anthropic:anthropic) is deliberately allowed, so suggesting the bare
  // base id first is safe.
  const suggestedSlug = suggestInstanceSlug(baseModule.id, takenSlugs);
  const defaultDisplayName = (forSlug: string) =>
    forSlug ? `${baseModule.name} (${forSlug})` : '';
  const [slug, setSlug] = useState(suggestedSlug);
  const [displayName, setDisplayName] = useState(() => defaultDisplayName(suggestedSlug));
  // Once the user edits the name it stops tracking the slug.
  const [nameTouched, setNameTouched] = useState(false);
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
          onChange={(e) => {
            setSlug(e.target.value);
            if (!nameTouched) setDisplayName(defaultDisplayName(e.target.value));
          }}
          placeholder={suggestedSlug}
          className="w-64"
          data-testid="instance-slug-input"
        />
        {slug && slugReserved ? (
          <p className="text-xs text-destructive" data-testid="instance-slug-reserved">
            {t('instances.slugReserved', { slug })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('instances.slugHelp', { base: baseModule.name })}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`instance-name-${baseModule.id}`}>{t('instances.nameLabel')}</Label>
        <Input
          id={`instance-name-${baseModule.id}`}
          value={displayName}
          onChange={(e) => {
            setNameTouched(true);
            setDisplayName(e.target.value);
          }}
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
