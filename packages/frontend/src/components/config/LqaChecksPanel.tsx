import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LQACheckConfig, LQASeverity, Project } from '@zercade-dev/narn-shared';
import {
  LANGUAGE_REGISTRY,
  getLengthLimit,
  DEFAULT_ACHIEVEMENT_NAME_MAX_BYTES,
  DEFAULT_ACHIEVEMENT_DESCRIPTION_MAX_BYTES,
} from '@zercade-dev/narn-shared';
import { toast } from '@/lib/toast';
import { apiRequest } from '../../hooks/use-api.js';
import { useAutoSave } from '../../hooks/use-auto-save.js';
import { useAsyncData } from '../../hooks/use-async-data.js';
import { useProjectStore } from '../../stores/project-store.js';
import { AutoSaveStatus } from './AutoSaveStatus.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';

interface CheckDescriptor {
  id: string;
  defaultSeverity: LQASeverity;
  defaultEnabled: boolean;
}

interface LqaChecksMeta {
  checks: CheckDescriptor[];
}

interface RegexAssertionDraft {
  pattern: string;
  flags?: string;
  mode: 'must-match' | 'must-not-match';
  message?: string;
}

type ChecksDraft = Record<string, LQACheckConfig>;

function languageName(code: string): string {
  return LANGUAGE_REGISTRY.find((l) => l.code === code)?.name ?? code;
}

function parseTermList(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function termListToString(value: unknown): string {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string').join(', ') : '';
}

function assertionsFromOptions(
  options: Record<string, unknown> | undefined,
): RegexAssertionDraft[] {
  const raw = options?.assertions;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a) => ({
      pattern: typeof a.pattern === 'string' ? a.pattern : '',
      flags: typeof a.flags === 'string' ? a.flags : undefined,
      mode: a.mode === 'must-not-match' ? ('must-not-match' as const) : ('must-match' as const),
      message: typeof a.message === 'string' ? a.message : undefined,
    }));
}

export function LqaChecksPanel({ project }: { project: Project }) {
  const { t } = useTranslation('config');
  const { updateProject, fetchProjects } = useProjectStore();
  const { data: meta } = useAsyncData<LqaChecksMeta | null>(
    () => apiRequest<LqaChecksMeta>('/lqa/checks'),
    [],
    {
      initial: null,
      onError: (err) => toast.error(t('lqa.loadFailed', { message: (err as Error).message })),
    },
  );
  const [draft, setDraft] = useState<ChecksDraft>(project.lqaConfig?.checks ?? {});
  const [dirty, setDirty] = useState(false);
  // Bumped to remount the uncontrolled comma-separated inputs after a reset.
  const [resetKey, setResetKey] = useState(0);

  // Reset the draft during render when the active project changes.
  const [prevProjectId, setPrevProjectId] = useState(project.id);
  if (prevProjectId !== project.id) {
    setPrevProjectId(project.id);
    setDraft(project.lqaConfig?.checks ?? {});
    setDirty(false);
    setResetKey((k) => k + 1);
  }

  // Declared before the `!meta` early return so the hook order stays stable.
  const {
    status,
    error: saveError,
    schedule,
    flush,
  } = useAutoSave<ChecksDraft>({
    save: async (checks) => {
      await updateProject(project.id, { lqaConfig: { checks } });
      await fetchProjects();
    },
  });

  if (!meta) return null;

  const cfgFor = (id: string): LQACheckConfig => draft[id] ?? {};
  const patchCfg = (id: string, patch: Partial<LQACheckConfig>) => {
    const next = { ...draft, [id]: { ...draft[id], ...patch } };
    setDraft(next);
    setDirty(true);
    schedule(next);
  };
  const patchOptions = (id: string, patch: Record<string, unknown>) => {
    const current = cfgFor(id).options ?? {};
    patchCfg(id, { options: { ...current, ...patch } });
  };

  // Display order: enabled checks first, then blocking before warning. Both
  // flags use the EFFECTIVE value (per-project override ?? descriptor default).
  // A stable secondary sort by the descriptor's original index keeps the order
  // deterministic for ties. This is display-only and does not affect toggles.
  const sortedChecks = meta.checks
    .map((check, index) => {
      const cfg = cfgFor(check.id);
      return {
        check,
        index,
        enabled: cfg.enabled ?? check.defaultEnabled,
        severity: cfg.severity ?? check.defaultSeverity,
      };
    })
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      if (a.severity !== b.severity) return a.severity === 'blocking' ? -1 : 1;
      return a.index - b.index;
    })
    .map((c) => c.check);

  const renderForbiddenTermsOptions = () => {
    const options = cfgFor('forbidden-terms').options ?? {};
    const byLanguage =
      options.termsByLanguage && typeof options.termsByLanguage === 'object'
        ? (options.termsByLanguage as Record<string, unknown>)
        : {};
    return (
      <div className="space-y-2" key={`forbidden-${resetKey}`}>
        <div className="grid grid-cols-[8rem_1fr] items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('lqa.forbiddenAllLabel')}</span>
          <Input
            defaultValue={termListToString(options.terms)}
            placeholder={t('lqa.forbiddenPlaceholder')}
            onChange={(e) =>
              patchOptions('forbidden-terms', { terms: parseTermList(e.target.value) })
            }
            onBlur={() => void flush()}
            data-testid="lqa-forbidden-terms-all"
            data-content
          />
        </div>
        {project.activeLanguages.map((lang) => (
          <div key={lang} className="grid grid-cols-[8rem_1fr] items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {languageName(lang)} ({lang})
            </span>
            <Input
              defaultValue={termListToString(byLanguage[lang])}
              placeholder={t('lqa.forbiddenPlaceholder')}
              onChange={(e) =>
                patchOptions('forbidden-terms', {
                  termsByLanguage: { ...byLanguage, [lang]: parseTermList(e.target.value) },
                })
              }
              onBlur={() => void flush()}
              data-testid={`lqa-forbidden-terms-${lang}`}
              data-content
            />
          </div>
        ))}
      </div>
    );
  };

  const renderRegexOptions = () => {
    const assertions = assertionsFromOptions(cfgFor('regex-assertions').options);
    const setAssertions = (next: RegexAssertionDraft[]) =>
      patchOptions('regex-assertions', { assertions: next });
    const patchAssertion = (index: number, patch: Partial<RegexAssertionDraft>) =>
      setAssertions(assertions.map((a, i) => (i === index ? { ...a, ...patch } : a)));
    return (
      <div className="space-y-2">
        {assertions.map((assertion, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input
              className="w-56 font-mono text-xs"
              value={assertion.pattern}
              placeholder={t('lqa.regexPattern')}
              aria-label={t('lqa.regexPattern')}
              onChange={(e) => patchAssertion(i, { pattern: e.target.value })}
              onBlur={() => void flush()}
              data-testid={`lqa-regex-pattern-${i}`}
            />
            <Input
              className="w-16 font-mono text-xs"
              value={assertion.flags ?? ''}
              placeholder={t('lqa.regexFlags')}
              aria-label={t('lqa.regexFlags')}
              onChange={(e) => patchAssertion(i, { flags: e.target.value || undefined })}
              onBlur={() => void flush()}
              data-testid={`lqa-regex-flags-${i}`}
            />
            <Select
              value={assertion.mode}
              onValueChange={(v) => patchAssertion(i, { mode: v as RegexAssertionDraft['mode'] })}
            >
              <SelectTrigger className="w-40" data-testid={`lqa-regex-mode-${i}`}>
                <SelectValue>
                  {(v: string | null) =>
                    v === 'must-not-match'
                      ? t('lqa.regexModeMustNotMatch')
                      : t('lqa.regexModeMustMatch')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="must-match">{t('lqa.regexModeMustMatch')}</SelectItem>
                <SelectItem value="must-not-match">{t('lqa.regexModeMustNotMatch')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="w-56"
              value={assertion.message ?? ''}
              placeholder={t('lqa.regexMessage')}
              aria-label={t('lqa.regexMessage')}
              onChange={(e) => patchAssertion(i, { message: e.target.value || undefined })}
              onBlur={() => void flush()}
              data-testid={`lqa-regex-message-${i}`}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('lqa.regexRemove')}
              onClick={() => setAssertions(assertions.filter((_, j) => j !== i))}
              data-testid={`lqa-regex-remove-${i}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAssertions([...assertions, { pattern: '', mode: 'must-match' }])}
          data-testid="lqa-regex-add"
        >
          <Plus className="size-4" /> {t('lqa.regexAddAssertion')}
        </Button>
      </div>
    );
  };

  // Read-only reference: the game editor's hard per-language limits are static
  // constants (not project-configurable), so we surface them for the project's
  // active languages rather than offering inputs.
  const renderLengthLimitOptions = () => (
    <div className="space-y-2" data-testid="lqa-length-limit-options">
      <p className="text-xs text-muted-foreground">{t('lqa.lengthLimitNote')}</p>
      {project.activeLanguages.map((lang) => {
        const isSource = lang === project.sourceLanguage;
        const limit = getLengthLimit(lang);
        return (
          <div key={lang} className="grid grid-cols-[8rem_1fr] items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {languageName(lang)} ({lang})
            </span>
            <span className="font-mono text-xs" data-testid={`lqa-length-limit-${lang}`}>
              {isSource
                ? t('lqa.lengthLimitSource')
                : limit
                  ? t('lqa.lengthLimitValue', { chars: limit.maxChars, bytes: limit.maxBytes })
                  : t('lqa.lengthLimitNone')}
            </span>
          </div>
        );
      })}
    </div>
  );

  const renderAchievementLimitOptions = () => {
    const options = cfgFor('achievement-length-limit').options ?? {};
    const nameBytes =
      typeof options.nameMaxBytes === 'number'
        ? options.nameMaxBytes
        : DEFAULT_ACHIEVEMENT_NAME_MAX_BYTES;
    const descBytes =
      typeof options.descriptionMaxBytes === 'number'
        ? options.descriptionMaxBytes
        : DEFAULT_ACHIEVEMENT_DESCRIPTION_MAX_BYTES;
    return (
      <div
        className="space-y-2"
        data-testid="lqa-achievement-limit-options"
        key={`achievement-${resetKey}`}
      >
        <div className="grid grid-cols-[12rem_1fr] items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t('lqa.achievementNameBytesLabel')}
          </span>
          <Input
            type="number"
            min={1}
            className="w-28"
            defaultValue={nameBytes}
            onChange={(e) =>
              patchOptions('achievement-length-limit', {
                nameMaxBytes: Math.max(
                  1,
                  Math.floor(Number(e.target.value) || DEFAULT_ACHIEVEMENT_NAME_MAX_BYTES),
                ),
              })
            }
            onBlur={() => void flush()}
            data-testid="lqa-achievement-name-bytes"
          />
        </div>
        <div className="grid grid-cols-[12rem_1fr] items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t('lqa.achievementDescriptionBytesLabel')}
          </span>
          <Input
            type="number"
            min={1}
            className="w-28"
            defaultValue={descBytes}
            onChange={(e) =>
              patchOptions('achievement-length-limit', {
                descriptionMaxBytes: Math.max(
                  1,
                  Math.floor(Number(e.target.value) || DEFAULT_ACHIEVEMENT_DESCRIPTION_MAX_BYTES),
                ),
              })
            }
            onBlur={() => void flush()}
            data-testid="lqa-achievement-description-bytes"
          />
        </div>
      </div>
    );
  };

  return (
    <Card data-testid="lqa-checks-panel">
      <CardHeader>
        <CardTitle>{t('lqa.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('lqa.description')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedChecks.map((check) => {
          const cfg = cfgFor(check.id);
          const enabled = cfg.enabled ?? check.defaultEnabled;
          const severity = cfg.severity ?? check.defaultSeverity;
          return (
            <div key={check.id} className="space-y-2 border-b pb-3 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-64 items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={(c) => patchCfg(check.id, { enabled: c === true })}
                    data-testid={`lqa-check-toggle-${check.id}`}
                  />
                  {t(`lqa.checks.${check.id}.name`)}
                </label>
                <Select
                  value={severity}
                  onValueChange={(v) => {
                    if (v) patchCfg(check.id, { severity: v as LQASeverity });
                  }}
                >
                  <SelectTrigger
                    className="w-36"
                    disabled={!enabled}
                    data-testid={`lqa-check-severity-${check.id}`}
                  >
                    <SelectValue>
                      {(v: string | null) =>
                        v === 'blocking' ? t('lqa.severityBlocking') : t('lqa.severityWarning')
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blocking">{t('lqa.severityBlocking')}</SelectItem>
                    <SelectItem value="warning">{t('lqa.severityWarning')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(`lqa.checks.${check.id}.description`)}
              </p>
              {enabled && check.id === 'length-limit' && renderLengthLimitOptions()}
              {enabled && check.id === 'forbidden-terms' && renderForbiddenTermsOptions()}
              {enabled && check.id === 'regex-assertions' && renderRegexOptions()}
              {enabled &&
                check.id === 'achievement-length-limit' &&
                renderAchievementLimitOptions()}
            </div>
          );
        })}
        {(dirty || status !== 'idle') && (
          <div className="flex items-center gap-2 border-t pt-3">
            {dirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Supersede any still-pending debounced save with the reverted
                  // value, then flush it immediately — otherwise the earlier
                  // schedule() could still fire after this and re-apply the
                  // discarded edit.
                  const reverted = project.lqaConfig?.checks ?? {};
                  setDraft(reverted);
                  setDirty(false);
                  setResetKey((k) => k + 1);
                  schedule(reverted);
                  void flush();
                }}
                data-testid="lqa-discard-button"
              >
                {t('discard')}
              </Button>
            )}
            <AutoSaveStatus status={status} error={saveError} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
