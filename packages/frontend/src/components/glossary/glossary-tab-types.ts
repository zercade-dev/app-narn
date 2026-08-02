/**
 * Shared types + pure helpers for the Glossary tab, extracted from GlossaryTab.tsx
 * so the tab component, its memoized row, and its presentational panels can share
 * them without a circular import. Pure — no React, no state, no side effects.
 */
import type { GlossaryTerm, StringEntry } from '@zercade-dev/narn-shared';

export type DraftTerm = {
  source: string;
  translations: Record<string, string>;
  notes?: string;
  constant?: boolean;
};

export function emptyDraft(languages: string[]): DraftTerm {
  return {
    source: '',
    translations: Object.fromEntries(languages.map((l) => [l, ''])),
    notes: '',
    constant: false,
  };
}

export type MatchResult = StringEntry;

export type ImportTermPreview = {
  source: string;
  translations: Record<string, string>;
  notes?: string;
  constant?: boolean;
};

export type ImportUpdatePreview = {
  termId: string;
  source: string;
  conflictLanguages: string[];
};

export type ImportDryRunResponse = {
  dryRun: true;
  diff: {
    added: ImportTermPreview[];
    updated: ImportUpdatePreview[];
    conflicts: ImportUpdatePreview[];
    unchanged: number;
  };
  unrecognizedHeaders: string[];
  skippedRows: number;
  repushRequired: boolean;
};

export type ImportApplyResponse = {
  applied: { added: number; updated: number; conflicts: number };
  unchanged: number;
  repushRequired: boolean;
};

// Cap the per-section term lists rendered in the import preview so very
// large imports don't render tens of thousands of DOM nodes.
export const IMPORT_PREVIEW_MAX_ITEMS = 50;

export type GlossaryTermRowProps = {
  term: GlossaryTerm;
  activeLanguages: string[];
  isReadOnly: boolean;
  /**
   * The current access is a collaborator (not the owner). Deleting a term
   * is a 'manage' capability collaborators never hold server-side, so the
   * row's Delete action is hidden for them; editing stays available but is
   * further scoped per-language by `writableLanguages` below (mirrors the
   * server's `assertGlossaryTermEditAllowed`).
   */
  isCollaborator: boolean;
  /** Languages the current access may WRITE (order-preserving; owners: all of `activeLanguages`). */
  writableLanguages: string[];
  isSelected: boolean;
  editingId: string | null;
  editDraft: DraftTerm | null;
  onToggleSelected: (id: string, checked: boolean) => void;
  onStartEdit: (term: GlossaryTerm) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditDraftChange: (next: DraftTerm) => void;
  onRequestDelete: (id: string) => void;
};

// Only the row actually being edited needs to react to `editDraft` (or the
// callbacks that read it) changing; every other row's rendered output is
// fully determined by `term`/`activeLanguages`/`isReadOnly`/`isCollaborator`/
// `writableLanguages`/`isSelected` plus whether IT is the one being edited.
// Skipping the editDraft/callback compare for non-editing rows is what keeps
// a keystroke in one row's edit inputs (or in the unrelated "add term" row,
// which isn't part of these props at all) from re-rendering every other row
// in a 1-2k-term glossary.
export function termRowPropsEqual(prev: GlossaryTermRowProps, next: GlossaryTermRowProps): boolean {
  if (prev.term !== next.term) return false;
  if (prev.activeLanguages !== next.activeLanguages) return false;
  if (prev.isReadOnly !== next.isReadOnly) return false;
  if (prev.isCollaborator !== next.isCollaborator) return false;
  if (prev.writableLanguages !== next.writableLanguages) return false;
  if (prev.isSelected !== next.isSelected) return false;
  const prevEditing = prev.editingId === prev.term.id;
  const nextEditing = next.editingId === next.term.id;
  if (prevEditing !== nextEditing) return false;
  if (nextEditing && prev.editDraft !== next.editDraft) return false;
  return true;
}
