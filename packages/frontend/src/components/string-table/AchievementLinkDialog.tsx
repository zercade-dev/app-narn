/**
 * Achievement pairing picker. Replaces the old one-shot "Link with …" chip:
 * that chip guessed a single counterpart by sortIndex distance and vanished
 * once an entry was linked, so re-linking or joining an existing group was
 * impossible.
 *
 * Only this dialog subscribes to the full entry list, and only while open —
 * the row's Link button does not, so achievement rows no longer re-render on
 * every unrelated entry-store write.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StringEntry } from '@zercade-dev/narn-shared';
import { cn, getErrorMessage } from '@/lib/utils';
import { toast } from '@/lib/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { linkCandidates, resolveLink } from '@/lib/achievement-link.js';
import { useStringStore } from '../../stores/string-store.js';

export interface AchievementLinkDialogProps {
  entry: StringEntry;
  activeProjectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AchievementLinkDialog({
  entry,
  activeProjectId,
  open,
  onOpenChange,
}: Readonly<AchievementLinkDialogProps>): React.JSX.Element {
  const { t } = useTranslation('strings');
  const allEntries = useStringStore((s) => s.entries);
  const updateEntry = useStringStore((s) => s.updateEntry);
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => linkCandidates(entry, allEntries), [entry, allEntries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.sourceText.toLowerCase().includes(q) || (c.achievementId ?? '').toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const handlePick = async (candidate: StringEntry) => {
    if (!activeProjectId) return;
    try {
      // Sequential, not Promise.all: both PATCHes hit the same project's write
      // lock, so running them concurrently would just contend on it. This is
      // not transactional — if the first write succeeds and the second fails,
      // one side is left keyed and the other isn't; the catch below surfaces
      // that failure so the user can retry, and re-linking is idempotent for
      // the side that already got the key.
      for (const { entryId, patch } of resolveLink(entry, candidate)) {
        await updateEntry(activeProjectId, entryId, patch);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(t('achievement.linkFailed', { message: getErrorMessage(err) }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="achievement-link-dialog">
        <DialogHeader>
          <DialogTitle>{t('achievement.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('achievement.dialogSubtitle', { text: entry.sourceText })}
          </DialogDescription>
        </DialogHeader>

        <input
          type="text"
          data-slot="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('achievement.dialogSearch')}
          aria-label={t('achievement.dialogSearch')}
          className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="achievement-link-search"
        />

        <div className="max-h-80 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t('achievement.dialogEmpty')}</p>
          ) : (
            visible.map((candidate) => {
              const muted = Boolean(candidate.achievementId) || !candidate.achievementType;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => void handlePick(candidate)}
                  data-testid={`achievement-link-option-${candidate.id}`}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent cursor-pointer',
                    muted && 'text-muted-foreground opacity-60',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate" title={candidate.sourceText}>
                    {candidate.sourceText}
                  </span>
                  <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px]">
                    {candidate.achievementType
                      ? t(`achievement.${candidate.achievementType}`)
                      : t('achievement.typeUnset')}
                  </span>
                  {candidate.achievementId && (
                    <span
                      className="shrink-0 font-mono text-[10px]"
                      title={t('achievement.alreadyLinked')}
                    >
                      {candidate.achievementId}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
