/**
 * ModelPicker — a popup table model selector shared by every model dropdown in
 * the app (the per-module model field, the Copilot picker, and the per-rule
 * model override in the batch routing editor).
 *
 * Replaces the old `<Select>` / combobox dropdowns: the trigger opens a dialog
 * containing a searchable, pricing-sortable table of discovered models. The
 * search box doubles as a free-text entry — anything typed can be committed as
 * a custom model id even when it isn't in the table, so providers that expose
 * no model list (or a model the user knows by name) stay fully usable.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Check,
  Info,
  Search,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { findConfidenceProfile, scoreModelConfidence } from '@zercade-dev/narn-shared';
import type {
  ModelInfo,
  ModelBilling,
  ModelConfidenceContext,
  ConfidenceResult,
  ConfidenceTier,
} from '@zercade-dev/narn-shared';
import type { FootprintMap, FootprintEntry } from '@/hooks/use-model-footprints';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buildModelLabel } from './CopilotModelSelector.js';

/** Columns the table can be sorted by. `name` sorts alphabetically; the rest by cost. */
type SortKey = 'name' | 'confidence' | 'input' | 'output' | 'cache';
type SortDir = 'asc' | 'desc';

/** A row offered before the model list — used for the "Default" choice in overrides. */
export interface ModelPickerSpecialOption {
  /** Value committed when the row is chosen. */
  value: string;
  /** Label rendered for the row. */
  label: string;
}

export interface ModelPickerProps {
  /** Field id; mirrored onto a hidden input so labels/forms/tests can read the value. */
  id: string;
  /** Currently selected model id (or a custom id, or a special-option value). */
  value: string;
  onValueChange: (value: string) => void;
  models: readonly ModelInfo[];
  disabled?: boolean;
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  /**
   * Optional leading row (e.g. "Default") rendered above the model list and
   * always visible regardless of the search filter.
   */
  specialOption?: ModelPickerSpecialOption;
  /** Test id for the trigger button. */
  triggerTestId?: string;
  /** Extra classes for the trigger button (defaults to a column-shrinkable `w-full min-w-0 max-w-64`). */
  triggerClassName?: string;
  /**
   * Render the hidden `<input id>` value mirror (default true). Set false when
   * the caller owns its own always-present hidden input (e.g. so the value is
   * readable while models are still loading and the picker isn't mounted yet).
   */
  withHiddenInput?: boolean;
  /**
   * Measured VRAM footprints keyed by model id. When `onInspectFootprints` is
   * provided the picker shows a trailing "VRAM" column and an inspect button;
   * this map fills that column (local/Ollama modules only).
   */
  footprints?: FootprintMap;
  /** Starts a footprint sweep. Presence enables the VRAM column + inspect button. */
  onInspectFootprints?: () => void;
  /** Id of the model currently being probed, for a per-row spinner. */
  inspecting?: string | null;
  /** Sweep progress, for the inspect button's label/state. */
  inspectProgress?: { done: number; total: number } | null;
  /**
   * Marks this as a local-LLM (free) table: hides the Input/Output pricing
   * columns and orders rows by size/footprint instead of cost. When omitted,
   * inferred from whether models report a disk size.
   */
  local?: boolean;
  /**
   * When set, a sortable Confidence column scores each profiled model for
   * this run context (task + entry count + prompt estimate + effort).
   * Models without a bundled profile show an em dash — never a guess.
   */
  confidenceContext?: ModelConfidenceContext;
  /** Lowercased ids to mark as "Recommended" — badged and floated to the top. */
  recommendedModelIds?: ReadonlySet<string>;
}

/** USD-per-million formatter, e.g. `$2.50`. Returns null for missing/non-finite input. */
function formatUsd(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return `$${value.toFixed(2)}`;
}

/** Relative multiplier formatter, e.g. `2×`. Returns null when absent. */
function formatMultiplier(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return `${value}×`;
}

/**
 * Compact token-count formatter for the context-window column, e.g.
 * `131072` → `128K`, `1048576` → `1M`. Falls back to the raw count for values
 * under 1K. Returns null for missing/non-finite input.
 */
function formatContextLength(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return null;
  if (value >= 1_000_000) return `${+(value / 1_048_576).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1024)}K`;
  return `${value}`;
}

/**
 * Disk-size formatter using base-1000 units (matching Ollama's own display),
 * e.g. `8540000000` → `8.5 GB`. Returns null for missing/non-finite input.
 */
function formatBytes(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return null;
  if (value >= 1e9) return `${+(value / 1e9).toFixed(1)} GB`;
  if (value >= 1e6) return `${Math.round(value / 1e6)} MB`;
  if (value >= 1e3) return `${Math.round(value / 1e3)} KB`;
  return `${value} B`;
}

/** A byte count for sorting, treating "unknown" as largest so it sinks last. */
function bytesOrInfinity(value: number | undefined): number {
  return value === undefined ? Number.POSITIVE_INFINITY : value;
}

/**
 * Ordering for the local-model table. Before anything is measured (`!hasFootprint`)
 * the list is sorted by disk size ascending. Once footprints exist, models are
 * ranked by GPU placement (higher % first; un-measured models sink below
 * measured ones), VRAM size ascending breaks ties, then disk size, then name.
 */
function compareLocalModels(
  a: ModelInfo,
  b: ModelInfo,
  footprints: FootprintMap | undefined,
  hasFootprint: boolean,
): number {
  if (hasFootprint) {
    // gpuPercent → null when un-measured/errored; rank those last via -1.
    const ga = gpuPercent(footprints?.[a.id]) ?? -1;
    const gb = gpuPercent(footprints?.[b.id]) ?? -1;
    if (ga !== gb) return gb - ga;
    const va = bytesOrInfinity(footprints?.[a.id]?.sizeVramBytes);
    const vb = bytesOrInfinity(footprints?.[b.id]?.sizeVramBytes);
    if (va !== vb) return va - vb;
  }
  const da = bytesOrInfinity(a.sizeBytes);
  const db = bytesOrInfinity(b.sizeBytes);
  if (da !== db) return da - db;
  return (a.name ?? a.id).localeCompare(b.name ?? b.id);
}

/**
 * Renders the trailing VRAM-footprint cell: a spinner while this model is being
 * probed, an alert (with the error in a tooltip) on a failed probe, the
 * measured VRAM size when known, or an em dash when not yet inspected.
 */
function FootprintCell({
  entry,
  loading,
}: Readonly<{ entry: FootprintEntry | undefined; loading: boolean }>) {
  if (loading) return <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
  if (!entry) return <span className="text-muted-foreground">—</span>;
  if (entry.error) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={<AlertTriangle className="ml-auto h-3.5 w-3.5 text-status-warn" />}
        />
        <TooltipContent className="max-w-xs">{entry.error}</TooltipContent>
      </Tooltip>
    );
  }
  const size = formatBytes(entry.sizeVramBytes ?? entry.sizeBytes);
  return size ? <>{size}</> : <span className="text-muted-foreground">—</span>;
}

/**
 * Fraction of a probed model that loaded into VRAM, as a 0–100 percentage
 * (`size_vram / size`). 100 means fully GPU-resident; less means part of the
 * model spilled to CPU (slow). Null when not measured or the probe failed.
 */
function gpuPercent(entry: FootprintEntry | undefined): number | null {
  if (!entry || entry.error) return null;
  const { sizeBytes, sizeVramBytes } = entry;
  if (sizeBytes === undefined || sizeVramBytes === undefined || sizeBytes <= 0) return null;
  return Math.round((sizeVramBytes / sizeBytes) * 100);
}

/**
 * Renders the trailing "Processor" cell reporting GPU placement: `100% GPU`
 * (fully resident) in muted text, or a partial figure (e.g. `55% GPU`) in amber
 * to flag CPU offload. A spinner while probing; an em dash when not measured.
 */
function ProcessorCell({
  entry,
  loading,
  label,
}: Readonly<{
  entry: FootprintEntry | undefined;
  loading: boolean;
  label: (pct: number) => string;
}>) {
  if (loading) return <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
  const pct = gpuPercent(entry);
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const text = label(pct);
  return pct >= 100 ? (
    <span className="text-muted-foreground">{text}</span>
  ) : (
    <span className="text-status-warn">{text}</span>
  );
}

/**
 * Sort cost for a column: prefers the absolute USD price, falling back to the
 * relative multiplier (Copilot SDK), then `Infinity` so unpriced models sort
 * last on an ascending sort. Within one picker all models share a provider, so
 * the units are consistent.
 */
function columnCost(billing: ModelBilling | undefined, key: SortKey): number {
  if (!billing) return Number.POSITIVE_INFINITY;
  if (key === 'input')
    return billing.inputCostPerMillion ?? billing.multiplier ?? Number.POSITIVE_INFINITY;
  if (key === 'output')
    return billing.outputCostPerMillion ?? billing.outputMultiplier ?? Number.POSITIVE_INFINITY;
  if (key === 'cache') return billing.cachedInputCostPerMillion ?? Number.POSITIVE_INFINITY;
  return Number.POSITIVE_INFINITY;
}

/**
 * Whether a model carries any usable pricing signal (absolute USD or a relative
 * multiplier, input or output). Models with none are hidden when the list has
 * priced models — but a fully unpriced list (e.g. local Ollama models, which
 * are free) stays fully visible.
 */
function hasPricing(billing: ModelBilling | undefined): boolean {
  if (!billing) return false;
  return (
    billing.inputCostPerMillion !== undefined ||
    billing.outputCostPerMillion !== undefined ||
    billing.multiplier !== undefined ||
    billing.outputMultiplier !== undefined
  );
}

/** Renders a price cell: absolute USD on top, multiplier below (whichever exist). */
function PriceCell({
  usd,
  multiplier,
}: Readonly<{ usd: number | undefined; multiplier?: number }>) {
  const price = formatUsd(usd);
  const mult = formatMultiplier(multiplier);
  if (!price && !mult) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-col leading-tight">
      {price && <span className="tabular-nums">{price}</span>}
      {mult && <span className="text-xs text-muted-foreground tabular-nums">{mult}</span>}
    </span>
  );
}

/**
 * Notable capability tags for a model: the string-array form some providers
 * report (e.g. Ollama's `/api/show`), minus the ubiquitous `completion` tag.
 * Defensive against other shapes — Copilot's `ModelInfo.capabilities` is an
 * object, not an array, so anything non-array yields no tags.
 */
function capabilityTags(capabilities: unknown): string[] {
  if (!Array.isArray(capabilities)) return [];
  return capabilities.filter((c): c is string => typeof c === 'string' && c !== 'completion');
}

/**
 * Renders a model's provider-reported capability tags as small badges, with
 * `thinking` emphasized so it's scannable at a glance. The ubiquitous
 * `completion` tag is dropped as noise; an em dash shows when nothing notable
 * remains.
 */
function CapabilitiesCell({ capabilities }: Readonly<{ capabilities: unknown }>) {
  const tags = capabilityTags(capabilities);
  if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant={tag === 'thinking' ? 'default' : 'outline'}>
          {tag}
        </Badge>
      ))}
    </span>
  );
}

const CONFIDENCE_TIER_CLASSES: Record<ConfidenceTier, string> = {
  high: 'bg-status-pass text-white',
  medium: 'bg-status-warn text-white',
  low: 'bg-status-warn text-white',
  'very-low': 'bg-status-fail text-white',
};

/**
 * Confidence badge + explanatory tooltip for one model row. `result` is
 * null/undefined when the model has no profile or no rating for the task —
 * an em dash renders instead (unknown models are never scored).
 */
function ConfidenceCell({
  result,
  notes,
}: Readonly<{ result: ConfidenceResult | null | undefined; notes?: string }>) {
  const { t } = useTranslation('config');
  if (!result) return <span className="text-muted-foreground">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            className={CONFIDENCE_TIER_CLASSES[result.tier]}
            data-testid="model-confidence-badge"
          />
        }
      >
        {t(`models.confidenceTier.${result.tier}`)}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <span className="flex flex-col gap-1">
          <span>{t('models.confidenceScore', { score: result.score })}</span>
          {result.reasons.map((reason) => (
            <span key={reason.code}>
              {t(`models.confidenceReason.${reason.code}`, reason.params)}
            </span>
          ))}
          {notes && <span className="opacity-80">{notes}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

interface SortableHeadProps {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortableHead({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
}: Readonly<SortableHeadProps>) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="-mx-1 flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export function ModelPicker({
  id,
  value,
  onValueChange,
  models,
  disabled,
  placeholder,
  specialOption,
  triggerTestId,
  triggerClassName,
  withHiddenInput = true,
  footprints,
  onInspectFootprints,
  inspecting,
  inspectProgress,
  local,
  confidenceContext,
  recommendedModelIds,
}: Readonly<ModelPickerProps>): React.JSX.Element {
  const { t } = useTranslation('config');
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({
    key: 'input',
    dir: 'asc',
  });

  // Reset the search box whenever the dialog toggles so it never reopens stale.
  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    setQuery('');
  }, []);

  const handleSort = React.useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  }, []);

  const commit = React.useCallback(
    (next: string) => {
      onValueChange(next);
      setOpen(false);
    },
    [onValueChange],
  );

  const isRec = React.useCallback(
    // Guard against a missing/non-string id (partial ModelInfo occurs in
    // discovery edge cases and test fixtures) — mirror findConfidenceProfile's
    // tolerance so an id-less row is simply "not recommended" rather than a throw.
    (m: ModelInfo) =>
      typeof m.id === 'string' ? (recommendedModelIds?.has(m.id.toLowerCase()) ?? false) : false,
    [recommendedModelIds],
  );

  // Does the list have any priced model? When so, unpriced models are
  // de-emphasized (muted row) and sunk to the bottom rather than hidden. A
  // fully unpriced list (local Ollama models are free) keeps its normal order.
  const anyPriced = React.useMemo(() => models.some((m) => hasPricing(m.billing)), [models]);

  // Does any model expose cache pricing? The cache column is hidden otherwise.
  const showCacheColumn = React.useMemo(
    () => models.some((m) => m.billing?.cachedInputCostPerMillion !== undefined),
    [models],
  );

  // Does any model report notable capabilities (anything beyond the ubiquitous
  // `completion` tag)? The capabilities column is hidden otherwise — cloud
  // providers that report none never show an empty column.
  const showCapsColumn = React.useMemo(
    () => models.some((m) => capabilityTags(m.capabilityTags).length > 0),
    [models],
  );

  // Does any model report a native context window? The context column is
  // hidden otherwise — discovery only surfaces it for local models and for
  // cloud models the bundled pricing snapshot has a context length for.
  const showContextColumn = React.useMemo(
    () => models.some((m) => formatContextLength(m.contextLength) !== null),
    [models],
  );

  // Local-only size details, each its own muted trailing column. Shown only
  // when at least one model reports the field, so cloud providers never see them.
  const showParamsColumn = React.useMemo(() => models.some((m) => !!m.parameterSize), [models]);
  const showQuantColumn = React.useMemo(() => models.some((m) => !!m.quantizationLevel), [models]);
  const showDiskColumn = React.useMemo(
    () => models.some((m) => m.sizeBytes !== undefined),
    [models],
  );

  // Local-LLM (free) mode: explicit `local` prop wins; otherwise inferred from
  // whether models report a disk size. In local mode the cost columns carry no
  // signal, so Input/Output are hidden and ordering is driven by size/footprint.
  const localMode = local ?? showDiskColumn;

  // The VRAM footprint column + inspect button appear only when the caller
  // wires up inspection (local/Ollama modules).
  const showFootprintColumn = onInspectFootprints !== undefined;

  // Whether any model has a measured VRAM footprint — switches the local sort
  // from "disk size asc" to "GPU placement desc, then VRAM asc".
  const hasFootprintData = React.useMemo(
    () => models.some((m) => footprints?.[m.id]?.sizeVramBytes !== undefined),
    [models, footprints],
  );

  // Confidence scores per model id, computed only when the caller supplies a
  // run context. `null` = known-unknown (no profile / no rating for the task).
  const confidenceByModelId = React.useMemo(() => {
    if (!confidenceContext) return undefined;
    const map = new Map<string, ConfidenceResult | null>();
    for (const m of models) {
      const profile = findConfidenceProfile(m.id);
      map.set(
        m.id,
        profile
          ? scoreModelConfidence({
              profile,
              task: confidenceContext.task,
              entryCount: confidenceContext.entryCount,
              promptTokensEstimate: confidenceContext.promptTokensEstimate,
              effort: confidenceContext.effort ?? m.defaultReasoningEffort,
              contextLength: m.contextLength,
            })
          : null,
      );
    }
    return map;
  }, [models, confidenceContext]);
  const showConfidenceColumn = confidenceByModelId !== undefined;

  const trimmedQuery = query.trim();
  const filtered = React.useMemo(() => {
    const needle = trimmedQuery.toLowerCase();
    const matched = needle
      ? models.filter((m) => `${m.name ?? ''} ${m.id}`.toLowerCase().includes(needle))
      : models.slice();
    if (localMode) {
      // Local models carry no pricing, so order by footprint instead: once
      // anything is measured, best GPU placement first (VRAM asc on ties);
      // before measuring, smallest disk size first.
      matched.sort((a, b) => compareLocalModels(a, b, footprints, hasFootprintData));
      return matched;
    }
    matched.sort((a, b) => {
      // Recommended models float to the top regardless of the active sort.
      const ar = isRec(a) ? 0 : 1;
      const br = isRec(b) ? 0 : 1;
      if (ar !== br) return ar - br;
      // Unpriced models sink to the bottom when the list has priced ones,
      // regardless of the active column/direction.
      if (anyPriced) {
        const aUnpriced = hasPricing(a.billing) ? 0 : 1;
        const bUnpriced = hasPricing(b.billing) ? 0 : 1;
        if (aUnpriced !== bUnpriced) return aUnpriced - bUnpriced;
      }
      if (sort.key === 'confidence') {
        const sa = confidenceByModelId?.get(a.id)?.score;
        const sb = confidenceByModelId?.get(b.id)?.score;
        // Unscored models sink to the bottom regardless of direction.
        if ((sa === undefined) !== (sb === undefined)) return sa === undefined ? 1 : -1;
        const cmp = (sa ?? 0) - (sb ?? 0);
        return sort.dir === 'asc' ? cmp : -cmp;
      }
      let cmp: number;
      if (sort.key === 'name') {
        cmp = (a.name ?? a.id).localeCompare(b.name ?? b.id);
      } else {
        cmp = columnCost(a.billing, sort.key) - columnCost(b.billing, sort.key);
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return matched;
  }, [
    models,
    trimmedQuery,
    sort,
    anyPriced,
    localMode,
    footprints,
    hasFootprintData,
    confidenceByModelId,
    isRec,
  ]);

  // A custom-entry action is offered whenever the typed text isn't an exact id match.
  const exactMatch = models.some((m) => m.id === trimmedQuery);
  const canUseCustom = trimmedQuery !== '' && !exactMatch;

  // Trigger label: the discovered model's label, else the raw value (custom id),
  // else the special option's label, else the placeholder.
  const selectedModel = models.find((m) => m.id === value);
  let triggerLabel: string;
  if (selectedModel) {
    triggerLabel = buildModelLabel(selectedModel);
  } else if (specialOption && value === specialOption.value) {
    triggerLabel = specialOption.label;
  } else if (value !== '') {
    triggerLabel = value;
  } else {
    triggerLabel = placeholder ?? t('models.select');
  }

  const colSpan =
    1 + // Model column
    (showConfidenceColumn ? 1 : 0) +
    (localMode ? 0 : 2) + // Input + Output (hidden for local models)
    (showCacheColumn ? 1 : 0) +
    (showCapsColumn ? 1 : 0) +
    (showContextColumn ? 1 : 0) +
    (showParamsColumn ? 1 : 0) +
    (showQuantColumn ? 1 : 0) +
    (showDiskColumn ? 1 : 0) +
    (showFootprintColumn ? 2 : 0);

  return (
    <>
      {/* Hidden input preserves the field id so external selectors/forms can read the value. */}
      {withHiddenInput && <input type="hidden" id={id} value={value} readOnly />}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              data-testid={triggerTestId}
              className={cn(
                'w-full min-w-0 max-w-64 justify-between font-normal',
                triggerClassName,
              )}
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              {t('models.pickTitle')}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={t('models.pricingInfoAria')}
                      className="inline-flex text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <Info className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{t('models.pricingNote')}</TooltipContent>
              </Tooltip>
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('models.searchOrType')}
              className="h-9 pl-8"
              data-testid="model-picker-search"
            />
          </div>

          {showFootprintColumn && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span aria-live="polite">
                {inspectProgress
                  ? t('models.footprintInspecting', {
                      done: inspectProgress.done,
                      total: inspectProgress.total,
                      model: inspecting ?? '',
                    })
                  : t('models.footprintHint')}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || inspectProgress !== null}
                onClick={onInspectFootprints}
                data-testid="model-picker-inspect-footprint"
              >
                {inspectProgress && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {inspectProgress
                  ? t('models.footprintInspectingShort')
                  : t('models.inspectFootprint')}
              </Button>
            </div>
          )}

          <div className="max-h-[70vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-popover">
                <TableRow>
                  <SortableHead
                    label={t('models.colModel')}
                    sortKey="name"
                    active={sort.key === 'name'}
                    dir={sort.dir}
                    onSort={handleSort}
                  />
                  {showConfidenceColumn && (
                    <SortableHead
                      label={t('models.colConfidence')}
                      sortKey="confidence"
                      active={sort.key === 'confidence'}
                      dir={sort.dir}
                      onSort={handleSort}
                    />
                  )}
                  {showCapsColumn && <TableHead>{t('models.colCapabilities')}</TableHead>}
                  {showContextColumn && (
                    <TableHead className="text-right">{t('models.colContext')}</TableHead>
                  )}
                  {/* Local models carry no pricing — Input/Output are hidden
                      there entirely; cloud providers keep the cost columns. */}
                  {!localMode && (
                    <SortableHead
                      label={t('models.colInput')}
                      sortKey="input"
                      active={sort.key === 'input'}
                      dir={sort.dir}
                      onSort={handleSort}
                      className="text-right"
                    />
                  )}
                  {!localMode && (
                    <SortableHead
                      label={t('models.colOutput')}
                      sortKey="output"
                      active={sort.key === 'output'}
                      dir={sort.dir}
                      onSort={handleSort}
                      className="text-right"
                    />
                  )}
                  {showCacheColumn && (
                    <SortableHead
                      label={t('models.colCache')}
                      sortKey="cache"
                      active={sort.key === 'cache'}
                      dir={sort.dir}
                      onSort={handleSort}
                      className="text-right"
                    />
                  )}
                  {showParamsColumn && (
                    <TableHead className="text-right font-normal text-muted-foreground">
                      {t('models.colParameters')}
                    </TableHead>
                  )}
                  {showQuantColumn && (
                    <TableHead className="text-right font-normal text-muted-foreground">
                      {t('models.colQuantization')}
                    </TableHead>
                  )}
                  {showDiskColumn && (
                    <TableHead className="text-right font-normal text-muted-foreground">
                      {t('models.colSize')}
                    </TableHead>
                  )}
                  {showFootprintColumn && (
                    <TableHead className="text-right font-normal text-muted-foreground">
                      {t('models.colVram')}
                    </TableHead>
                  )}
                  {showFootprintColumn && (
                    <TableHead className="text-right font-normal text-muted-foreground">
                      {t('models.colProcessor')}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {specialOption && trimmedQuery === '' && (
                  <TableRow
                    className="cursor-pointer"
                    data-state={value === specialOption.value ? 'selected' : undefined}
                    onClick={() => commit(specialOption.value)}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {value === specialOption.value && <Check className="h-3.5 w-3.5" />}
                        {specialOption.label}
                      </span>
                    </TableCell>
                    {showConfidenceColumn && (
                      <TableCell className="text-muted-foreground">—</TableCell>
                    )}
                    {showCapsColumn && <TableCell className="text-muted-foreground">—</TableCell>}
                    {showContextColumn && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                    {!localMode && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                    {!localMode && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                    {showCacheColumn && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                    {showParamsColumn && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                    {showQuantColumn && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                    {showDiskColumn && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                    {showFootprintColumn && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                    {showFootprintColumn && (
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    )}
                  </TableRow>
                )}
                {filtered.map((m) => (
                  <TableRow
                    key={m.id}
                    className={cn(
                      'cursor-pointer',
                      // De-emphasize models with no pricing (sunk to the bottom).
                      anyPriced && !hasPricing(m.billing) && 'opacity-60',
                    )}
                    data-state={m.id === value ? 'selected' : undefined}
                    data-testid="model-picker-row"
                    onClick={() => commit(m.id)}
                  >
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {m.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate font-medium">{m.name ?? m.id}</span>
                          {m.name && (
                            <span className="truncate font-mono text-xs text-muted-foreground">
                              {m.id}
                            </span>
                          )}
                        </span>
                        {isRec(m) && (
                          <Badge variant="default" data-testid="model-recommended-badge">
                            {t('models.recommendedBadge')}
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    {showConfidenceColumn && (
                      <TableCell>
                        <ConfidenceCell
                          result={confidenceByModelId?.get(m.id)}
                          notes={findConfidenceProfile(m.id)?.notes}
                        />
                      </TableCell>
                    )}
                    {showCapsColumn && (
                      <TableCell>
                        <CapabilitiesCell capabilities={m.capabilityTags} />
                      </TableCell>
                    )}
                    {showContextColumn && (
                      <TableCell className="text-right tabular-nums">
                        {formatContextLength(m.contextLength) ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {!localMode && (
                      <TableCell className="text-right">
                        <PriceCell
                          usd={m.billing?.inputCostPerMillion}
                          multiplier={m.billing?.multiplier}
                        />
                      </TableCell>
                    )}
                    {!localMode && (
                      <TableCell className="text-right">
                        <PriceCell
                          usd={m.billing?.outputCostPerMillion}
                          multiplier={m.billing?.outputMultiplier}
                        />
                      </TableCell>
                    )}
                    {showCacheColumn && (
                      <TableCell className="text-right">
                        <PriceCell usd={m.billing?.cachedInputCostPerMillion} />
                      </TableCell>
                    )}
                    {showParamsColumn && (
                      <TableCell className="text-right text-xs whitespace-nowrap text-muted-foreground">
                        {m.parameterSize ?? '—'}
                      </TableCell>
                    )}
                    {showQuantColumn && (
                      <TableCell className="text-right text-xs whitespace-nowrap text-muted-foreground">
                        {m.quantizationLevel ?? '—'}
                      </TableCell>
                    )}
                    {showDiskColumn && (
                      <TableCell className="text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatBytes(m.sizeBytes) ?? '—'}
                      </TableCell>
                    )}
                    {showFootprintColumn && (
                      <TableCell className="text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        <FootprintCell entry={footprints?.[m.id]} loading={inspecting === m.id} />
                      </TableCell>
                    )}
                    {showFootprintColumn && (
                      <TableCell className="text-right text-xs whitespace-nowrap tabular-nums">
                        <ProcessorCell
                          entry={footprints?.[m.id]}
                          loading={inspecting === m.id}
                          label={(pct) => t('models.gpuPlacement', { pct })}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && !canUseCustom && (
                  <TableRow>
                    <TableCell
                      colSpan={colSpan}
                      className="py-6 text-center text-muted-foreground"
                      data-testid="model-picker-empty"
                    >
                      {models.length === 0 ? t('models.noModels') : t('models.noMatches')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {canUseCustom && (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-normal"
              data-testid="model-picker-use-custom"
              onClick={() => commit(trimmedQuery)}
            >
              <Check className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('models.useCustom', { model: trimmedQuery })}</span>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
