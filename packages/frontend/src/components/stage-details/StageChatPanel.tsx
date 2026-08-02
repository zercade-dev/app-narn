/**
 * Stage details chat panel. Collapsible right-side panel mounted by
 * `StageDetailsTab` behind its `chatOpen` toggle. Wraps
 * `useStageDetailsChat` (the streaming hook) with: a focus selector (field +
 * language, defaulting to the tab's selected language), quick-action chips
 * that send canned prompts, the message list (assistant text rendered as
 * markdown via `ChatMarkdown`, with any `\`\`\`proposal` fences stripped from the
 * prose first — they're already shown as the proposal card below), and a
 * proposal card per `\`\`\`proposal` fence in an assistant message with an Apply
 * button that PATCHes the field via the stage-details store.
 *
 * Mobile (<768px): the panel still renders (the tab's chat TOGGLE is not
 * mobile-gated — see `StageDetailsTab`), showing read-only message/proposal
 * history, but every write affordance — the quick-action chips, the input
 * row, and each proposal's Apply button — is dropped, matching the strict
 * read-only rule the rest of the tab follows.
 *
 * Chat history is client-side only and resets on project switch (render-phase
 * reset keyed on `projectId`, the same pattern `SourceFieldEditor`/
 * `TranslationsPanel` use to re-sync a local buffer from a changed prop).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Settings, Square } from 'lucide-react';
import { STAGE_DETAIL_FIELD_IDS, type StageDetailFieldId } from '@zercade-dev/narn-shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import { useStageDetailsChat } from '../../hooks/use-stage-details-chat.js';
import { useChatProviders } from '../../hooks/use-chat-providers.js';
import { useProjectStore } from '../../stores/project-store.js';
import {
  useStageDetailsStore,
  type StageDetailsPatchBody,
} from '../../stores/stage-details-store.js';
import { useStageAssistantStore } from '../../stores/stage-assistant-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { vaultLockedEvent } from '../../lib/vault-events.js';
import {
  parseProposals,
  stripProposalFences,
  type StageProposal,
} from '../../lib/stage-proposals.js';
import { getErrorMessage } from '../../lib/utils.js';
import { ChatMarkdown } from '@/components/ui/chat-markdown';
import { ModuleModelSelector } from '@/components/config/ModuleModelSelector';
import { ModuleReasoningEffortSelect } from '@/components/config/ModuleReasoningEffortSelect';
import { ThinkingIndicatorHost } from '@/components/ui/thinking-indicator';

const QUICK_ACTIONS = ['improve', 'shorten', 'proofread', 'punchier'] as const;
type QuickAction = (typeof QUICK_ACTIONS)[number];

export interface StageChatPanelProps {
  projectId: string;
  /** Active target languages (excludes the project's source language). */
  languages: string[];
  isMobile: boolean;
  /** True when the current viewer is a language-scoped collaborator (not the owner). */
  isCollaborator: boolean;
  /** Languages this collaborator may write (ignored when not a collaborator). */
  writableLanguages: string[];
}

export function StageChatPanel({
  projectId,
  languages,
  isMobile,
  isCollaborator,
  writableLanguages,
}: Readonly<StageChatPanelProps>): React.JSX.Element {
  const { t } = useTranslation('stage-details');
  const chatFocus = useStageDetailsStore((s) => s.chatFocus);
  const setChatFocus = useStageDetailsStore((s) => s.setChatFocus);
  const selectedLang = useStageDetailsStore((s) => s.selectedLang);
  const patch = useStageDetailsStore((s) => s.patch);
  // StageDetails live on the PROJECT (`project.stageDetails`), not on the
  // stage-details store — that store only holds view state (selectedLang,
  // chatOpen, chatFocus) plus the patch/translate actions.
  const details = useProjectStore((s) => s.projects.find((p) => p.id === projectId)?.stageDetails);

  const { messages, streaming, awaitingFirstToken, error, send, stop, reset } =
    useStageDetailsChat();
  const [input, setInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const overrideInstanceId = useStageAssistantStore((s) => s.instanceId);
  const overrideModel = useStageAssistantStore((s) => s.model);
  const overrideReasoningEffort = useStageAssistantStore((s) => s.reasoningEffort);
  const setOverrideInstanceId = useStageAssistantStore((s) => s.setInstanceId);
  const setOverrideModel = useStageAssistantStore((s) => s.setModel);
  const setOverrideReasoningEffort = useStageAssistantStore((s) => s.setReasoningEffort);
  const verbose = useStageAssistantStore((s) => s.verbose);
  const setVerbose = useStageAssistantStore((s) => s.setVerbose);
  const setView = useViewStore((s) => s.setView);
  // Shared provider/model discovery (fetch + chat-capable/credentialed
  // filtering + the three empty-picker reasons) — see `use-chat-providers.ts`.
  const { instances, emptyReason } = useChatProviders();

  // Render-phase reset: chat history is client-side only, and must never
  // carry over across a project switch (the hook would otherwise stream the
  // wrong project's answer into a conversation the user thinks is scoped to
  // the new one).
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    // Abort any in-flight stream before clearing, else it keeps `streaming`
    // true (and could land a chunk) in the newly-selected project.
    stop();
    reset();
  }

  // Default the focus once (field defaults to the first field id; language to
  // the tab's currently selected language, or "source" when none is set yet).
  useEffect(() => {
    if (!chatFocus) {
      setChatFocus({ field: STAGE_DETAIL_FIELD_IDS[0], lang: selectedLang ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFocus]);

  // Abort any in-flight stream on unmount (panel closed / tab left).
  useEffect(() => () => stop(), [stop]);

  const focusField = chatFocus?.field ?? STAGE_DETAIL_FIELD_IDS[0];
  const focusLang = chatFocus?.lang ?? null;
  const focusLabel = `${t(`fields.${focusField}.label`)} (${focusLang ?? t('chatFocusSource')})`;

  // A provider chosen with no model yet is a normal one-click transient state
  // (picking an instance leaves `model` null until the model select is also
  // touched), but `useStageDetailsChat` only applies the override when BOTH
  // halves are set — otherwise it silently falls back to the project's
  // module. Without this guard the settings zone shows the chosen provider
  // while a send actually goes to the project's module, with no indication
  // to the user. Block every send path (main Send, quick actions, and the
  // no-proposal retry button) and surface a hint, mirroring how
  // `AssistantPanel`'s `canSend`/`showConfigHint` handle the same shape of
  // problem.
  const overridePending = Boolean(overrideInstanceId) && !overrideModel;
  const canSend = !streaming && !overridePending && input.trim().length > 0;
  const showOverrideHint = !settingsOpen && overridePending;

  const handleSend = () => {
    if (!canSend) return;
    const text = input.trim();
    setInput('');
    void send(text);
  };

  const focusText = (): string => {
    const field = details?.[focusField];
    if (!field) return '';
    return focusLang ? (field.translations[focusLang]?.text ?? '') : field.sourceText;
  };

  const runQuickAction = (action: QuickAction) => {
    if (streaming || overridePending) return;
    const current = focusText();
    void send(
      current
        ? `${t(`chatQuickPrompts.${action}`, { focus: focusLabel })}\n\n${t('chatQuickCurrent')}\n${current}`
        : t(`chatQuickPrompts.${action}`, { focus: focusLabel }),
    );
  };

  // Applying a proposal goes through the gated PATCH: a source proposal
  // (`lang === null`) needs the owner's `manage` capability, and a translation
  // proposal needs per-language write capability. Owners may apply anything;
  // a collaborator only sees an enabled Apply for a language they can write
  // (mirrors `assertStageDetailsPatchAllowed` server-side, so a disabled
  // button never offers a PATCH the server would 403).
  const canApply = (proposal: StageProposal): boolean => {
    if (!isCollaborator) return true;
    if (proposal.lang === null) return false;
    return writableLanguages.includes(proposal.lang);
  };

  const handleApply = (proposal: StageProposal) => {
    const patchBody: StageDetailsPatchBody =
      proposal.lang === null
        ? { [proposal.field]: { sourceText: proposal.text } }
        : {
            [proposal.field]: {
              translations: { [proposal.lang]: { text: proposal.text, moduleId: 'chat' } },
            },
          };
    void patch(projectId, patchBody).catch((err: unknown) => {
      toast.error(t('saveFailed', { message: getErrorMessage(err) }));
    });
  };

  return (
    <div
      className="w-full shrink-0 space-y-3 rounded-lg border border-border p-3 sm:w-96"
      data-testid="stage-details-chat-panel"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{t('chatAssistant')}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('chatSettings')}
          data-testid="stage-details-chat-settings-toggle"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <Settings />
        </Button>
      </div>
      {settingsOpen && (
        <div
          className="space-y-2 rounded-lg border border-border p-2"
          data-testid="stage-details-chat-settings"
        >
          {instances.length === 0 ? (
            emptyReason === 'vault-locked' ? (
              // Configured provider(s) exist but the vault is locked — the
              // dominant cloud case. Offer the unlock flow, don't send the
              // user off to Global Config to re-configure what's already set.
              <p
                className="text-xs text-muted-foreground"
                data-testid="stage-details-chat-vault-locked"
              >
                {t('chatVaultLocked')}{' '}
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  data-testid="stage-details-chat-unlock-vault"
                  onClick={() => globalThis.dispatchEvent(vaultLockedEvent({}))}
                >
                  {t('chatUnlockVault')}
                </button>
              </p>
            ) : (
              <p
                className="text-xs text-muted-foreground"
                data-testid="stage-details-chat-no-instance"
              >
                {emptyReason === 'no-credentials' ? t('chatNoCredentials') : t('chatNoInstance')}{' '}
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  data-testid="stage-details-chat-config-link"
                  onClick={() => setView('global-config')}
                >
                  {t('chatOpenConfig')}
                </button>
              </p>
            )
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('chatInstanceLabel')}</span>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  data-testid="stage-details-chat-instance"
                  value={overrideInstanceId ?? ''}
                  onChange={(e) => setOverrideInstanceId(e.target.value || null)}
                >
                  <option value="">{t('chatUseProjectModule')}</option>
                  {instances.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              {overrideInstanceId ? (
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('chatModelLabel')}</span>
                  <ModuleModelSelector
                    moduleId={overrideInstanceId}
                    id="stage-details-chat-model"
                    value={overrideModel ?? ''}
                    onValueChange={(v) => setOverrideModel(v || null)}
                    triggerClassName="w-full"
                  />
                </label>
              ) : null}
              {overrideInstanceId && overrideModel ? (
                <ModuleReasoningEffortSelect
                  moduleId={overrideInstanceId}
                  model={overrideModel}
                  value={overrideReasoningEffort ?? undefined}
                  onChange={(v) => setOverrideReasoningEffort(v || null)}
                  id="stage-details-chat-reasoning-effort"
                  label={t('chatReasoningEffort')}
                  triggerClassName="w-full"
                />
              ) : null}
            </>
          )}
          {/* Outside the instance branch: verbose logging is about diagnosing a
              turn, so it stays available whether or not a provider override is
              set — and still useful when the vault is locked and the user is
              working out why. */}
          <label className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              className="mt-0.5 size-3.5 accent-primary"
              data-testid="stage-details-chat-verbose"
              checked={verbose ?? false}
              onChange={(e) => setVerbose(e.target.checked)}
            />
            <span className="space-y-0.5">
              <span className="block text-xs text-muted-foreground">{t('chatVerboseLabel')}</span>
              <span className="block text-[11px] text-muted-foreground/70">
                {t('chatVerboseHint')}
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">{t('chatFocusField')}</span>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            data-testid="stage-details-chat-focus-field"
            value={focusField}
            onChange={(e) =>
              setChatFocus({ field: e.target.value as StageDetailFieldId, lang: focusLang })
            }
          >
            {STAGE_DETAIL_FIELD_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`fields.${id}.label`)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">{t('chatFocusLanguage')}</span>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            data-testid="stage-details-chat-focus-lang"
            value={focusLang ?? ''}
            onChange={(e) => setChatFocus({ field: focusField, lang: e.target.value || null })}
          >
            <option value="">{t('chatFocusSource')}</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="max-h-96 min-w-0 space-y-2 overflow-y-auto"
        data-testid="stage-details-chat-messages"
      >
        {messages.length === 0 && <p className="text-xs text-muted-foreground">{t('chatEmpty')}</p>}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={`u-${i}`}
              className="ml-auto min-w-0 max-w-[85%] rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm whitespace-pre-wrap break-words"
            >
              {m.content}
            </div>
          ) : (
            <div key={`a-${i}`} className="space-y-1.5">
              {stripProposalFences(m.content) && (
                <ChatMarkdown
                  content={stripProposalFences(m.content)}
                  className="mr-auto max-w-[85%] rounded-lg bg-muted px-2.5 py-1.5"
                />
              )}
              {parseProposals(m.content).map((p, pi) => (
                <div
                  key={`p-${pi}`}
                  className="space-y-1 rounded-lg border border-border p-2 text-xs"
                  data-testid="stage-details-proposal-card"
                >
                  <div className="font-medium">
                    {t(`fields.${p.field}.label`)} · {p.lang ?? t('chatFocusSource')}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">{p.text}</p>
                  {p.why && (
                    <p className="text-muted-foreground/80 italic">
                      {t('chatProposalWhy', { why: p.why })}
                    </p>
                  )}
                  {!isMobile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      data-testid="stage-details-proposal-apply"
                      disabled={!canApply(p)}
                      title={canApply(p) ? undefined : t('chatProposalApplyNotAllowed')}
                      onClick={() => handleApply(p)}
                    >
                      {t('chatProposalApply')}
                    </Button>
                  )}
                </div>
              ))}
              {!isMobile &&
                !streaming &&
                i === messages.length - 1 &&
                parseProposals(m.content).length === 0 && (
                  <div
                    className="flex items-center gap-2 rounded-lg border border-dashed border-border p-2 text-xs text-muted-foreground"
                    data-testid="stage-details-no-proposal-hint"
                  >
                    <span className="flex-1">{t('chatNoProposalHint')}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      data-testid="stage-details-no-proposal-retry"
                      disabled={overridePending}
                      onClick={() => {
                        const current = focusText();
                        const prompt = t('chatNoProposalRetry', {
                          field: t(`fields.${focusField}.label`),
                          lang: focusLang ?? t('chatFocusSource'),
                        });
                        // Same empty-focus guard as `runQuickAction`: omit the
                        // "Current text:" tail entirely rather than send a
                        // prompt ending in a blank current-text section.
                        void send(
                          current ? `${prompt}\n\n${t('chatQuickCurrent')}\n${current}` : prompt,
                        );
                      }}
                    >
                      {t('chatNoProposalRetryButton')}
                    </Button>
                  </div>
                )}
            </div>
          ),
        )}
        {awaitingFirstToken && <ThinkingIndicatorHost />}
      </div>

      {error && (
        <p className="text-xs text-destructive" data-testid="stage-details-chat-error">
          {error}
        </p>
      )}

      {!isMobile && (
        <>
          {showOverrideHint && (
            <p
              className="text-xs text-muted-foreground"
              data-testid="stage-details-chat-override-hint"
            >
              {t('chatOverridePending')}{' '}
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                data-testid="stage-details-chat-open-settings"
                onClick={() => setSettingsOpen(true)}
              >
                {t('chatOpenSettings')}
              </button>
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action}
                type="button"
                variant="outline"
                size="xs"
                disabled={streaming || overridePending}
                data-testid={`stage-details-chat-quick-${action}`}
                onClick={() => runQuickAction(action)}
              >
                {t(`chatQuickActions.${action}`)}
              </Button>
            ))}
          </div>

          <div className="flex items-end gap-1.5">
            <Textarea
              className="min-h-9"
              rows={2}
              data-testid="stage-details-chat-input"
              placeholder={t('chatInputPlaceholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {streaming ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('chatStop')}
                data-testid="stage-details-chat-stop"
                onClick={stop}
              >
                <Square />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              aria-label={t('chatSend')}
              data-testid="stage-details-chat-send"
              disabled={!canSend}
              onClick={handleSend}
            >
              <Send />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
