/**
 * Collapsible AI-assistant panel for the Text Styler tab.
 *
 * Streams a conversation via {@link useColorTextChat} and lets the user pick a
 * credentialed chat provider instance + model (persisted in the color-text
 * store).
 *
 * An assistant reply is split by `lib/styled-proposals.ts` into prose — rendered
 * as markdown via `ChatMarkdown`, with the suggestion fences stripped so nothing
 * shows twice — and one **proposal card** per suggestion, carrying the proposed
 * text, its one-sentence reason, and Apply/Discard. Apply hands the text back
 * through `onApplySuggestion` so the parent view drops it into the editor.
 *
 * Provider list: fetched once from `/modules` and filtered client-side to
 * instances that are credentialed, enabled, and whose base module is in the
 * chat-supported set. DeepL / pseudo / copilot are deliberately excluded (see
 * `CHAT_SUPPORTED_BASE` in `use-chat-providers.ts`) — not AI chat / SDK-only,
 * respectively. That fetch/filter logic is shared with the Stage details chat
 * via `useChatProviders` (see that hook's doc comment).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Check, ChevronDown, ChevronUp, Send, Settings, Square } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Textarea } from '../ui/textarea.js';
import { cn } from '../../lib/utils.js';
import { useColorTextChat } from '../../hooks/use-color-text-chat.js';
import { useChatProviders } from '../../hooks/use-chat-providers.js';
import { useColorTextStore } from '../../stores/color-text-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { parseStyledProposals, stripStyledFences } from '../../lib/styled-proposals.js';
import { vaultLockedEvent } from '../../lib/vault-events.js';
import { ChatMarkdown } from '../ui/chat-markdown.js';
import { ModuleModelSelector } from '../config/ModuleModelSelector.js';
import { ModuleReasoningEffortSelect } from '../config/ModuleReasoningEffortSelect.js';
import { ThinkingIndicatorHost } from '../ui/thinking-indicator.js';

export interface AssistantPanelProps {
  /** Called with a proposal's text when its Apply button is clicked. */
  onApplySuggestion: (text: string) => void;
}

export function AssistantPanel({ onApplySuggestion }: Readonly<AssistantPanelProps>) {
  const { t } = useTranslation('colorText');
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [input, setInput] = useState('');
  /**
   * Apply/Discard outcome per proposal, keyed `${messageIndex}:${proposalIndex}`.
   * Index keys are safe here: chat turns are append-only within a session and the
   * whole array is replaced by `reset()`, so an index never re-points at a
   * different proposal. Resolution is one-way — a resolved suggestion collapses
   * to a muted line and offers no way back; re-applying means asking again.
   */
  const [resolved, setResolved] = useState<Record<string, 'applied' | 'discarded'>>({});

  const instanceId = useColorTextStore((s) => s.assistant.instanceId);
  const model = useColorTextStore((s) => s.assistant.model);
  const reasoningEffort = useColorTextStore((s) => s.assistant.reasoningEffort);
  const setAssistantInstance = useColorTextStore((s) => s.setAssistantInstance);
  const setAssistantModel = useColorTextStore((s) => s.setAssistantModel);
  const setAssistantReasoningEffort = useColorTextStore((s) => s.setAssistantReasoningEffort);
  const verbose = useColorTextStore((s) => s.assistant.verbose);
  const setAssistantVerbose = useColorTextStore((s) => s.setAssistantVerbose);
  const setView = useViewStore((s) => s.setView);

  const { messages, streaming, awaitingFirstToken, error, send, stop } = useColorTextChat();
  // Shared provider/model discovery (fetch + chat-capable/credentialed
  // filtering + the three empty-picker reasons) — see `use-chat-providers.ts`.
  const { instances, emptyReason } = useChatProviders();

  // Requires BOTH a chosen instance AND a model: `runChat` bails early (setError)
  // when either is missing, so gating on `instanceId` alone left the Send button
  // enabled while a click silently no-op'd. `!!model` keeps them in lockstep.
  const canSend = !streaming && !!instanceId && !!model && input.trim().length > 0;
  // The assistant is unconfigured (no instance, or an instance but no model). The
  // provider/model pickers live behind the settings gear, which is CLOSED by
  // default — so without this surfaced hint the Send button is just a silent
  // dead button. Show a one-line prompt (with a shortcut into the settings zone)
  // whenever the panel is open, the config is incomplete, and settings is closed.
  const showConfigHint = !settingsOpen && (!instanceId || !model);

  const handleSend = () => {
    if (!canSend) return;
    const text = input.trim();
    setInput('');
    void send(text);
  };

  return (
    <div className="rounded-lg border border-border" data-testid="text-styler-assistant">
      <div className="flex items-center gap-1.5 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          data-testid="text-styler-assistant-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Bot />
          {t('assistant.title')}
          {open ? <ChevronUp /> : <ChevronDown />}
        </Button>
        <div className="grow" />
        {open ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('assistant.settings')}
            aria-expanded={settingsOpen}
            data-testid="text-styler-assistant-settings-toggle"
            onClick={() => setSettingsOpen((s) => !s)}
          >
            <Settings />
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-2 border-t border-border p-2">
          {settingsOpen ? (
            <div
              className="space-y-2 rounded-md bg-muted/40 p-2"
              data-testid="text-styler-assistant-settings"
            >
              {instances.length === 0 ? (
                emptyReason === 'vault-locked' ? (
                  // Configured provider(s) exist but the vault is locked — the
                  // dominant cloud case. Offer the unlock flow, don't send the
                  // user off to Global Config to re-configure what's already set.
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="text-styler-assistant-vault-locked"
                  >
                    {t('assistant.vaultLocked')}{' '}
                    <button
                      type="button"
                      className="text-primary underline-offset-4 hover:underline"
                      data-testid="text-styler-assistant-unlock-vault"
                      onClick={() => globalThis.dispatchEvent(vaultLockedEvent({}))}
                    >
                      {t('assistant.unlockVault')}
                    </button>
                  </p>
                ) : (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="text-styler-assistant-no-instance"
                  >
                    {emptyReason === 'no-credentials'
                      ? t('assistant.noCredentials')
                      : t('assistant.noInstance')}{' '}
                    <button
                      type="button"
                      className="text-primary underline-offset-4 hover:underline"
                      data-testid="text-styler-assistant-config-link"
                      onClick={() => setView('global-config')}
                    >
                      {t('assistant.openConfig')}
                    </button>
                  </p>
                )
              ) : (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">
                      {t('assistant.instanceLabel')}
                    </span>
                    <select
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      data-testid="text-styler-assistant-instance"
                      value={instanceId ?? ''}
                      onChange={(e) => setAssistantInstance(e.target.value || null)}
                    >
                      <option value="">{t('assistant.pickInstance')}</option>
                      {instances.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {instanceId ? (
                    <label className="block space-y-1">
                      <span className="text-xs text-muted-foreground">
                        {t('assistant.modelLabel')}
                      </span>
                      <ModuleModelSelector
                        moduleId={instanceId}
                        id="text-styler-assistant-model"
                        value={model ?? ''}
                        onValueChange={(v) => setAssistantModel(v || null)}
                        triggerClassName="w-full"
                      />
                    </label>
                  ) : null}
                  {instanceId && model ? (
                    <ModuleReasoningEffortSelect
                      moduleId={instanceId}
                      model={model}
                      value={reasoningEffort ?? undefined}
                      onChange={(v) => setAssistantReasoningEffort(v || null)}
                      id="text-styler-assistant-reasoning-effort"
                      label={t('assistant.reasoningEffort')}
                      triggerClassName="w-full"
                    />
                  ) : null}
                </>
              )}
              {/* Outside the instance branch: verbose logging is about
                  diagnosing a turn, so it stays available whether or not a
                  provider is selected — and still useful when the vault is
                  locked and the user is working out why. */}
              <label className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 accent-primary"
                  data-testid="text-styler-assistant-verbose"
                  checked={verbose ?? false}
                  onChange={(e) => setAssistantVerbose(e.target.checked)}
                />
                <span className="space-y-0.5">
                  <span className="block text-xs text-muted-foreground">
                    {t('assistant.verboseLabel')}
                  </span>
                  <span className="block text-[11px] text-muted-foreground/70">
                    {t('assistant.verboseHint')}
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          <div
            className="max-h-72 min-w-0 space-y-2 overflow-y-auto"
            data-testid="text-styler-assistant-messages"
          >
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div
                  key={`u-${i}`}
                  className="ml-auto max-w-[85%] rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm whitespace-pre-wrap"
                >
                  {m.content}
                </div>
              ) : (
                <div key={`a-${i}`} className="space-y-1.5">
                  {stripStyledFences(m.content) && (
                    <ChatMarkdown
                      content={stripStyledFences(m.content)}
                      className="mr-auto max-w-[85%] rounded-lg bg-muted px-2.5 py-1.5"
                    />
                  )}
                  {parseStyledProposals(m.content).map((p, bi) => {
                    const key = `${i}:${bi}`;
                    const state = resolved[key];
                    if (state) {
                      return (
                        <div
                          key={`p-${bi}`}
                          data-testid="text-styler-proposal-resolved"
                          data-state={state}
                          className={cn(
                            'max-w-[85%] truncate text-xs',
                            // Discarded is a fainter NEUTRAL, not a destructive
                            // tint: dismissing a suggestion is an ordinary
                            // choice, not an error.
                            //
                            // /75, not lower: the collapsed line still has to be
                            // READABLE — it is how the user confirms which
                            // suggestion they just dismissed. Measured against
                            // the rendered themes, /45 gave 1.91:1 in light and
                            // 2.25:1 in dark (below even WCAG's 3:1 large-text
                            // floor); /75 gives 3.26:1 and 4.36:1 while staying
                            // well clear of applied's 5.52:1 / 7.11:1. The
                            // check + "Applied" label, not the tint alone, is
                            // what distinguishes the two states.
                            state === 'applied'
                              ? 'text-muted-foreground'
                              : 'text-muted-foreground/75',
                          )}
                        >
                          {state === 'applied' ? (
                            <>
                              <Check className="mr-1 inline size-3 align-[-1px]" />
                              <span className="font-medium">{t('assistant.applied')}</span>
                              {' · '}
                            </>
                          ) : null}
                          {p.text}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`p-${bi}`}
                        className="max-w-[85%] space-y-1 rounded-lg border border-border p-2 text-xs"
                        data-testid="text-styler-proposal-card"
                      >
                        <p className="whitespace-pre-wrap break-words text-muted-foreground">
                          {p.text}
                        </p>
                        {p.why ? (
                          <p
                            className="text-muted-foreground/80 italic"
                            data-testid="text-styler-proposal-why"
                          >
                            {t('assistant.proposalWhy')} {p.why}
                          </p>
                        ) : null}
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            data-testid="text-styler-apply-suggestion"
                            onClick={() => {
                              onApplySuggestion(p.text);
                              setResolved((r) => ({ ...r, [key]: 'applied' }));
                            }}
                          >
                            {t('assistant.apply')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            data-testid="text-styler-discard-suggestion"
                            onClick={() => setResolved((r) => ({ ...r, [key]: 'discarded' }))}
                          >
                            {t('assistant.discard')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ),
            )}
            {awaitingFirstToken && <ThinkingIndicatorHost />}
          </div>

          {showConfigHint ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="text-styler-assistant-config-hint"
            >
              {t('assistant.configHint')}{' '}
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                data-testid="text-styler-assistant-open-settings"
                onClick={() => setSettingsOpen(true)}
              >
                {t('assistant.openSettings')}
              </button>
            </p>
          ) : null}

          {error ? (
            <p className="text-xs text-destructive" data-testid="text-styler-assistant-error">
              {error}
            </p>
          ) : null}

          <div className="flex items-end gap-1.5">
            <Textarea
              className="min-h-9"
              rows={2}
              data-testid="text-styler-assistant-input"
              placeholder={t('assistant.placeholder')}
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
                variant="outline"
                size="icon"
                aria-label={t('assistant.stop')}
                data-testid="text-styler-assistant-stop"
                onClick={stop}
              >
                <Square />
              </Button>
            ) : null}
            <Button
              size="icon"
              aria-label={t('assistant.send')}
              data-testid="text-styler-assistant-send"
              disabled={!canSend}
              onClick={handleSend}
            >
              <Send />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
