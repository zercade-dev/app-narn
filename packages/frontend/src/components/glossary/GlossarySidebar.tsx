/**
 * Glossary tab sidebar: the glossary list plus the create / rename / delete /
 * generate affordances. Split out of GlossaryTab.tsx as a presentational panel.
 *
 * The create + rename flows are driven by state used EXCLUSIVELY here
 * (`newGlossaryName`, `creatingGlossary`, `renamingGlossaryId`, `renameDraft`),
 * so that state — and its two mutation handlers — live locally. Everything
 * shared with the rest of the tab (the selected id, the delete-confirm prompt,
 * the generate dialog, the glossary-list reload) is prop-drilled from the parent
 * so no cross-panel timing changes.
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Plus, Pencil, Trash2, Check, X, Sparkles } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { Glossary, GlossarySummary } from '@zercade-dev/narn-shared';
import { apiRequest } from '../../hooks/use-api.js';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface GlossarySidebarProps {
  readonly projectId: string;
  readonly sortedGlossaries: GlossarySummary[];
  readonly selectedGlossaryId: string | null;
  readonly onSelectGlossary: (id: string) => void;
  readonly onRequestDeleteGlossary: (id: string) => void;
  readonly onGenerate: () => void;
  readonly loadGlossaries: () => Promise<void>;
  readonly reportError: (err: unknown, fallbackKey: string) => void;
  /**
   * Both creation paths are 'manage'-only server-side — `POST /glossaries`
   * asserts manage access, and AI generation does too (its dialog is already
   * hidden outright for collaborators in GlossaryTab.tsx) — so both triggers
   * are hidden rather than left as dead clicks that 403 or open nothing.
   */
  readonly isCollaborator: boolean;
}

export function GlossarySidebar({
  projectId,
  sortedGlossaries,
  selectedGlossaryId,
  onSelectGlossary,
  onRequestDeleteGlossary,
  onGenerate,
  loadGlossaries,
  reportError,
  isCollaborator,
}: Readonly<GlossarySidebarProps>) {
  const { t } = useTranslation('glossary');
  const [newGlossaryName, setNewGlossaryName] = useState('');
  const [creatingGlossary, setCreatingGlossary] = useState(false);
  const [renamingGlossaryId, setRenamingGlossaryId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const handleCreateGlossary = useCallback(async () => {
    const name = newGlossaryName.trim();
    if (!name) return;
    try {
      await apiRequest<Glossary>(`/projects/${projectId}/glossaries`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setNewGlossaryName('');
      setCreatingGlossary(false);
      await loadGlossaries();
      toast.success(t('toastGlossaryCreated'));
    } catch (err) {
      reportError(err, 'toastGlossaryCreateError');
    }
  }, [newGlossaryName, projectId, loadGlossaries, reportError, t]);

  const handleRenameGlossary = useCallback(async () => {
    if (!renamingGlossaryId || !renameDraft.trim()) return;
    try {
      await apiRequest<Glossary>(`/projects/${projectId}/glossaries/${renamingGlossaryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameDraft.trim() }),
      });
      setRenamingGlossaryId(null);
      setRenameDraft('');
      await loadGlossaries();
      toast.success(t('toastGlossaryRenamed'));
    } catch (err) {
      reportError(err, 'toastGlossaryRenameError');
    }
  }, [renamingGlossaryId, renameDraft, projectId, loadGlossaries, reportError, t]);

  return (
    <div className="w-52 shrink-0 flex flex-col gap-2">
      <div className="mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t('glossaries')}
        </span>
      </div>

      {/* Creating a glossary by hand and generating them with AI are both
          project-wide actions — available regardless of which (if any) glossary
          is selected, so both live at the top of the sidebar. Both are
          'manage'-only server-side (POST /glossaries and the generate run alike),
          so both are hidden for collaborators rather than left as dead clicks.

          Manual creation is the PRIMARY button and comes first: it is the plain,
          always-available path, while generation depends on a configured AI
          module. The manual affordance used to be an unlabelled 24px icon button
          tucked in the header row above, which read as no button at all next to
          the labelled generate button. */}
      {!isCollaborator && (
        <>
          <Button
            className="w-full justify-start"
            onClick={() => setCreatingGlossary(true)}
            data-testid="glossary-new-btn"
            title={t('newGlossary')}
          >
            <Plus className="w-3.5 h-3.5 mr-1 shrink-0" />
            <span className="min-w-0 truncate">{t('newGlossary')}</span>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onGenerate}
            data-testid="glossary-generate-btn"
            title={t('generateGlossariesBtn')}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 shrink-0" />
            <span className="min-w-0 truncate">{t('generateGlossariesBtn')}</span>
          </Button>
        </>
      )}

      {creatingGlossary && (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={newGlossaryName}
            onChange={(e) => setNewGlossaryName(e.target.value)}
            placeholder={t('glossaryNamePlaceholder')}
            className="h-7 text-xs"
            data-testid="glossary-name-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateGlossary();
              if (e.key === 'Escape') {
                setCreatingGlossary(false);
                setNewGlossaryName('');
              }
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={handleCreateGlossary}
          >
            <Check className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => {
              setCreatingGlossary(false);
              setNewGlossaryName('');
            }}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {sortedGlossaries.map((summary) => {
          const isSelected = summary.id === selectedGlossaryId;
          const isRenaming = renamingGlossaryId === summary.id;
          const selectGlossary = () => {
            if (!isRenaming) onSelectGlossary(summary.id);
          };
          return (
            <div
              key={summary.id}
              className={cn(
                'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm',
                isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent',
                summary.enabled === false && 'opacity-60',
              )}
              data-testid={`glossary-item-${summary.id}`}
            >
              {isRenaming ? (
                <div className="flex items-center gap-1 w-full">
                  <Input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    className="h-6 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRenameGlossary();
                      if (e.key === 'Escape') {
                        setRenamingGlossaryId(null);
                        setRenameDraft('');
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={handleRenameGlossary}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex flex-1 min-w-0 items-center gap-1 text-left cursor-pointer bg-transparent border-0 p-0"
                    onClick={selectGlossary}
                    aria-pressed={isSelected}
                  >
                    <span className="flex-1 truncate" title={summary.name}>
                      {summary.name}
                    </span>
                    {summary.readOnly && (
                      <span title={t('readOnly')}>
                        <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                      </span>
                    )}
                    {summary.enabled === false && (
                      <span
                        className="shrink-0 rounded border border-border px-1 text-[10px] uppercase tracking-wide text-muted-foreground"
                        title={t('disabled')}
                      >
                        {t('disabled')}
                      </span>
                    )}
                    <span className="ml-auto text-right font-mono text-[11px] text-muted-foreground shrink-0">
                      {summary.termCount}
                    </span>
                  </button>
                  {!summary.readOnly && isSelected && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => {
                          setRenamingGlossaryId(summary.id);
                          setRenameDraft(summary.name);
                        }}
                        data-testid="glossary-rename-btn"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={() => onRequestDeleteGlossary(summary.id)}
                        data-testid="glossary-delete-btn"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
