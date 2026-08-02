/**
 * TranslationMemoryPanel — minimal browser for the global translation memory.
 * Groups stored variants under their shared (masked) source text and allows
 * deleting individual variants.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Trash2, X } from 'lucide-react';
import type { TmSegment } from '@zercade-dev/narn-shared';
import { apiRequest } from '../../hooks/use-api.js';
import { useAsyncData } from '../../hooks/use-async-data.js';
import { getErrorMessage } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * A single source-text group: a (clampable) source header followed by its
 * per-language translation variants laid out as aligned columns. Long source
 * strings are clamped to three lines with an inline show-more/less toggle so a
 * paragraph-length source doesn't swamp the list.
 */
function TmSourceGroup({
  sourceMasked,
  group,
  onDelete,
}: Readonly<{
  sourceMasked: string;
  group: TmSegment[];
  onDelete: (key: string, variantId: string) => void;
}>) {
  const { t } = useTranslation('config');
  const [expanded, setExpanded] = useState(false);
  // Only offer the toggle for sources long enough to plausibly clamp.
  const isLong = sourceMasked.length > 160;

  return (
    <div className="space-y-2 rounded-md border border-border p-3" data-testid="tm-source-group">
      <div className="space-y-1">
        <p
          className={`break-words text-sm font-medium leading-relaxed ${
            isLong && !expanded ? 'line-clamp-3' : ''
          }`}
          title={sourceMasked}
        >
          {sourceMasked}
        </p>
        {isLong && (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setExpanded((v) => !v)}
            data-testid="tm-source-toggle"
          >
            {expanded ? t('tm.showLess') : t('tm.showMore')}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {group.flatMap((segment) =>
          segment.variants.map((variant) => (
            <div
              key={variant.id}
              className="flex items-center gap-3 text-sm sm:grid sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-start"
              data-testid="tm-variant-row"
            >
              <Badge
                variant="outline"
                className="w-fit shrink-0 font-mono text-xs uppercase tracking-wide"
              >
                {segment.targetLanguage}
              </Badge>
              <span className="min-w-0 flex-1 break-words leading-relaxed sm:pt-0.5">
                {variant.translatedText}
              </span>
              <div className="flex shrink-0 items-center justify-end gap-3 sm:pt-0.5">
                {variant.lqaPassed ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-status-pass"
                    title={t('tm.lqaPassedBadge')}
                    data-testid="tm-variant-lqa-passed"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-status-fail/30 bg-status-fail/10 text-status-fail"
                    data-testid="tm-variant-lqa-failed"
                  >
                    <X className="mr-1 size-3" aria-hidden="true" />
                    {t('tm.lqaFailedBadge')}
                  </Badge>
                )}
                <span className="w-20 truncate text-right font-mono text-[11px] text-muted-foreground">
                  {variant.moduleId}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(variant.timestamp).toLocaleDateString()}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground/70 hover:bg-status-fail/10 hover:text-status-fail"
                  aria-label={t('tm.deleteVariant')}
                  onClick={() => onDelete(segment.key, variant.id)}
                  data-testid="tm-delete-variant"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}

export function TranslationMemoryPanel() {
  const { t } = useTranslation('config');
  const [search, setSearch] = useState('');
  // Two-step inline confirm for the destructive "clear all" action.
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Mount-fetch the stored segments; `reload()` re-runs after a destructive
  // edit. `t` is a dep so a language switch re-fetches (matching the old effect).
  const {
    data: segments,
    loading,
    reload,
  } = useAsyncData<TmSegment[]>(
    () => apiRequest<{ segments: TmSegment[] }>('/tm/segments').then((res) => res.segments),
    [t],
    {
      initial: [],
      onError: (err) => toast.error(t('tm.loadFailed', { message: getErrorMessage(err) })),
    },
  );

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const { cleared } = await apiRequest<{ cleared: number }>('/tm/segments', {
        method: 'DELETE',
      });
      if (cleared > 0) toast.success(t('tm.clearAllSuccess', { count: cleared }));
      else toast.info(t('tm.clearAllEmpty'));
      setConfirmingClear(false);
      reload();
    } catch (err) {
      toast.error(t('tm.clearFailed', { message: getErrorMessage(err) }));
    } finally {
      setClearing(false);
    }
  };

  const handleDelete = async (key: string, variantId: string) => {
    try {
      await apiRequest(`/tm/segments/${encodeURIComponent(key)}/variants/${variantId}`, {
        method: 'DELETE',
      });
      reload();
    } catch (err) {
      toast.error(t('tm.deleteFailed', { message: getErrorMessage(err) }));
    }
  };

  // Show the loading placeholder only on the first load (no rows yet); a
  // post-edit `reload()` re-raises `loading` but keeps existing rows until the
  // refetch lands — no flicker, matching the old effect (which never re-raised
  // loading on reload). Keep gating render on this, not bare `loading`.
  const initialLoading = loading && segments.length === 0;

  // Free-text filter over source text, target language, translated text and
  // module id (case-insensitive). Applied client-side over the loaded segments.
  const needle = search.trim().toLowerCase();
  const visibleSegments = needle
    ? segments.filter(
        (s) =>
          s.sourceMasked.toLowerCase().includes(needle) ||
          s.targetLanguage.toLowerCase().includes(needle) ||
          s.variants.some(
            (v) =>
              v.translatedText.toLowerCase().includes(needle) ||
              v.moduleId.toLowerCase().includes(needle),
          ),
      )
    : segments;

  // Group segments (one per source+language) under their shared source text.
  const bySource = new Map<string, TmSegment[]>();
  for (const segment of visibleSegments) {
    const group = bySource.get(segment.sourceMasked);
    if (group) group.push(segment);
    else bySource.set(segment.sourceMasked, [segment]);
  }

  return (
    <Card data-testid="tm-browser">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>{t('tm.browserTitle')}</CardTitle>
            <CardDescription>{t('tm.browserDescription')}</CardDescription>
          </div>
          {!confirmingClear ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-status-fail hover:bg-status-fail/10 hover:text-status-fail"
              disabled={segments.length === 0}
              onClick={() => setConfirmingClear(true)}
              data-testid="tm-clear-all"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              {t('tm.clearAll')}
            </Button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                disabled={clearing}
                onClick={() => setConfirmingClear(false)}
                data-testid="tm-clear-all-cancel"
              >
                {t('tm.clearAllCancel')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-status-fail hover:bg-status-fail/10 hover:text-status-fail"
                disabled={clearing}
                onClick={() => void handleClearAll()}
                data-testid="tm-clear-all-confirm"
              >
                <Trash2 className="size-3.5 mr-1.5" />
                {t('tm.clearAllConfirm')}
              </Button>
            </div>
          )}
        </div>
        {confirmingClear && (
          <p className="text-xs text-status-fail" data-testid="tm-clear-all-hint">
            {t('tm.clearAllHint')}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!initialLoading && segments.length > 0 && (
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('tm.searchPlaceholder')}
            className="mb-4 h-9"
            data-testid="tm-search"
            aria-label={t('tm.searchPlaceholder')}
          />
        )}
        {initialLoading ? (
          <p className="text-sm text-muted-foreground">{t('tm.browserLoading')}</p>
        ) : bySource.size === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="tm-browser-empty">
            {needle ? t('tm.searchEmpty') : t('tm.browserEmpty')}
          </p>
        ) : (
          <div className="space-y-4">
            {Array.from(bySource.entries()).map(([sourceMasked, group]) => (
              <TmSourceGroup
                key={group[0].sourceHash}
                sourceMasked={sourceMasked}
                group={group}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
