/**
 * VaultEditorDialog — edit credential keys/values stored in the encrypted vault.
 *
 * Requires the vault to be unlocked. The vault file is re-encrypted with the
 * user-supplied password on save (the server never retains the password).
 *
 * Rendered as a Sheet because no shadcn `dialog` primitive is installed.
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVaultStore } from '../../stores/vault-store.js';
import { redirectTo } from '../../lib/auth-redirect.js';
import { useRefocusOnLoadingDone } from './use-refocus.js';
import { apiRequest } from '../../hooks/use-api.js';
import { useAsyncData } from '../../hooks/use-async-data.js';
import { getPasswordPolicyMessages, translatePolicyMessage } from '../../lib/password-policy.js';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ComboboxInput } from '@/components/ui/combobox-input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface VaultEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional initial key to focus when opening (e.g. clicking a credential row). */
  focusKey?: string;
}

interface RowState {
  key: string;
  value: string;
  /** True for rows representing existing keys (value is empty placeholder until user types). */
  existing: boolean;
  /** True when user marks the row for deletion. */
  remove: boolean;
}

export function VaultEditorDialog({
  open,
  onOpenChange,
  focusKey,
}: Readonly<VaultEditorDialogProps>) {
  const { t } = useTranslation('vault');
  const keys = useVaultStore((s) => s.keys);
  const loading = useVaultStore((s) => s.loading);
  const updateCredentials = useVaultStore((s) => s.updateCredentials);
  const changePassword = useVaultStore((s) => s.changePassword);
  const cloudManaged = useVaultStore((s) => s.cloudManaged);
  const [rows, setRows] = useState<RowState[]>([]);
  const [password, setPassword] = useState('');
  const passwordInputRef = useRef<HTMLInputElement>(null);
  // Value input of the focusKey row; the sheet's focus trap would otherwise
  // move focus to the popup and ignore the input's autoFocus attribute.
  const focusValueInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Change-password state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPasswordVal, setCurrentPasswordVal] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

  // Reset dialog state during render when it opens (or the vault keys change
  // while open); avoids a synchronous setState inside an effect.
  const [prevReset, setPrevReset] = useState<{
    open: boolean;
    keys: typeof keys;
    focusKey: typeof focusKey;
  } | null>(null);
  if (prevReset?.open !== open || prevReset?.keys !== keys || prevReset?.focusKey !== focusKey) {
    setPrevReset({ open, keys, focusKey });
    if (open) {
      setError(null);
      setPassword('');
      setChangePasswordOpen(false);
      setCurrentPasswordVal('');
      setNewPasswordVal('');
      setConfirmPasswordVal('');
      setChangePasswordError(null);
      const newRows = keys.map((k) => ({ key: k, value: '', existing: true, remove: false }));
      if (focusKey && !keys.includes(focusKey)) {
        newRows.push({ key: focusKey, value: '', existing: false, remove: false });
      }
      setRows(newRows);
    }
  }

  // Fetch every module's requiredEnvVars to suggest as key names, grouped by
  // the module (or named module instance) that declares them. Re-runs when the
  // dialog opens; a failed fetch keeps the empty suggestion set (initial).
  const { data: suggestions } = useAsyncData(
    async (signal) => {
      if (!open) return { knownKeys: [], keyGroups: [] };
      interface ModuleSummary {
        id?: string;
        name?: string;
        requiredEnvVars?: string[];
      }
      const res = await apiRequest<{ modules: ModuleSummary[] } | ModuleSummary[]>('/modules', {
        signal,
      });
      const mods = Array.isArray(res) ? res : res.modules;
      const collected = new Set<string>();
      const groups: Array<{ label: string; keys: string[] }> = [];
      for (const m of mods) {
        // This module's declared env vars (named `envVars`, not `keys`, to
        // avoid shadowing the component-scope vault `keys`).
        const envVars = (m.requiredEnvVars ?? []).filter((k) => !collected.has(k));
        for (const k of envVars) collected.add(k);
        if (envVars.length > 0) {
          const sortedEnvVars = [...envVars].sort((a, b) => a.localeCompare(b));
          groups.push({ label: m.name ?? m.id ?? '', keys: sortedEnvVars });
        }
      }
      return { knownKeys: [...collected].sort((a, b) => a.localeCompare(b)), keyGroups: groups };
    },
    [open],
    {
      initial: {
        knownKeys: [] as string[],
        keyGroups: [] as Array<{ label: string; keys: string[] }>,
      },
    },
  );
  const { knownKeys, keyGroups } = suggestions;

  // Re-focus the password input when a save attempt ends in failure (loading
  // transitions true → false while the dialog is still open), so the user can
  // immediately correct the password without having to manually re-click it.
  useRefocusOnLoadingDone(passwordInputRef, loading, open);

  const usedKeys = useMemo(() => new Set(rows.map((r) => r.key.trim()).filter(Boolean)), [rows]);

  const addRow = () => {
    setRows((prev) => [...prev, { key: '', value: '', existing: false, remove: false }]);
  };

  const updateRow = (index: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const deleteRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password.trim()) {
      setError(t('passwordRequired'));
      return;
    }

    // Build updates: removed rows -> null, new/edited values -> string,
    // existing rows with empty value are skipped (no change).
    const updates: Record<string, string | null> = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (!key) continue;
      if (row.remove) {
        updates[key] = null;
      } else if (row.value.length > 0) {
        // New or existing row with a typed value (existing rows with an empty
        // value are left unchanged).
        updates[key] = row.value;
      }
    }

    if (Object.keys(updates).length === 0) {
      onOpenChange(false);
      return;
    }

    try {
      await updateCredentials(updates, password);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    if (!currentPasswordVal.trim() || !newPasswordVal.trim()) {
      setChangePasswordError(t('changePasswordFieldsRequired'));
      return;
    }
    if (newPasswordVal !== confirmPasswordVal) {
      setChangePasswordError(t('changePasswordMismatch'));
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPasswordVal, newPasswordVal);
      toast.success(t('changePasswordSuccess'));
      setChangePasswordOpen(false);
      setCurrentPasswordVal('');
      setNewPasswordVal('');
      setConfirmPasswordVal('');
    } catch (err) {
      const policyMessages = getPasswordPolicyMessages(err);
      setChangePasswordError(
        policyMessages
          ? `${t('errorPasswordPolicy')} ${policyMessages
              .map((m) => translatePolicyMessage(t, m))
              .join(' · ')}`
          : (err as Error).message,
      );
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-w-2xl mx-auto rounded-t-xl max-h-[85vh] overflow-auto"
        initialFocus={focusKey ? focusValueInputRef : undefined}
      >
        <SheetHeader>
          <SheetTitle data-testid="vault-editor-title">{t('editorTitle')}</SheetTitle>
          <SheetDescription>{t('editorDescription')}</SheetDescription>
        </SheetHeader>
        {cloudManaged ? (
          <div className="px-4 py-3 space-y-3" data-testid="vault-manage-on-page-panel">
            <p className="text-sm text-muted-foreground">{t('manageOnVaultPage')}</p>
            <SheetFooter className="px-0">
              <Button
                type="button"
                data-testid="vault-manage-on-page"
                onClick={() => redirectTo('/vault')}
              >
                {t('manageOnVaultPage')}
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <>
            <form onSubmit={handleSave} className="px-4 py-3 space-y-3">
              <div className="space-y-2" data-testid="vault-editor-rows">
                {rows.length === 0 && (
                  <div className="text-sm text-muted-foreground">{t('noKeys')}</div>
                )}
                {rows.map((row, index) => {
                  const customKey = row.key && !knownKeys.includes(row.key) ? row.key : null;
                  // Instance-derived keys have the `<BASE_VAR>__<SLUG>` shape; no
                  // base credential var contains a double underscore, so this
                  // reliably flags an instance-specific key that may be left
                  // blank to inherit the base module's credential (see M6).
                  const isInstanceKey = row.key.includes('__');
                  return (
                    <div
                      key={`${row.existing ? 'k' : 'n'}-${index}`}
                      data-testid={`vault-editor-row-${index}`}
                    >
                      <div className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                        {row.existing ? (
                          <ComboboxInput
                            id={`vault-editor-key-${index}`}
                            suggestions={[]}
                            placeholder={t('keyPlaceholder') ?? undefined}
                            value={row.key}
                            disabled
                            onValueChange={() => {}}
                            data-testid={`vault-editor-key-${index}`}
                            data-key={row.key}
                            autoFocus={focusKey === row.key}
                          />
                        ) : (
                          <Select
                            value={row.key}
                            onValueChange={(v) => updateRow(index, { key: v ?? '' })}
                            disabled={loading}
                          >
                            <SelectTrigger
                              id={`vault-editor-key-${index}`}
                              data-testid={`vault-editor-key-${index}`}
                              data-key={row.key}
                              className="w-full"
                            >
                              <SelectValue placeholder={t('keyPlaceholder') ?? undefined} />
                            </SelectTrigger>
                            <SelectContent>
                              {customKey && <SelectItem value={customKey}>{customKey}</SelectItem>}
                              {keyGroups.map((group) => {
                                const available = group.keys.filter(
                                  (k) => k === row.key || !usedKeys.has(k),
                                );
                                if (available.length === 0) return null;
                                return (
                                  <SelectGroup key={group.label}>
                                    <SelectLabel>{group.label}</SelectLabel>
                                    {available.map((k) => (
                                      <SelectItem key={k} value={k}>
                                        {k}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        )}
                        <Input
                          ref={focusKey === row.key ? focusValueInputRef : undefined}
                          type="password"
                          placeholder={
                            row.existing ? t('valuePlaceholderExisting') : t('valuePlaceholderNew')
                          }
                          value={row.value}
                          disabled={row.remove || loading}
                          onChange={(e) => updateRow(index, { value: e.target.value })}
                          data-testid={`vault-editor-value-${index}`}
                          autoFocus={!row.existing && focusKey === row.key}
                        />
                        {row.existing ? (
                          <Button
                            type="button"
                            variant={row.remove ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateRow(index, { remove: !row.remove })}
                            data-testid={`vault-editor-remove-${index}`}
                          >
                            {row.remove ? t('undoRemove') : t('delete')}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => deleteRow(index)}
                            data-testid={`vault-editor-remove-${index}`}
                            aria-label={t('discard')}
                          >
                            {t('discard')}
                          </Button>
                        )}
                      </div>
                      {isInstanceKey && (
                        <p
                          className="mt-1 text-xs text-muted-foreground"
                          data-testid={`vault-editor-instance-hint-${index}`}
                        >
                          {t('instanceKeyFallbackHint')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                data-testid="vault-editor-add"
              >
                {t('addKey')}
              </Button>
              <div className="space-y-1.5 pt-2 border-t">
                <Label htmlFor="vault-editor-password">{t('passwordLabel')}</Label>
                <Input
                  id="vault-editor-password"
                  data-testid="vault-editor-password"
                  type="password"
                  autoComplete="off"
                  ref={passwordInputRef}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">{t('passwordHelp')}</p>
              </div>
              {error && (
                <div
                  className="text-sm text-destructive"
                  role="alert"
                  data-testid="vault-editor-error"
                >
                  {error}
                </div>
              )}
              <SheetFooter className="px-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  data-testid="vault-editor-cancel"
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={loading} data-testid="vault-editor-save">
                  {loading ? t('working') : t('save')}
                </Button>
              </SheetFooter>
            </form>

            {/* Change password section */}
            <div className="px-4 pb-4 border-t pt-4 space-y-2">
              {changePasswordOpen ? (
                <form
                  onSubmit={handleChangePassword}
                  className="space-y-3"
                  data-testid="vault-change-password-form"
                >
                  <p className="text-sm font-medium">{t('changePasswordTitle')}</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="vault-current-password">
                      {t('changePasswordCurrentLabel')}
                    </Label>
                    <Input
                      id="vault-current-password"
                      data-testid="vault-current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPasswordVal}
                      onChange={(e) => setCurrentPasswordVal(e.target.value)}
                      disabled={changingPassword}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vault-new-password">{t('changePasswordNewLabel')}</Label>
                    <Input
                      id="vault-new-password"
                      data-testid="vault-new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPasswordVal}
                      onChange={(e) => setNewPasswordVal(e.target.value)}
                      disabled={changingPassword}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vault-confirm-password">
                      {t('changePasswordConfirmLabel')}
                    </Label>
                    <Input
                      id="vault-confirm-password"
                      data-testid="vault-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPasswordVal}
                      onChange={(e) => setConfirmPasswordVal(e.target.value)}
                      disabled={changingPassword}
                    />
                  </div>
                  {changePasswordError && (
                    <div
                      className="text-sm text-destructive"
                      role="alert"
                      data-testid="vault-change-password-error"
                    >
                      {changePasswordError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setChangePasswordOpen(false);
                        setChangePasswordError(null);
                      }}
                      disabled={changingPassword}
                      data-testid="vault-change-password-cancel"
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={changingPassword}
                      data-testid="vault-change-password-submit"
                    >
                      {changingPassword ? t('working') : t('changePasswordSubmit')}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setChangePasswordOpen(true)}
                  data-testid="vault-change-password-toggle"
                >
                  {t('changePasswordButton')}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
