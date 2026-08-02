import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveNicknames } from '../lib/collab-api.js';

/**
 * Shared "who did this" nickname resolution + display-label logic,
 * extracted from `RunsTab`'s original "Triggered by" column implementation
 * so it can be reused by any owner+sharedEver-gated attribution column —
 * currently `RunsTab`'s "Triggered by" column and `ManualEditsView`'s
 * "Edited by" column.
 *
 * Bulk-resolves creator ids (excluding self and ids already attempted) via
 * ONE `resolveNicknames` call per newly-seen id set — not per row, and not
 * re-fetched on every caller re-render (`attemptedIdsRef` remembers ids
 * already asked for; only a SUCCESSFUL resolve marks its ids attempted, so a
 * failed request retries on a later change instead of leaving that creator
 * stuck on the fallback forever). A persistent failure is bounded to at most
 * one retry per minute (`backoffUntilRef`) so a caller whose `ids` array gets
 * a new reference on every poll/refresh tick doesn't storm the endpoint.
 *
 * `enabled=false` short-circuits entirely — the effect never fires and
 * `labelFor` never resolves a nickname (still returns the you/em-dash
 * fallbacks), matching each caller's own visibility gate
 * (`showTriggeredBy` / `showEditedBy`).
 *
 * Uses the `strings` namespace with explicit `collab:activity.*` key
 * prefixes (matching the original inline implementation exactly) rather than
 * `useTranslation('collab')`, so callers that already default to `strings`
 * (like `RunsTab`) don't need a second `useTranslation` call, and the
 * resolved text stays byte-identical regardless of which namespace a future
 * caller happens to default to.
 */
export function useNicknameLabels(
  ids: ReadonlyArray<string | undefined>,
  enabled: boolean,
  selfUserId: string | null,
): { labelFor: (id: string | undefined) => string } {
  const { t } = useTranslation('strings');
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const attemptedIdsRef = useRef<Set<string>>(new Set());
  const backoffUntilRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (Date.now() < backoffUntilRef.current) return;
    const newIds = new Set<string>();
    for (const id of ids) {
      if (id && id !== selfUserId && !attemptedIdsRef.current.has(id)) {
        newIds.add(id);
      }
    }
    if (newIds.size === 0) return;
    const idList = [...newIds];
    resolveNicknames(idList)
      .then((resolved) => {
        idList.forEach((id) => attemptedIdsRef.current.add(id));
        setNicknames((prev) => ({ ...prev, ...resolved }));
      })
      .catch(() => {
        backoffUntilRef.current = Date.now() + 60_000;
      });
  }, [ids, enabled, selfUserId]);

  const labelFor = useCallback(
    (id: string | undefined): string => {
      if (id === selfUserId) return t('collab:activity.you');
      if (!id) return '—';
      const nickname = nicknames[id];
      return nickname ? `@${nickname}` : t('collab:activity.formerMember');
    },
    [selfUserId, nicknames, t],
  );

  return { labelFor };
}
