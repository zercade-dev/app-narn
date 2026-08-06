/**
 * Streaming chat hook for the Text Styler assistant.
 *
 * `send(text)` appends a user turn, then POSTs the conversation to
 * `POST /api/color-text/chat` (same-origin, so the open-core CSRF guard — which
 * is origin/referer based — is satisfied without a token header) and reads the
 * `text/plain` response body chunk-by-chunk via `res.body.getReader()`, appending
 * each decoded delta LIVE to a single in-progress assistant turn.
 *
 * A 423 dispatches the SAME `vault:locked` event that `apiRequest` uses (via the
 * shared {@link vaultLockedEvent} helper) so the global unlock dialog opens and
 * replays the send; no bogus assistant message is appended. Aborts flow through
 * an `AbortController` kept in a ref — `stop()` aborts it and the partial reply is
 * kept as-is.
 *
 * Each chat *session* (from mount, or since the last `reset()`) is identified by
 * a `chatSessionId` (`crypto.randomUUID()`, held in a ref so it survives
 * re-renders without becoming a dependency of `runChat`). Every POST body
 * includes it so the server can upsert one growing `kind: 'chat'` run record
 * per session; `reset()` mints a fresh id so a cleared conversation starts a
 * new session server-side too. The body also includes `projectId` — the
 * styler is per-project — read fresh from the project store at send time so
 * a project switch mid-session can't record usage against the wrong
 * project; omitted when there is no active project (the server skips
 * recording rather than erroring).
 */
import { useCallback, useRef, useState } from 'react';
import { useColorTextStore } from '../stores/color-text-store.js';
import { useProjectStore } from '../stores/project-store.js';
import { vaultLockedEvent } from '../lib/vault-events.js';
import { toast } from '../lib/toast.js';

/** One conversation turn — mirrors the server's `ChatTurn` shape. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface UseColorTextChat {
  messages: ChatTurn[];
  streaming: boolean;
  awaitingFirstToken: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useColorTextChat(): UseColorTextChat {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Source of truth for the current conversation, read synchronously inside
  // `send`/streaming without waiting for a React re-render. `commit` keeps the
  // ref and the rendered state in lockstep.
  const messagesRef = useRef<ChatTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  // Latest-ref for the network runner so the 423 retry thunk can replay the
  // exact same conversation without re-appending the user turn, and without
  // making `runChat` depend on itself.
  const runChatRef = useRef<(convo: ChatTurn[]) => Promise<void>>(async () => {});
  // Identifies this chat session for server-side usage recording: stable
  // across every send within the session, replaced on `reset()`.
  const chatSessionIdRef = useRef<string>(crypto.randomUUID());

  const commit = useCallback((next: ChatTurn[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const runChat = useCallback(
    async (convo: ChatTurn[]): Promise<void> => {
      const { assistant, draftFor } = useColorTextStore.getState();
      const { instanceId, model, reasoningEffort, verbose } = assistant;
      if (!instanceId || !model) {
        setError('Select a Text Styler assistant instance and model first.');
        return;
      }
      // Read fresh at send time (not captured at hook-mount) so a project
      // switch mid-conversation records usage against the CURRENT project,
      // not a stale one. Omitted entirely when there is no active project —
      // the server skips recording rather than treating it as an error.
      const { activeProjectId } = useProjectStore.getState();
      // Store v2 keys drafts per project; mirror ColorTextView's
      // `activeProjectId ?? ''` keying so the chat always sees the same draft
      // the editor shows (the '' slot is the no-project standalone draft).
      const draft = draftFor(activeProjectId ?? '');

      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setAwaitingFirstToken(true);
      try {
        const res = await fetch('/api/color-text/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId,
            model,
            ...(reasoningEffort ? { reasoningEffort } : {}),
            draft,
            messages: convo,
            chatSessionId: chatSessionIdRef.current,
            ...(activeProjectId ? { projectId: activeProjectId } : {}),
            // Only sent when switched on, so a default-off client's body is
            // byte-identical to before the toggle existed.
            ...(verbose ? { verbose: true } : {}),
          }),
          signal: controller.signal,
        });

        // 423 → drive the shared vault-unlock flow exactly as `apiRequest` does:
        // dispatch `vault:locked` with a `retry` thunk that replays THIS send
        // after unlock. No assistant turn is appended.
        if (res.status === 423) {
          setAwaitingFirstToken(false);
          globalThis.dispatchEvent(vaultLockedEvent({ retry: () => runChatRef.current(convo) }));
          return;
        }

        if (!res.ok) {
          setAwaitingFirstToken(false);
          let message = `HTTP ${res.status}`;
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            // Non-JSON error body — keep the HTTP-status fallback.
          }
          // De-silence: a swallowed non-423 status is exactly why this failure
          // kept being reported with "no console log at all". Log it (in addition
          // to the inline error) so the browser console shows the real cause.
          console.error('[color-text chat] request failed', { status: res.status, message });
          setError(message);
          toast.error(message);
          return;
        }

        // Create the in-progress assistant turn up front, then mutate its content
        // as chunks stream in.
        commit([...messagesRef.current, { role: 'assistant', content: '' }]);
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setAwaitingFirstToken(false);
          accumulated += decoder.decode(value, { stream: true });
          const base = messagesRef.current;
          const next = base.slice();
          next[next.length - 1] = { role: 'assistant', content: accumulated };
          commit(next);
        }
      } catch (err) {
        // A `stop()`/unmount abort finalizes gracefully — the partial assistant
        // message is kept. Any other failure surfaces as an error.
        if ((err as { name?: string })?.name !== 'AbortError') {
          // De-silence: log the transport/stream failure to the console too, not
          // just the inline error (see the non-423 branch above).
          console.error('[color-text chat] stream error', err);
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          toast.error(message);
        }
      } finally {
        setStreaming(false);
        setAwaitingFirstToken(false);
        abortRef.current = null;
      }
    },
    [commit],
  );
  runChatRef.current = runChat;

  const send = useCallback(
    async (text: string): Promise<void> => {
      const convo: ChatTurn[] = [...messagesRef.current, { role: 'user', content: text }];
      commit(convo);
      await runChat(convo);
    },
    [commit, runChat],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    commit([]);
    setError(null);
    // A cleared conversation is a new session server-side too — mint a fresh
    // id so the next send starts a new `kind: 'chat'` run rather than
    // continuing to accumulate onto the old one.
    chatSessionIdRef.current = crypto.randomUUID();
  }, [commit]);

  return { messages, streaming, awaitingFirstToken, error, send, stop, reset };
}
