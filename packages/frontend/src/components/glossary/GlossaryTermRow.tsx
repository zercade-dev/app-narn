import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { TableCell, TableRow } from '../ui/table';
import { termRowPropsEqual, type GlossaryTermRowProps } from './glossary-tab-types.js';

// Exported (only) so tests can assert the memoization directly.
export const GlossaryTermRow = memo(function GlossaryTermRow({
  term,
  activeLanguages,
  isReadOnly,
  isCollaborator,
  writableLanguages,
  isSelected,
  editingId,
  editDraft,
  onToggleSelected,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditDraftChange,
  onRequestDelete,
}: Readonly<GlossaryTermRowProps>) {
  const { t } = useTranslation('glossary');
  const isEditing = editingId === term.id;

  if (isEditing && editDraft && !isReadOnly) {
    // Collaborators may only edit translations for languages they can write
    // (mirrors the server's `assertGlossaryTermEditAllowed`): source/notes/
    // constant are always non-translation fields, so disable them outright;
    // each per-language translation input is disabled individually against
    // `writableLanguages`. `disabled` (not `readOnly`) so the Input's own
    // disabled styling supplies the visual cue too.
    return (
      <TableRow className="group">
        {!isReadOnly && <TableCell />}
        <TableCell>
          <Input
            value={editDraft.source}
            onChange={(e) => onEditDraftChange({ ...editDraft, source: e.target.value })}
            disabled={isCollaborator}
            data-testid="glossary-edit-source"
            data-content
          />
        </TableCell>
        {activeLanguages.map((lang) => (
          <TableCell key={lang}>
            <Input
              value={editDraft.translations[lang] ?? ''}
              onChange={(e) =>
                onEditDraftChange({
                  ...editDraft,
                  translations: { ...editDraft.translations, [lang]: e.target.value },
                })
              }
              disabled={isCollaborator && !writableLanguages.includes(lang)}
              data-testid={`glossary-edit-translation-${lang}`}
              data-content
            />
          </TableCell>
        ))}
        <TableCell>
          <Checkbox
            checked={editDraft.constant ?? false}
            onCheckedChange={(checked) =>
              onEditDraftChange({ ...editDraft, constant: checked === true })
            }
            disabled={isCollaborator}
            data-testid="glossary-edit-constant"
          />
        </TableCell>
        <TableCell>
          <Input
            value={editDraft.notes ?? ''}
            onChange={(e) => onEditDraftChange({ ...editDraft, notes: e.target.value })}
            disabled={isCollaborator}
            data-testid="glossary-edit-notes"
            data-content
          />
        </TableCell>
        <TableCell className="sticky right-0 z-10 w-32 bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted">
          <div className="flex gap-1">
            <Button size="sm" onClick={onSaveEdit} data-testid="glossary-save-edit-btn">
              {t('save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="glossary-cancel-edit-btn"
              onClick={onCancelEdit}
            >
              {t('cancel')}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="group">
      {!isReadOnly && (
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onToggleSelected(term.id, checked === true)}
            data-testid="glossary-row-select"
            aria-label={t('selectRow')}
          />
        </TableCell>
      )}
      <TableCell className="font-medium">{term.source}</TableCell>
      {activeLanguages.map((lang) => (
        <TableCell key={lang}>{term.translations[lang] ?? ''}</TableCell>
      ))}
      <TableCell>
        {term.constant ? (
          <Check
            className="h-4 w-4 text-primary"
            data-testid="glossary-row-constant-icon"
            aria-label="constant"
          />
        ) : null}
      </TableCell>
      {!isReadOnly && <TableCell>{term.notes ?? ''}</TableCell>}
      {!isReadOnly && (
        <TableCell className="sticky right-0 z-10 w-32 bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStartEdit(term)}
              data-testid="glossary-term-edit-btn"
              data-row-action
            >
              {t('edit')}
            </Button>
            {/* Deleting a term is a 'manage' capability — collaborators never
                hold it server-side, so hidden here (rather than only at the
                confirm dialog) so a collaborator never sees a delete
                affordance that would 403. */}
            {!isCollaborator && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onRequestDelete(term.id)}
                data-testid="glossary-term-delete-btn"
                data-row-action
              >
                {t('delete')}
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}, termRowPropsEqual);
