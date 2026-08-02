/**
 * M17 — TranslationMasker
 *
 * Reduces inline tags and runtime variables to short opaque placeholders
 * before a string is sent to a translation backend, then restores the
 * originals after the translated text comes back. This shields the
 * translator from accidentally rewriting markup or interpolation tokens.
 *
 * Mask format:
 *  - `<color=#fff>x</color>`        → `{t:1}x{/t:1}`
 *  - `<size=20>x</size>`            → `{t:1}x{/t:1}`
 *  - `{1:my_variable}` (Unity-like) → `{v:1}`
 *  - Constant glossary term match   → `{g:1}` (original casing preserved)
 *  - Escape sequences `\n` `\t` `\r` → `{e:1}` (literal two-char form preserved)
 *
 * Constant glossary terms are restored using the target-language translation
 * with the original occurrence's case pattern re-applied (lower / UPPER /
 * Title / mixed). When the masked text contains only placeholders and
 * whitespace, `trivial` is true and the translation engine can skip the
 * remote module call entirely and synthesise the result locally.
 *
 * Masking the escape sequences (rather than relying on a prompt instruction to
 * preserve them) keeps the literal `\n`/`\t`/`\r` out of the JSON payload sent
 * to LLM backends, where the required `\\n` double-escaping is a frequent
 * failure point — especially with model reasoning disabled. The opaque `{e:N}`
 * token round-trips byte-for-byte instead.
 */
import {
  type GlossaryTerm,
  type LQAIssue,
  type TagNode,
  MASK_TOKEN_SOURCE,
  escapeRegExp,
} from '@zercade-dev/narn-shared';
import { parse } from './M14-tag-parser.js';

/**
 * Matches any single M17 mask token (`{t:N}`/`{/t:N}`/`{v:N}`/`{g:N}`/`{e:N}`),
 * built from the canonical shared {@link MASK_TOKEN_SOURCE} so the token grammar
 * stays single-sourced. A fresh `/g` RegExp is built locally (not a shared
 * instance) so each consumer owns its own `lastIndex` — used here only with
 * `String.replace`, which resets it each call. The `verifyMaskedTranslation`
 * scan needs capture groups for the slash/kind/id, so it builds its own pattern
 * (also from the source) rather than reusing this one.
 */
const MASK_TOKEN_RE = new RegExp(MASK_TOKEN_SOURCE, 'g');

export type CaseKind = 'lower' | 'upper' | 'title' | 'asis';

interface TagSlot {
  tagName: string;
  attribute: string;
  /**
   * Plan extension (for `verifyMaskedTranslation`'s pair-integrity checks).
   * Multiset of the mask tokens (`{t:M}`/`{/t:M}`/`{v:M}`/`{g:M}`/`{e:M}`)
   * STRICTLY enclosed by this tag pair in the SOURCE masked text, captured at
   * mask time and keyed by exact token string (e.g. `{ '{v:2}': 1 }`). Empty
   * `{}` for a pair that wraps no mask tokens. `verifyMaskedTranslation` compares
   * it against the same pair's enclosed tokens in the backend output to detect a
   * token that migrated across the pair boundary (`shiftedPairs`).
   */
  enclosed: Record<string, number>;
  /**
   * Plan extension: true when this pair's SOURCE enclosed content held at least
   * one non-whitespace character OUTSIDE the mask tokens at mask time — i.e. the
   * pair wrapped translatable text. Lets `verifyMaskedTranslation` flag a pair
   * the backend emptied of all text (`emptiedPairs`). A pair enclosing only mask
   * tokens (e.g. `{t:1}{v:1}{/t:1}`) has `enclosedHasText: false`.
   */
  enclosedHasText: boolean;
}

interface VarSlot {
  original: string;
}

interface GlossarySlot {
  termId: string;
  caseKind: CaseKind;
  original: string;
}

interface EscapeSlot {
  original: string;
}

export interface MaskPlan {
  tags: Map<number, TagSlot>;
  vars: Map<number, VarSlot>;
  glossary: Map<number, GlossarySlot>;
  escapes: Map<number, EscapeSlot>;
}

export interface MaskResult {
  masked: string;
  plan: MaskPlan;
  /** True when masked text contains no translatable characters (only placeholders + whitespace). */
  trivial: boolean;
}

const VARIABLE_RE = /\{(\d+):[^{}]+\}/g;

/** Literal escape sequences (two characters: a backslash followed by n/t/r). */
const ESCAPE_SEQUENCE_RE = /\\[ntr]/g;

/**
 * Letter class used for case detection/application. Deliberately Latin-1 only
 * (not the Unicode-aware `\p{L}` used by `constantTermRegex`): non-Latin-1
 * scripts (Greek/Cyrillic/CJK) have no meaningful case pattern to re-apply, so
 * they fall through to `asis`. Widening this would be a behavior change.
 */
const ALPHA_RE = /[A-Za-zÀ-ÿ]/;

/** Index of the first Latin-1 letter in `s`, or -1 if it has none. */
function firstAlphaIndex(s: string): number {
  const m = ALPHA_RE.exec(s);
  return m ? s.indexOf(m[0]) : -1;
}

export function detectCase(s: string): CaseKind {
  if (!s) return 'asis';
  const idx = firstAlphaIndex(s);
  if (idx === -1) return 'asis';
  if (s === s.toLowerCase()) return 'lower';
  if (s === s.toUpperCase()) return 'upper';
  const head = s.slice(0, idx + 1);
  const tail = s.slice(idx + 1);
  if (head === head.toUpperCase() && tail === tail.toLowerCase()) return 'title';
  return 'asis';
}

export function applyCase(s: string, kind: CaseKind): string {
  if (!s) return s;
  switch (kind) {
    case 'lower':
      return s.toLowerCase();
    case 'upper':
      return s.toUpperCase();
    case 'title': {
      const idx = firstAlphaIndex(s);
      if (idx === -1) return s;
      return s.slice(0, idx) + s[idx].toUpperCase() + s.slice(idx + 1).toLowerCase();
    }
    default:
      return s;
  }
}

/**
 * Compiled constant-term boundary regexes, keyed by `term.source`. The pattern
 * depends only on the source wording, so it is built once and reused across the
 * many `maskText` calls on the translate/approve hot path instead of being
 * recompiled per term per call. The global flag means callers must use
 * `String.replace` (which resets `lastIndex` each call) — as `maskPlainText`
 * does — so a cached instance is safe to share.
 *
 * M17 deliberately uses a different boundary than the shared `buildTermBoundaryRegex`
 * (it treats `_` as a word char and is a capture-group replacement form), so the
 * regex itself is built here; only the literal escaping is shared (`escapeRegExp`).
 */
const termRegexCache = new Map<string, RegExp>();

/**
 * Cap on the number of compiled constant-term RegExps retained. The cache key is
 * the (user/attacker-influenced) glossary term `source`, so in the multi-tenant
 * cloud process an unbounded map would accumulate a `RegExp` for every distinct
 * term ever seen — a slow cross-tenant memory-growth vector. FIFO-evict the
 * oldest entry past the cap; recompiling an evicted term is cheap.
 */
export const MAX_TERM_REGEX_CACHE = 5000;

/** Current size of the constant-term regex cache (introspection for tests). */
export function termRegexCacheSize(): number {
  return termRegexCache.size;
}

export function constantTermRegex(source: string): RegExp {
  const cached = termRegexCache.get(source);
  if (cached) return cached;
  const pattern = new RegExp(
    String.raw`(^|[^\p{L}\p{N}_])(` + escapeRegExp(source) + String.raw`)(?=[^\p{L}\p{N}_]|$)`,
    'giu',
  );
  if (termRegexCache.size >= MAX_TERM_REGEX_CACHE) {
    const oldest = termRegexCache.keys().next().value;
    if (oldest !== undefined) termRegexCache.delete(oldest);
  }
  termRegexCache.set(source, pattern);
  return pattern;
}

/**
 * Applies `transform` to each run of text that lies *outside* an M17 mask token,
 * leaving the `{t:N}`/`{/t:N}`/`{v:N}`/`{g:N}`/`{e:N}` tokens themselves
 * untouched. Used by the glossary pass so a single-letter/digit glossary term
 * can never match an already-inserted token's internals and corrupt it.
 *
 * A fresh `/g` RegExp is built per call so the scan owns its own `lastIndex`.
 */
function replaceOutsideMaskTokens(text: string, transform: (segment: string) => string): string {
  const tokenRe = new RegExp(MASK_TOKEN_SOURCE, 'g');
  let result = '';
  let last = 0;
  for (let m = tokenRe.exec(text); m !== null; m = tokenRe.exec(text)) {
    result += transform(text.slice(last, m.index));
    result += m[0];
    last = m.index + m[0].length;
  }
  result += transform(text.slice(last));
  return result;
}

/**
 * Multiset of every M17 mask token in `masked`, keyed by exact token string
 * (e.g. `{ '{v:2}': 1, '{t:3}': 1, '{/t:3}': 1 }`). A fresh `/g` RegExp is built
 * per call so the `.exec` scan owns its own `lastIndex`. Used both at mask time
 * (to record each tag pair's enclosed multiset) and at verify time (to recompute
 * the backend output's enclosed multiset for the shift comparison).
 */
function maskTokenMultiset(masked: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const tokenRe = new RegExp(MASK_TOKEN_SOURCE, 'g');
  for (let m = tokenRe.exec(masked); m !== null; m = tokenRe.exec(masked)) {
    counts[m[0]] = (counts[m[0]] ?? 0) + 1;
  }
  return counts;
}

/**
 * True when `masked` holds at least one non-whitespace character once every mask
 * token is stripped out — i.e. it carries translatable text, not just
 * placeholders/whitespace. `String.replace` resets `lastIndex`, so a fresh `/g`
 * RegExp is safe.
 */
function hasTextOutsideMaskTokens(masked: string): boolean {
  return masked.replace(new RegExp(MASK_TOKEN_SOURCE, 'g'), '').trim().length > 0;
}

export function maskText(text: string, constantTerms: GlossaryTerm[]): MaskResult {
  const tags = new Map<number, TagSlot>();
  const vars = new Map<number, VarSlot>();
  const glossary = new Map<number, GlossarySlot>();
  const escapes = new Map<number, EscapeSlot>();
  let tagCounter = 0;
  let varCounter = 0;
  let glossaryCounter = 0;
  let escapeCounter = 0;

  // Sort terms by descending length so longer phrases mask before any
  // shorter prefix would consume them.
  const sortedTerms = [...constantTerms].sort((a, b) => b.source.length - a.source.length);

  const maskPlainText = (raw: string): string => {
    // Pass 0: neutralize any literal mask-token look-alikes already present in
    // the source (e.g. a source containing the text `{g:1}` or `{t:0}`). The
    // M14 parser treats `{…}` as ordinary text, so these reach here verbatim;
    // left alone they would collide with a real slot id in `restoreText`
    // (injecting the wrong term/tag) or, with no matching id, be silently
    // deleted. Capturing each as an escape slot whose `original` is the literal
    // token string makes it round-trip byte-for-byte and gives it a fresh,
    // non-colliding `{e:N}` id. Run before the real-token passes so the `{e:N}`
    // tokens they emit are never re-matched here.
    let out = raw.replace(MASK_TOKEN_RE, (match) => {
      const id = ++escapeCounter;
      escapes.set(id, { original: match });
      return `{e:${id}}`;
    });
    // Pass 1: literal escape sequences (`\n`/`\t`/`\r`). Masked first so they
    // never reach the backend as backslash escapes inside a JSON string.
    out = out.replace(ESCAPE_SEQUENCE_RE, (match) => {
      const id = ++escapeCounter;
      escapes.set(id, { original: match });
      return `{e:${id}}`;
    });
    // Pass 2: Unity-style `{N:name}` interpolation variables.
    out = out.replace(VARIABLE_RE, (match) => {
      const id = ++varCounter;
      vars.set(id, { original: match });
      return `{v:${id}}`;
    });
    // Pass 3: constant glossary matches (word-boundary, case-insensitive).
    // Glossary replacement runs only on the text spans *between* the `{e:N}`/
    // `{v:N}` tokens inserted above. A term whose source happens to be a token
    // internal (`t`/`v`/`g`/`e`, or a digit) would otherwise match inside an
    // inserted placeholder — `{` and `:`/`}` are non-word boundary chars — and
    // corrupt it so `restoreText` no longer recognises the token, silently
    // dropping the masked variable or escape.
    for (const term of sortedTerms) {
      if (!term.source) continue;
      const pattern = constantTermRegex(term.source);
      out = replaceOutsideMaskTokens(out, (segment) =>
        segment.replace(pattern, (_full, before: string, match: string) => {
          const id = ++glossaryCounter;
          glossary.set(id, {
            termId: term.id,
            caseKind: detectCase(match),
            original: match,
          });
          return `${before}{g:${id}}`;
        }),
      );
    }
    return out;
  };

  const walk = (nodes: TagNode[]): string => {
    let buf = '';
    for (const node of nodes) {
      if (node.type === 'text') {
        buf += maskPlainText(node.content);
      } else if (node.type === 'tag') {
        const id = ++tagCounter;
        const attribute = node.attributes?.[node.content] ?? '';
        // Insert the slot up-front (pre-order) so `plan.tags` iteration order is
        // byte-identical to before, then fill the plan-extension fields from the
        // fully-masked child content once the recursion returns (the slot is held
        // by reference, so the map entry updates in place).
        const slot: TagSlot = {
          tagName: node.content,
          attribute,
          enclosed: {},
          enclosedHasText: false,
        };
        tags.set(id, slot);
        const childMasked = walk(node.children ?? []);
        slot.enclosed = maskTokenMultiset(childMasked);
        slot.enclosedHasText = hasTextOutsideMaskTokens(childMasked);
        buf += `{t:${id}}` + childMasked + `{/t:${id}}`;
      } else {
        // Parser-emitted 'error' nodes are passed through verbatim so the
        // backend (and the post-translation diff) sees the original markup.
        buf += node.content;
      }
    }
    return buf;
  };

  const masked = walk(parse(text));
  const stripped = masked.replace(MASK_TOKEN_RE, '');
  const trivial = stripped.trim().length === 0;

  return { masked, plan: { tags, vars, glossary, escapes }, trivial };
}

export function restoreText(
  maskedTranslated: string,
  plan: MaskPlan,
  glossaryById: Map<string, GlossaryTerm>,
  targetLanguage: string,
): string {
  return maskedTranslated
    .replace(/\{t:(\d+)\}/g, (_match, n: string) => {
      const slot = plan.tags.get(Number(n));
      if (!slot) return '';
      return slot.attribute ? `<${slot.tagName}=${slot.attribute}>` : `<${slot.tagName}>`;
    })
    .replace(/\{\/t:(\d+)\}/g, (_match, n: string) => {
      const slot = plan.tags.get(Number(n));
      if (!slot) return '';
      return `</${slot.tagName}>`;
    })
    .replace(/\{v:(\d+)\}/g, (_match, n: string) => {
      const slot = plan.vars.get(Number(n));
      return slot ? slot.original : '';
    })
    .replace(/\{g:(\d+)\}/g, (_match, n: string) => {
      const slot = plan.glossary.get(Number(n));
      if (!slot) return '';
      const term = glossaryById.get(slot.termId);
      const translation = term?.translations[targetLanguage];
      if (!translation) return slot.original;
      return applyCase(translation, slot.caseKind);
    })
    .replace(/\{e:(\d+)\}/g, (_match, n: string) => {
      const slot = plan.escapes.get(Number(n));
      return slot ? slot.original : '';
    });
}

/**
 * Re-applies the source text's leading/trailing whitespace to a translation.
 *
 * Translation backends trim their output (the AI SDK providers call `.trim()`
 * on every parsed result), so a source with edge whitespace could never yield
 * a translation that preserves it. M9 applies this after unmasking, right
 * before persisting, which also keeps the whitespace-parity LQA check green
 * for engine-produced translations.
 *
 * Empty or whitespace-only translations are returned unchanged (they signal
 * errors/cancellations, not translations), as are whitespace-only sources.
 */
export function restoreEdgeWhitespace(sourceText: string, translatedText: string): string {
  const core = translatedText.trim();
  if (core.length === 0) return translatedText;
  if (sourceText.trim().length === 0) return translatedText;
  const lead = /^\s*/u.exec(sourceText)?.[0] ?? '';
  const trail = /\s*$/u.exec(sourceText)?.[0] ?? '';
  return lead + core + trail;
}

/**
 * Strips real newline characters a backend introduced when the source had
 * none. Game strings express line breaks as literal `\n` escapes (masked and
 * restored through {e:N}); a real U+000A/U+000D the model inserts for
 * "readability" is never wanted — it has no counterpart in the source and
 * trips the blocking line-break-parity LQA check.
 *
 * Only normalises when the source contains NO real newline, so genuinely
 * multi-line sources are left untouched (their parity is still checked).
 * Adjacent horizontal whitespace the model used to indent the break is removed
 * with it; the literal `\n` already sits at the boundary, so the inserted run
 * is pure formatting noise. Idempotent.
 */
export function normalizeAddedNewlines(sourceText: string, translatedText: string): string {
  if (/[\r\n]/.test(sourceText)) return translatedText;
  if (!/[\r\n]/.test(translatedText)) return translatedText;
  return translatedText.replace(/[^\S\r\n]*(?:\r\n|\r|\n)+[^\S\r\n]*/g, '');
}

/**
 * The full post-translation restore the engine applies before persisting a
 * masked result: un-mask the placeholders, re-apply the source's edge
 * whitespace (backends trim), then strip any real newlines the backend added
 * to a single-line source. Single (`processJob`) and batch (`processBatchJob`)
 * dispatch paths — module results, trivial-masked synthesis, TM auto-apply,
 * and LQA corrective retries — all route through here so identical source
 * text persists identically regardless of how it was dispatched.
 */
export function restoreFinal(
  sourceText: string,
  maskedTranslated: string,
  plan: MaskPlan,
  glossaryById: Map<string, GlossaryTerm>,
  targetLanguage: string,
): string {
  return normalizeAddedNewlines(
    sourceText,
    restoreEdgeWhitespace(
      sourceText,
      restoreText(maskedTranslated, plan, glossaryById, targetLanguage),
    ),
  );
}

/**
 * Greedily pairs every slot in `transSlots` to a distinct slot in `sourceSlots`
 * that has an identical `identity(slot)` key, returning a `transId → sourceId`
 * remap. Because restore is identical for any two same-identity slots, any
 * consistent pairing is correct.
 *
 * Returns `null` (a token-multiset mismatch) if a translation slot has no unused
 * source slot of the same identity (a token the human added/duplicated beyond
 * the source's count) OR if any source slot is left unpaired (a token the human
 * dropped) — i.e. the per-identity counts must match exactly in both directions.
 */
function pairSlotsByIdentity<S>(
  transSlots: Map<number, S>,
  sourceSlots: Map<number, S>,
  identity: (slot: S) => string,
): Map<number, number> | null {
  const available = new Map<string, number[]>();
  for (const [id, slot] of sourceSlots) {
    const key = identity(slot);
    const bucket = available.get(key);
    if (bucket) bucket.push(id);
    else available.set(key, [id]);
  }

  const remap = new Map<number, number>();
  for (const [transId, slot] of transSlots) {
    const bucket = available.get(identity(slot));
    const sourceId = bucket?.shift();
    if (sourceId === undefined) return null; // added/duplicated beyond source count
    remap.set(transId, sourceId);
  }

  for (const bucket of available.values()) {
    if (bucket.length > 0) return null; // a source token the translation dropped
  }
  return remap;
}

/**
 * Prepares a human-approved translation for translation-memory storage so its
 * stored form carries **source-plan** slot ids, exactly as a normal engine run
 * would (the module echoes the source's `{v:N}` ids, so lookup masks the source
 * and restores the stored text against the *source* plan).
 *
 * The naive approach — masking source and approved text independently — numbers
 * each text's slot ids by its own occurrence order, so a human variant that
 * reorders indexed tokens ends up with translation-order ids that no longer line
 * up with the source-order ids used at apply time, silently swapping tokens on
 * restore. This re-maps the approved text's `{v:N}`/`{t:N}`/`{/t:N}`/`{e:N}` ids
 * onto the source plan's ids (matched by slot identity), so the round-trip is
 * faithful.
 *
 * Returns `{ maskedSource, maskedTranslation }` on success, or `null` when the
 * vars/tags/escapes token multiset of the approved text does not match the
 * source's (matched by identity), OR when re-masking the approved text yields
 * any glossary (`{g:N}`) token. Conservative by design: TM is an optimization,
 * so the caller skips a mismatched write (a missing entry is harmless; a corrupt
 * one is not). Glossary ids are not re-mapped: a language-invariant constant
 * term (brand / proper noun) appears verbatim in both source and target and gets
 * re-masked in the translation with occurrence ids that would swap or drop terms
 * against the source plan on restore, so any `{g:N}` in the approved text forces
 * a null-skip rather than a corrupt entry.
 */
export function maskApprovedForMemory(
  sourceText: string,
  approvedText: string,
  constantTerms: GlossaryTerm[],
): { maskedSource: string; maskedTranslation: string } | null {
  const { masked: maskedSource, plan: sourcePlan } = maskText(sourceText, constantTerms);
  const { masked: maskedTranslation, plan: transPlan } = maskText(approvedText, constantTerms);

  const varRemap = pairSlotsByIdentity(transPlan.vars, sourcePlan.vars, (s) => s.original);
  if (!varRemap) return null;
  const tagRemap = pairSlotsByIdentity(
    transPlan.tags,
    sourcePlan.tags,
    (s) => `${s.tagName} ${s.attribute}`,
  );
  if (!tagRemap) return null;
  const escapeRemap = pairSlotsByIdentity(transPlan.escapes, sourcePlan.escapes, (s) => s.original);
  if (!escapeRemap) return null;

  // Skip the TM write if re-masking the approved text produced ANY glossary
  // token. A language-invariant constant term (brand / proper noun, e.g.
  // "Acme") appears verbatim in BOTH source and target, so `constantTermRegex`
  // re-masks it in the approved text with translation-occurrence ids that won't
  // line up with the source-plan glossary ids `restoreText` uses at apply time
  // — a reordered variant would then swap (or drop) terms on restore. Glossary
  // ids aren't remapped (unlike vars/tags/escapes); null-skip is the intended,
  // conservative behavior (a missing TM entry is harmless; a corrupt one is not).
  if (transPlan.glossary.size > 0) return null;

  // Single-pass rewrite so overlapping trans/source id ranges never double-remap
  // (e.g. {v:1}→{v:2} and {v:2}→{v:1} both apply in one scan). Glossary `{g:N}`
  // tokens are deliberately excluded and left verbatim.
  const remappedTranslation = maskedTranslation.replace(
    /\{(\/?)([tve]):(\d+)\}/g,
    (_match, slash: string, kind: string, idStr: string) => {
      const id = Number(idStr);
      if (kind === 'v') return `{v:${varRemap.get(id)}}`;
      if (kind === 'e') return `{e:${escapeRemap.get(id)}}`;
      return `{${slash}t:${tagRemap.get(id)}}`;
    },
  );

  return { maskedSource, maskedTranslation: remappedTranslation };
}

type SlotKind = 't' | 'v' | 'g' | 'e';
type SlotRef = { kind: SlotKind; id: number };

export interface MaskDiagnostics {
  /** Slot ids the backend dropped from its translation (never round-tripped). */
  missing: SlotRef[];
  /** Slot tokens the backend hallucinated that have no entry in the plan. */
  unknown: SlotRef[];
  /**
   * Plan slots the backend emitted more than once. Each mask token stands for a
   * single source occurrence, so a duplicate corrupts the round-trip — e.g. a
   * doubled `{e:1}` becomes two `\n` where the source had one. Counted on the
   * opening token (tags legitimately carry a matching `{/t:N}` close).
   */
  duplicated: SlotRef[];
  /**
   * Tag-pair ids `N` — a well-formed `{t:N}…{/t:N}` present exactly once in BOTH
   * the source masked text and the backend output (pairs already flagged
   * missing/duplicated/unknown are skipped) — whose STRICTLY-enclosed mask-token
   * multiset differs between source and output: a `{v:M}`/`{g:M}`/`{e:M}`/nested
   * tag token migrated across the pair boundary (moved in or out). Compared
   * against the per-pair `TagSlot.enclosed` multiset recorded at mask time.
   *
   * Deliberate limitation (do not overstate this in wording or docs): this
   * catches TOKENS crossing a pair boundary. It does NOT — and cannot — catch
   * plain translated TEXT drifting across a boundary while the token layout is
   * unchanged, because no token identity carries that information.
   */
  shiftedPairs: number[];
  /**
   * Tag-pair ids `N` whose SOURCE enclosed content held translatable text (≥1
   * non-whitespace char outside the mask tokens, per `TagSlot.enclosedHasText`)
   * but whose OUTPUT enclosed content holds none — the pair lost its text
   * entirely (e.g. `{t:1}Hi{/t:1}` → `{t:1}{/t:1}`). Same well-formedness
   * precondition as `shiftedPairs`.
   */
  emptiedPairs: number[];
  /**
   * True when at least one tag/var/glossary/escape slot failed to round-trip, or
   * a well-formed tag pair shifted its enclosed tokens or was emptied of text.
   */
  hasIssues: boolean;
}

/** Count non-overlapping occurrences of the literal `needle` in `haystack`. */
function countLiteral(haystack: string, needle: string): number {
  let count = 0;
  for (
    let i = haystack.indexOf(needle);
    i !== -1;
    i = haystack.indexOf(needle, i + needle.length)
  ) {
    count += 1;
  }
  return count;
}

/** True when two token multisets differ in any key's count (order-independent). */
function multisetsDiffer(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? 0) !== (b[key] ?? 0)) return true;
  }
  return false;
}

/**
 * Compare a backend-translated, still-masked string against the plan and
 * report any placeholder slot the backend lost, invented, or duplicated, plus
 * two tag-pair-integrity checks (`shiftedPairs`, `emptiedPairs`). The engine
 * uses this to log warnings and surface them through the LQA logger so reviewers
 * notice broken markup before it ships.
 */
export function verifyMaskedTranslation(maskedTranslated: string, plan: MaskPlan): MaskDiagnostics {
  const planFor = (kind: SlotKind): Map<number, unknown> =>
    kind === 't'
      ? plan.tags
      : kind === 'v'
        ? plan.vars
        : kind === 'g'
          ? plan.glossary
          : plan.escapes;

  const seen = new Set<string>();
  const openCounts = new Map<string, number>();
  const unknown: SlotRef[] = [];
  // Same grammar as the shared MASK_TOKEN_SOURCE, but with capture groups for
  // the slash/kind/id so the scan can classify each token. Built fresh (own
  // `lastIndex`) and only `.exec`-driven within this call.
  const slotRe = /\{(\/?)([tvge]):(\d+)\}/g;
  for (let m = slotRe.exec(maskedTranslated); m !== null; m = slotRe.exec(maskedTranslated)) {
    const closing = m[1] === '/';
    const kind = m[2] as SlotKind;
    const id = Number(m[3]);
    const key = `${kind}:${id}`;
    seen.add(key);
    // Count only opening tokens: a well-formed tag has one `{t:N}` and one
    // `{/t:N}`, so counting both would flag every tag as duplicated.
    if (!closing) openCounts.set(key, (openCounts.get(key) ?? 0) + 1);
    if (!planFor(kind).has(id)) unknown.push({ kind, id });
  }

  const missing: SlotRef[] = [];
  const addMissing = (kind: SlotKind, ids: Iterable<number>): void => {
    for (const id of ids) if (!seen.has(`${kind}:${id}`)) missing.push({ kind, id });
  };
  addMissing('t', plan.tags.keys());
  addMissing('v', plan.vars.keys());
  addMissing('g', plan.glossary.keys());
  addMissing('e', plan.escapes.keys());

  const duplicated: SlotRef[] = [];
  for (const [key, count] of openCounts) {
    if (count <= 1) continue;
    const [kind, idStr] = key.split(':') as [SlotKind, string];
    const id = Number(idStr);
    if (planFor(kind).has(id)) duplicated.push({ kind, id });
  }

  // Tag-pair-integrity checks. For each source tag pair that is well-formed in
  // the output — exactly one `{t:N}` open and one `{/t:N}` close, open before
  // close — compare its strictly-enclosed content against what was recorded at
  // mask time (`TagSlot.enclosed` / `enclosedHasText`). The one-open/one-close
  // gate is what "skip pairs already flagged missing/duplicated/unknown" reduces
  // to for a plan id: a missing pair has zero opens, a duplicated pair has two+,
  // and a plan id is never unknown. These checks detect a token migrating across
  // the boundary (shifted) or the pair losing all its text (emptied); they do
  // NOT — and cannot — catch plain text drifting across the boundary while the
  // token layout is unchanged.
  const shiftedPairs: number[] = [];
  const emptiedPairs: number[] = [];
  for (const [id, slot] of plan.tags) {
    const openTok = `{t:${id}}`;
    const closeTok = `{/t:${id}}`;
    if (countLiteral(maskedTranslated, openTok) !== 1) continue;
    if (countLiteral(maskedTranslated, closeTok) !== 1) continue;
    const openIdx = maskedTranslated.indexOf(openTok);
    const closeIdx = maskedTranslated.indexOf(closeTok);
    if (openIdx > closeIdx) continue; // close precedes open — malformed nesting
    const enclosedOut = maskedTranslated.slice(openIdx + openTok.length, closeIdx);
    if (multisetsDiffer(slot.enclosed, maskTokenMultiset(enclosedOut))) shiftedPairs.push(id);
    if (slot.enclosedHasText && !hasTextOutsideMaskTokens(enclosedOut)) emptiedPairs.push(id);
  }

  return {
    missing,
    unknown,
    duplicated,
    shiftedPairs,
    emptiedPairs,
    hasIssues:
      missing.length > 0 ||
      unknown.length > 0 ||
      duplicated.length > 0 ||
      shiftedPairs.length > 0 ||
      emptiedPairs.length > 0,
  };
}

/**
 * Flattens mask diagnostics into the `mask-mismatch` LQA issues the engine
 * feeds to the gate. Shared by every dispatch path (single, batch, LQA
 * corrective retry) so the issue wording stays identical.
 */
export function maskDiagnosticsToIssues(diagnostics: MaskDiagnostics): LQAIssue[] {
  const issues: LQAIssue[] = [];
  for (const item of diagnostics.missing) {
    issues.push({ type: 'mask-mismatch', detail: `missing {${item.kind}:${item.id}}` });
  }
  for (const item of diagnostics.unknown) {
    issues.push({ type: 'mask-mismatch', detail: `unknown {${item.kind}:${item.id}}` });
  }
  for (const item of diagnostics.duplicated) {
    issues.push({ type: 'mask-mismatch', detail: `duplicate {${item.kind}:${item.id}}` });
  }
  for (const id of diagnostics.shiftedPairs) {
    issues.push({
      type: 'mask-mismatch',
      detail: `tag pair {t:${id}} encloses different placeholders than in the source`,
    });
  }
  for (const id of diagnostics.emptiedPairs) {
    issues.push({ type: 'mask-mismatch', detail: `tag pair {t:${id}} lost its text content` });
  }
  return issues;
}
