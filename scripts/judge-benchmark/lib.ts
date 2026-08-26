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

export interface DispatchItem {
  lang: JudgeLang;
  item: ReviewItem;
}

/** `arm === 'clean'` categorizes as `'clean'`; an injected item categorizes as its own defect type. The category a model is actually tested on, independent of whether "clean" happens to also be defect-free (see `cleanFlaw`). */
export function itemCategory(item: ReviewItem): DefectType | 'clean' {
  return item.arm === 'clean' ? 'clean' : item.defect;
}

/**
 * Fixed, deterministic (category, language) group order the interleave below
 * round-robins over. `'clean'` first only because it needs to be somewhere
 * stable; DEFECT_TYPES is itself a fixed literal array (never sorted at
 * runtime), so this order is 100% reproducible across machines/runs.
 */
const DISPATCH_GROUP_ORDER: readonly (DefectType | 'clean')[] = ['clean', ...DEFECT_TYPES];

/**
 * Interleaves the two languages' review corpora so that any CONTIGUOUS
 * PREFIX is a representative sample of the whole — balanced across defect
 * categories (7 defect types + "clean") and both languages — rather than
 * one corpus-order block. This fixes a real scoring defect: the corpus is
 * curated in blocks (e.g. fr e00-e09 = the "subtle" defects, e10-e19 = the
 * "mechanical" ones, e20-e24 = all clean), dispatch used to walk it in that
 * same corpus order language-by-language, and a model abandoned partway
 * (rate-limited — see RATE_LIMIT_WAIT_CAP_MS in judge-benchmark.ts) ended up
 * tested on exactly one category in exactly one language instead of a
 * cross-section — not comparable to a model that saw the full 50.
 *
 * Method: group items by `(itemCategory, lang)` — a fixed key derived only
 * from stable corpus data (never `Math.random`, never wall-clock, never
 * insertion order beyond the corpus's own ascending entry-id order that
 * `buildReviewCorpus` already produces) — then deal them round-robin, one
 * item per group per round, cycling `DISPATCH_GROUP_ORDER`. Every group has
 * at least one item, so round 0 alone already touches every category in
 * both languages; a first chunk of 10 (JUDGE_BATCH_SIZE) draws from up to
 * 10 distinct (category, lang) groups before any group repeats. Entry
 * identities (e00-e24) are untouched — this only reorders DISPATCH, not the
 * corpus itself.
 */
export function buildDispatchOrder(reviewCorpora: Record<JudgeLang, ReviewItem[]>): DispatchItem[] {
  const groups = new Map<string, DispatchItem[]>();
  const groupKeys: string[] = [];
  for (const category of DISPATCH_GROUP_ORDER) {
    for (const lang of JUDGE_LANGS) {
      groupKeys.push(`${category}:${lang}`);
    }
  }
  for (const lang of JUDGE_LANGS) {
    for (const item of reviewCorpora[lang]) {
      const key = `${itemCategory(item)}:${lang}`;
      const list = groups.get(key);
      const entry: DispatchItem = { lang, item };
      if (list) list.push(entry);
      else groups.set(key, [entry]);
    }
  }
  const out: DispatchItem[] = [];
  for (let round = 0; ; round++) {
    let tookAny = false;
    for (const key of groupKeys) {
      const list = groups.get(key);
      if (!list || round >= list.length) continue;
      out.push(list[round]);
      tookAny = true;
    }
    if (!tookAny) break;
  }
  return out;
}

/**
 * The dispatch items a (model, run) still needs a verdict for — i.e. the
 * dispatch order MINUS whatever already has a verdictKey entry in
 * `verdicts`, preserving the interleaved order. This is the resumability
 * primitive: a run interrupted after 22/50 items only re-requests the other
 * 28 on the next invocation, because those 22 already have keys — and the
 * 28 remaining are themselves still a representative slice of what's left,
 * not a corpus-order remainder. Pass `undefined` for `verdicts` (or the
 * caller's own `--refresh` branch) to treat the run as fully pending
 * regardless of what's on disk.
 */
export function pendingRunItems(
  providerKey: string,
  modelId: string,
  run: number,
  dispatchOrder: DispatchItem[],
  verdicts: Record<string, VerdictRecord> | undefined,
): DispatchItem[] {
  const out: DispatchItem[] = [];
  for (const { lang, item } of dispatchOrder) {
    const key = verdictKey(providerKey, modelId, run, lang, item.id);
    if (verdicts && key in verdicts) continue;
    out.push({ lang, item });
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
  /**
   * The exact sequence every model's items were (or would be) requested in
   * — `buildDispatchOrder`'s output, serialized. NOT resorted by
   * `sortedVerdictsFile` (unlike every other field here): the order IS the
   * content. Persisted so a reader can reconstruct precisely what any given
   * partial run was shown (e.g. "this model got items 0-21" = the first 22
   * entries here) without re-deriving the interleave themselves, even
   * though it IS fully reproducible from `reviewCorpus` alone via the same
   * function.
   */
  dispatchOrder?: Array<{ lang: JudgeLang; entryId: string }>;
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
    // Order preserved verbatim — see the field's own doc comment.
    ...(file.dispatchOrder ? { dispatchOrder: file.dispatchOrder } : {}),
    verdicts: Object.fromEntries(Object.entries(file.verdicts).sort(([a], [b]) => (a < b ? -1 : 1))),
    ...(incompleteRuns ? { incompleteRuns } : {}),
  };
}
