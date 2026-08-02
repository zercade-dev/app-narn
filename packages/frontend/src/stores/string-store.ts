import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StringEntry, TranslationRecord } from '@zercade-dev/narn-shared';
import { apiRequest } from '../hooks/use-api.js';
import { filterEntries, type EntryFilters } from '../lib/filter-entries.js';
import { runAction } from './store-helpers.js';

type StringFilters = EntryFilters;

// Mirrors the server's bulkUpdateSchema `ids` cap (strings.ts) — kept in sync
// manually since the schema lives in the server package.
const BULK_UPDATE_CHUNK_SIZE = 1000;

/**
 * Patch type accepted by bulkUpdate. Mirrors the server's deep-merge
 * behaviour: per-language translation records may be partial so callers can
 * flip flags (e.g. needsReview) without re-supplying every field.
 */
export type StringEntryBulkPatch = Partial<Omit<StringEntry, 'translations'>> & {
  translations?: Record<string, Partial<TranslationRecord>>;
};

interface StringStoreState {
  entries: StringEntry[];
  filters: StringFilters;
  loading: boolean;
  error: string | null;
  /** The project ID whose entries are currently in the store. */
  loadedProjectId: string | null;

  fetchEntries: (projectId: string) => Promise<void>;
  fetchEntry: (projectId: string, id: string) => Promise<void>;
  updateEntry: (projectId: string, id: string, partial: Partial<StringEntry>) => Promise<void>;
  deleteEntry: (projectId: string, id: string) => Promise<void>;
  bulkUpdate: (projectId: string, ids: string[], partial: StringEntryBulkPatch) => Promise<void>;
  setFilter: (patch: Partial<StringFilters>) => void;
  getFilteredEntries: () => StringEntry[];
}

/**
 * Monotonic request token for {@link StringStoreState.fetchEntries}. Captured
 * before the await and re-checked after it resolves: a fetch superseded by a
 * newer one (e.g. after a project switch) is stale, so its entries are dropped
 * rather than committed with the wrong `loadedProjectId` — which would otherwise
 * leave StringTable/ComparisonTab stuck on a permanent loading spinner.
 */
let entriesFetchToken = 0;

/** The store's initial filter set — also the reset base for drill-downs. */
export const DEFAULT_STRING_FILTERS: EntryFilters = {
  search: '',
  // Default to true so new projects show only untranslated entries — the most actionable view.
  untranslatedOnly: true,
  overflowOnly: false,
  tooLong: false,
  lqaFailed: false,
  needsReview: false,
  sameAsSource: false,
  placeholderMismatch: false,
  flaggedNewOnly: false,
  activeLanguages: [],
  sources: [],
  categories: [],
  glossaryIds: [],
  tones: [],
  visibleLanguages: [],
  runId: '',
  orderMode: 'import',
  filterMode: 'AND',
};

export const useStringStore = create<StringStoreState>()(
  persist(
    (set, get) => ({
      entries: [],
      filters: { ...DEFAULT_STRING_FILTERS },
      loading: false,
      error: null,
      loadedProjectId: null,

      fetchEntries: async (projectId) => {
        // Capture a token before the await; a newer fetch (or a project switch)
        // bumps it, marking a late resolve here as stale so it never commits the
        // wrong project's entries or a stale `loadedProjectId`.
        const token = ++entriesFetchToken;
        await runAction<StringStoreState, void>(
          set,
          async () => {
            const entries = await apiRequest<StringEntry[]>(`/projects/${projectId}/strings`);
            // Stale response guard: only commit when this is still the latest fetch.
            if (token !== entriesFetchToken) return;
            set({ entries, loadedProjectId: projectId });
          },
          { loading: true },
        );
      },

      fetchEntry: async (projectId, id) => {
        const entry = await apiRequest<StringEntry>(`/projects/${projectId}/strings/${id}`);
        set((s) => ({
          entries: s.entries.map((e) => (e.id === id ? entry : e)),
        }));
      },

      updateEntry: async (projectId, id, partial) => {
        const updated = await apiRequest<StringEntry>(`/projects/${projectId}/strings/${id}`, {
          method: 'PUT',
          body: JSON.stringify(partial),
        });
        set((s) => ({
          entries: s.entries.map((e) => (e.id === id ? updated : e)),
        }));
      },

      deleteEntry: async (projectId, id) => {
        await apiRequest(`/projects/${projectId}/strings/${id}`, { method: 'DELETE' });
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
      },

      bulkUpdate: async (projectId, ids, partial) => {
        // The server caps `ids` at 1000 per request (bulkUpdateSchema) — chunk
        // larger selections (e.g. "clear new flags" across a big CSV import)
        // into sequential PATCH requests rather than sending one oversized body
        // the server would reject outright.
        const updated: StringEntry[] = [];
        for (let i = 0; i < ids.length; i += BULK_UPDATE_CHUNK_SIZE) {
          const chunk = ids.slice(i, i + BULK_UPDATE_CHUNK_SIZE);
          updated.push(
            ...(await apiRequest<StringEntry[]>(`/projects/${projectId}/strings`, {
              method: 'PATCH',
              body: JSON.stringify({ ids: chunk, partial }),
            })),
          );
        }
        const updatedMap = new Map(updated.map((e) => [e.id, e]));
        // Surface a partially-applied bulk op: any requested id the server didn't
        // echo back keeps its stale local row (via the `?? e` fallback below), so
        // a silent mismatch would otherwise leave the table out of sync with the
        // server without any signal. Warn so it's diagnosable.
        const missing = ids.filter((id) => !updatedMap.has(id));
        if (missing.length > 0) {
          console.warn(
            `bulkUpdate: server did not return ${missing.length} of ${ids.length} requested entr${
              missing.length === 1 ? 'y' : 'ies'
            }; their local rows are left unchanged`,
            missing,
          );
        }
        set((s) => ({
          entries: s.entries.map((e) => updatedMap.get(e.id) ?? e),
        }));
      },

      setFilter: (patch) => {
        set((s) => ({ filters: { ...s.filters, ...patch } }));
      },

      getFilteredEntries: () => {
        const { entries, filters } = get();
        return filterEntries(entries, filters);
      },
    }),
    {
      name: 'translator-string-filters',
      // Persist every filter key (including any added later to EntryFilters)
      // except the two intentionally reset on reload, rather than hand-listing
      // each persisted key — which silently drops new keys until someone
      // remembers to extend this object.
      partialize: (s) => ({
        filters: {
          ...s.filters,
          // activeLanguages is synced from the active project, never persisted.
          activeLanguages: [],
          // runId is a transient, project-scoped filter — never persist a stale
          // run id that would hide every entry after a reload.
          runId: '',
        },
      }),
      // zustand's default merge is a SHALLOW `{ ...currentState, ...persistedState }`.
      // Since `filters` is itself a single persisted key, that would wholesale-replace
      // the fresh `filters` object with whatever was saved — so a blob written before
      // some EntryFilters field existed (e.g. `glossaryIds`) rehydrates with that field
      // simply absent (`undefined`, not `[]`), and unguarded reads like
      // `filters.glossaryIds.length` in StringTableFilters.tsx throw on first render.
      // Merge `filters` one level deeper so any key missing from an older persisted
      // blob falls back to its fresh default instead of disappearing.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<StringStoreState> | undefined;
        return {
          ...currentState,
          ...persisted,
          filters: { ...currentState.filters, ...persisted?.filters },
        };
      },
    },
  ),
);
