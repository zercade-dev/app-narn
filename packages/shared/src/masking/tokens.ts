/**
 * Canonical regex SOURCE STRING for the masking tokens the M17 TranslationMasker
 * emits. Provided as a raw source string (not a pre-built RegExp object) so each
 * consumer can compile it with whatever flags it needs (`g` for replace-all
 * sweeps, none for a single `.test()`) without sharing `lastIndex` state across
 * call sites.
 *
 * Today several modules (deepl, pseudo, M17) hand-write this pattern inline;
 * exporting one canonical definition lets later units converge on it.
 */

/**
 * The M17 mask token, e.g. `{t:0}` / `{/t:3}` / `{v:1}` / `{g:2}` / `{e:4}`. The
 * letter selects the slot kind: `t` tag, `v` variable, `g` glossary, `e` escape.
 * A leading `/` marks a closing tag token (`{/t:0}`).
 */
export const MASK_TOKEN_SOURCE = String.raw`\{\/?[tvge]:\d+\}`;
