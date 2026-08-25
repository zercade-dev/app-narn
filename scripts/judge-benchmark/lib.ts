/**
 * Pure logic for the judge-quality benchmark: corpus-source parsing, the
 * curated good/weak/injected corpus shape, review-corpus construction from
 * the corpus's own `arm` assignment, and verdict-key/file helpers. No I/O, no
 * provider calls — mirrors `freeway-benchmark/lib.ts`'s split (pure logic
 * here, network/filesystem/CLI in the sibling runner) so the two benchmarks
 * stay easy to read side by side.
 */
import { createHash } from 'node:crypto';

/** The only two languages this benchmark judges — see the corpus-source header. */
export const JUDGE_LANGS = ['fr', 'ja'] as const;
export type JudgeLang = (typeof JUDGE_LANGS)[number];

export interface CorpusSourceEntry {
  id: string;
  class: string;
  en: string;
  /** Known-good reference translation per language, produced earlier by strong models. */
  good: Record<string, string>;
}

/**
 * Which of a curated entry's variants was actually sent to the judge for one
 * language: the known-good reference ("clean"), or the text carrying exactly
 * one catalogued defect ("injected"). This assignment is DATA, produced by a
 * separate curation pass (stratified so every defect type appears in the
 * injected arm of both languages, and balanced clean/injected on purpose —
 * see JUDGE-BENCH-NOTES.md) — never recomputed here.
 */
export type Arm = 'clean' | 'injected';

/** One catalogued failure mode an `injected` variant carries, drawn from real production incidents. */
export const DEFECT_TYPES = [
  'placeholder-dropped',
  'placeholder-translated',
  'tag-unclosed',
  'terminology-drift',
  'entity-leak',
  'untranslated',
  'overflow',
] as const;
export type DefectType = (typeof DEFECT_TYPES)[number];

/**
 * A corpus-source entry plus everything a curation pass adds on top of it.
 * `weak` is produced by `--translate-weak` (kept for reference only — it no
 * longer drives arm selection). `injected`/`defect`/`arm`/`cleanFlaw` are
 * produced OUTSIDE this tool by a human/curated defect-injection pass; they
 * are optional on this type because `--translate-weak` must be able to
 * round-trip a corpus.json that doesn't have them yet (a fresh, pre-curation
 * corpus) without inventing placeholder values. `--judge` requires them —
 * see `requireCuratedEntries` below, which is the actual enforcement point.
 */
export interface CorpusEntry extends CorpusSourceEntry {
  weak?: Record<string, string>;
  /** Same string as `good`/`weak` but carrying exactly one catalogued defect. */
  injected?: Record<string, string>;
  /** Which defect `injected` carries, per language — always present once curated, even for entries whose `arm` is "clean" (it labels what the injected variant WOULD be). */
  defect?: Record<string, DefectType>;
  /** Which variant ("clean" -> good, "injected" -> injected) is actually sent to the judge, per language. */
  arm?: Record<string, Arm>;
  /** Non-null when the "good" reference itself is known to already carry a real defect (e.g. an `&nbsp;` leak from a prior production run) — set independent of `arm`, so a scorer can discount a false "clean" control that isn't actually clean. */
  cleanFlaw?: Record<string, DefectType | null>;
}

/** A `CorpusEntry` whose curated fields are guaranteed present — the shape `--judge` actually operates on. */
export type CuratedCorpusEntry = CorpusEntry & {
  injected: Record<string, string>;
  defect: Record<string, DefectType>;
  arm: Record<string, Arm>;
  cleanFlaw: Record<string, DefectType | null>;
};

export interface Corpus {
  version: 1;
  /** Hash of the committed corpus-source.json bytes this corpus was built from — ties the two files together so a stale weak-translation pass is detectable. */
  sourceVersion: string;
  /** `provider::model` that produced every `weak` translation. */
  weakModel: string;
  generatedAt: string;
  entries: CorpusEntry[];
}

export function hashBytes(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 8);
}

export function parseCorpusSource(raw: unknown): CorpusSourceEntry[] {
  const root = raw as { version?: unknown; entries?: unknown };
  if (root.version !== 1) throw new Error('corpus-source: expected version 1');
  if (!Array.isArray(root.entries)) throw new Error('corpus-source: missing entries[]');
  return root.entries.map((e) => {
    const { id, class: cls, en, good } = e as Record<string, unknown>;
    if (typeof id !== 'string' || !id) throw new Error('corpus-source: every entry needs an id');
    if (typeof cls !== 'string' || !cls) throw new Error(`corpus-source: entry "${id}" is missing class`);
    if (typeof en !== 'string' || !en) throw new Error(`corpus-source: entry "${id}" is missing en`);
    if (typeof good !== 'object' || good === null) throw new Error(`corpus-source: entry "${id}" is missing good{}`);
    for (const lang of JUDGE_LANGS) {
      const text = (good as Record<string, unknown>)[lang];
      if (typeof text !== 'string' || !text) {
        throw new Error(`corpus-source: entry "${id}" is missing good.${lang}`);
      }
    }
    return { id, class: cls, en, good: good as Record<string, string> };
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Reads whatever langRecord-shaped field is present without requiring it — used for the optional curated fields. */
function optionalLangRecord(entryId: string, field: string, value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) throw new Error(`corpus: entry "${entryId}" has an invalid ${field}{} (not an object)`);
  return value;
}

/**
 * Loose parse: validates the ALWAYS-required base fields (id/class/en/good)
 * and, for anything else present, that it has the right per-language shape —
 * but does not require `injected`/`defect`/`arm`/`cleanFlaw` to exist. Used
 * by both `--translate-weak` (which must round-trip a pre-curation corpus)
 * and as the first pass inside `--judge` (which then calls
 * `requireCuratedEntries` to enforce the fields it actually needs).
 */
export function parseCorpus(raw: unknown): Corpus {
  const root = raw as {
    version?: unknown;
    sourceVersion?: unknown;
    weakModel?: unknown;
    generatedAt?: unknown;
    entries?: unknown;
  };
  if (root.version !== 1) throw new Error('corpus: expected version 1');
  if (typeof root.sourceVersion !== 'string' || !root.sourceVersion) throw new Error('corpus: missing sourceVersion');
  if (typeof root.weakModel !== 'string' || !root.weakModel) throw new Error('corpus: missing weakModel');
  if (typeof root.generatedAt !== 'string' || !root.generatedAt) throw new Error('corpus: missing generatedAt');
  if (!Array.isArray(root.entries)) throw new Error('corpus: missing entries[]');
  const entries = root.entries.map((e) => {
    const rec = e as Record<string, unknown>;
    const { id, class: cls, en, good } = rec;
    if (typeof id !== 'string' || !id) throw new Error('corpus: every entry needs an id');
    if (typeof cls !== 'string' || !cls) throw new Error(`corpus: entry "${id}" is missing class`);
    if (typeof en !== 'string' || !en) throw new Error(`corpus: entry "${id}" is missing en`);
    if (!isPlainObject(good)) throw new Error(`corpus: entry "${id}" is missing good{}`);
    for (const lang of JUDGE_LANGS) {
      if (typeof good[lang] !== 'string') throw new Error(`corpus: entry "${id}" is missing good.${lang}`);
    }
    const weak = optionalLangRecord(id, 'weak', rec.weak);
    const injected = optionalLangRecord(id, 'injected', rec.injected);
    const defect = optionalLangRecord(id, 'defect', rec.defect);
    const arm = optionalLangRecord(id, 'arm', rec.arm);
    const cleanFlaw = optionalLangRecord(id, 'cleanFlaw', rec.cleanFlaw);
    const entry: CorpusEntry = { id, class: cls, en, good: good as Record<string, string> };
    if (weak) entry.weak = weak as Record<string, string>;
    if (injected) entry.injected = injected as Record<string, string>;
    if (defect) entry.defect = defect as Record<string, DefectType>;
    if (arm) entry.arm = arm as Record<string, Arm>;
    if (cleanFlaw) entry.cleanFlaw = cleanFlaw as Record<string, DefectType | null>;
    return entry;
  });
  return {
    version: 1,
    sourceVersion: root.sourceVersion,
    weakModel: root.weakModel,
    generatedAt: root.generatedAt,
    entries,
  };
}

/**
 * Strict pass required before `--judge` can run: every entry must carry
 * `injected`/`defect`/`arm`/`cleanFlaw` for BOTH languages, with valid
 * values (`arm` in {clean, injected}, `defect`/non-null `cleanFlaw` in
 * DEFECT_TYPES). Throws with a message that tells the operator this is a
 * curation gap, not a code bug — `--translate-weak` alone can never satisfy
 * this; the corpus needs the separate defect-injection pass described in
 * JUDGE-BENCH-NOTES.md.
 */
export function requireCuratedEntries(entries: CorpusEntry[]): CuratedCorpusEntry[] {
  return entries.map((e) => {
    for (const lang of JUDGE_LANGS) {
      if (typeof e.injected?.[lang] !== 'string' || !e.injected[lang]) {
        throw new Error(
          `corpus: entry "${e.id}" is missing injected.${lang} — this corpus has no curated defect-injection ` +
            'data yet. --judge needs a curated corpus.json (see JUDGE-BENCH-NOTES.md); --translate-weak alone ' +
            'only ever produces good/weak, never injected/defect/arm/cleanFlaw.',
        );
      }
      const defect = e.defect?.[lang];
      if (typeof defect !== 'string' || !(DEFECT_TYPES as readonly string[]).includes(defect)) {
        throw new Error(`corpus: entry "${e.id}" has an invalid/missing defect.${lang} (got ${JSON.stringify(defect)})`);
      }
      const arm = e.arm?.[lang];
      if (arm !== 'clean' && arm !== 'injected') {
        throw new Error(`corpus: entry "${e.id}" has an invalid/missing arm.${lang} (got ${JSON.stringify(arm)}; must be "clean" or "injected")`);
      }
      if (!e.cleanFlaw || !(lang in e.cleanFlaw)) {
        throw new Error(`corpus: entry "${e.id}" is missing cleanFlaw.${lang} (must be present, null or a defect type)`);
      }
      const cleanFlaw = e.cleanFlaw[lang];
      if (cleanFlaw !== null && !(DEFECT_TYPES as readonly string[]).includes(cleanFlaw)) {
        throw new Error(`corpus: entry "${e.id}" has an invalid cleanFlaw.${lang} (got ${JSON.stringify(cleanFlaw)})`);
      }
    }
    return e as CuratedCorpusEntry;
  });
}

export interface ReviewItem {
  id: string;
  arm: Arm;
  text: string;
  defect: DefectType;
  cleanFlaw: DefectType | null;
}

/**
 * The 25-pair review corpus for one language: `entry.arm[lang]` says whether
 * `good[lang]` (clean control) or `injected[lang]` (one catalogued defect)
 * goes to the judge — a straight data read, not a computation. Never derive
 * this any other way: the split is stratified/balanced by the curation pass
 * and reproducibility comes from the committed corpus.json, not from
 * recomputing it here.
 */
export function buildReviewCorpus(entries: CuratedCorpusEntry[], lang: JudgeLang): ReviewItem[] {
  return entries.map((e) => {
    const arm = e.arm[lang];
    const text = arm === 'clean' ? e.good[lang] : e.injected[lang];
    return { id: e.id, arm, text, defect: e.defect[lang], cleanFlaw: e.cleanFlaw[lang] };
  });
}

/** `provider::model::run<N>::lang::entryId` — mirrors freeway-benchmark's cellKey shape. */
export function verdictKey(providerKey: string, modelId: string, run: number, lang: string, entryId: string): string {
  return `${providerKey}::${modelId}::run${run}::${lang}::${entryId}`;
}

/** `provider::model::run<N>` — one level up from `verdictKey`, naming a whole (model, run) rather than one item. */
export function incompleteRunKey(providerKey: string, modelId: string, run: number): string {
  return `${providerKey}::${modelId}::run${run}`;
}

/**
 * The (lang, ReviewItem) pairs a (model, run) still needs a verdict for —
 * i.e. everything in the review corpus MINUS whatever already has a
 * verdictKey entry in `verdicts`. This is the resumability primitive: a run
 * interrupted after 22/50 items only re-requests the other 28 on the next
 * invocation, because those 22 already have keys. Pass `undefined` for
 * `verdicts` (or the caller's own `--refresh` branch) to treat the run as
 * fully pending regardless of what's on disk.
 */
export function pendingRunItems(
  providerKey: string,
  modelId: string,
  run: number,
  reviewCorpora: Record<JudgeLang, ReviewItem[]>,
  verdicts: Record<string, VerdictRecord> | undefined,
): Array<{ lang: JudgeLang; item: ReviewItem }> {
  const out: Array<{ lang: JudgeLang; item: ReviewItem }> = [];
  for (const lang of JUDGE_LANGS) {
    for (const item of reviewCorpora[lang]) {
      const key = verdictKey(providerKey, modelId, run, lang, item.id);
      if (verdicts && key in verdicts) continue;
      out.push({ lang, item });
    }
  }
  return out;
}

/**
 * Splits a verdictKey back into its parts. `modelId` can itself contain a
 * single `:` (e.g. openrouter's `nvidia/nemotron-3-ultra-550b-a55b:free`) but
 * never a `::`, so the FIRST `::` is always the providerKey boundary and the
 * run/lang/entryId suffix is always exactly 3 more `::`-separated fields —
 * same trick as freeway-benchmark/lib.ts's splitKey.
 */
export function splitVerdictKey(key: string): { providerKey: string; modelId: string; run: number; lang: string; entryId: string } {
  const parts = key.split('::');
  if (parts.length !== 5) throw new Error(`malformed verdict key: "${key}"`);
  const [providerKey, modelId, runPart, lang, entryId] = parts;
  const run = Number(runPart.replace(/^run/, ''));
  if (!Number.isFinite(run)) throw new Error(`malformed verdict key (bad run segment): "${key}"`);
  return { providerKey, modelId, run, lang, entryId };
}

/** `provider::model` — the granularity `--models` filters at and requests are budgeted at. */
export function modelKey(providerKey: string, modelId: string): string {
  return `${providerKey}::${modelId}`;
}

export interface VerdictRecord {
  arm: Arm;
  defect: DefectType;
  cleanFlaw: DefectType | null;
  verdict?: 'pass' | 'fail';
  score?: number;
  /** Issue TYPES only (e.g. "mistranslation") — full detail text lives in the local detail file. */
  issues?: string[];
  /**
   * True when the judge returned no verdict for this item, or returned one
   * carrying `.error` — i.e. every case where a real pass/fail verdict is
   * NOT what's recorded here. Never silently treated as a pass: a scorer
   * reading verdicts.json must be able to tell "the model failed this
   * translation" apart from "the model failed to answer at all".
   */
  malformed: boolean;
  error?: string;
}

/**
 * Records that a (model, run) was abandoned before every item got a real
 * verdict — a rate-limit wall-clock budget trip, an rpd cap, or an
 * unexpected error. `itemsDone`/`itemsTotal` let a scorer tell "this model
 * judged 30 of 50 items" apart from "this model passed 20 items": the
 * PRESENT verdicts for a partial run are exactly what the model produced
 * (never a synthesized placeholder for the un-attempted rest), so a naive
 * reader counting only `verdicts` entries already sees the right
 * denominator — this record exists so the reason and the shortfall are also
 * visible without cross-referencing runsPresent against 50.
 */
export interface IncompleteRunRecord {
  reason: string;
  ts: number;
  itemsDone: number;
  itemsTotal: number;
}

export interface VerdictsFile {
  version: 1;
  corpusVersion: string;
  /** `lang -> ordered review corpus for that language` — regenerable via buildReviewCorpus, recorded so a scorer never has to re-read corpus.json to know which arm/defect each item carried. */
  reviewCorpus: Record<string, Array<{ id: string; arm: Arm; defect: DefectType; cleanFlaw: DefectType | null }>>;
  verdicts: Record<string, VerdictRecord>;
  /**
   * `provider::model::run<N>` -> why that run currently sits short of all 50
   * items. Absent for a run that's either complete or not yet attempted at
   * all. A LATER invocation that finishes the same run removes its entry
   * here — the marker describes current state, not a permanent scar.
   */
  incompleteRuns?: Record<string, IncompleteRunRecord>;
}

export function sortedVerdictsFile(file: VerdictsFile): VerdictsFile {
  const reviewCorpus: VerdictsFile['reviewCorpus'] = {};
  for (const lang of Object.keys(file.reviewCorpus).sort()) {
    reviewCorpus[lang] = [...file.reviewCorpus[lang]].sort((a, b) => (a.id < b.id ? -1 : 1));
  }
  const incompleteRuns =
    file.incompleteRuns && Object.keys(file.incompleteRuns).length > 0
      ? Object.fromEntries(Object.entries(file.incompleteRuns).sort(([a], [b]) => (a < b ? -1 : 1)))
      : undefined;
  return {
    version: 1,
    corpusVersion: file.corpusVersion,
    reviewCorpus,
    verdicts: Object.fromEntries(Object.entries(file.verdicts).sort(([a], [b]) => (a < b ? -1 : 1))),
    ...(incompleteRuns ? { incompleteRuns } : {}),
  };
}
