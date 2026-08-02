# Model confidence profiles

`packages/shared/src/model-confidence/profiles.ts` is a bundled, LLM-authored
snapshot (like the provider pricing snapshot) scoring every known chat model
for the five AI engine tasks. The frontend model picker combines a profile
with the live run context (entry count, prompt-size estimate, reasoning
effort) via `scoreModelConfidence` and shows a Confidence badge.

**Unknown models never get a score.** No profile ⇒ the picker shows an em
dash. Never add fuzzy matching; extend the `ids` alias list instead.

## Schema

One `ModelConfidenceProfile` per model family (see
`packages/shared/src/model-confidence/types.ts`):

- `ids` — lowercase, trimmed model ids + aliases, matched exactly. Keyed by
  model id, not module id, so future modules get scores for free when their
  ids overlap.
- `tasks` — 0–1 base quality per task (`translate`, `judge`, `source-review`,
  `glossary-gen`, `category-gen`). Omit a task the model shouldn't be scored
  for.
- `reliableBatchEntries` — entries the model handles reliably in ONE run;
  past it the score falls off smoothly (`(reliable/count)^0.6`).
- `effectiveContextTokens` — practical usable window (set it BELOW the
  advertised window; long-context quality degrades before the hard limit).
- `effortModifiers` — multiplier per reasoning effort (e.g. `{ low: 0.85 }`
  when low effort visibly hurts quality).
- `notes` — one-line English caveat shown in the tooltip.

## Rubric

- `0.95+` frontier tier: near-human translation, trustworthy judging.
- `0.85–0.94` strong daily driver.
- `0.7–0.84` budget tier: fine for straightforward strings.
- `0.5–0.69` weak: short/simple content only.
- `< 0.5` shows a "weak fit" warning — use sparingly, only for real mismatches
  (e.g. a nano model judging nuance).
- `reliableBatchEntries`: frontier ≈ 400–800, mid ≈ 150–400, small ≈ 80–150.

## Regeneration (on demand, by a Claude session)

1. Collect current model ids: `packages/shared/src/ai-sdk-provider/pricing-data/provider-pricing.json`
   (all four cloud providers) plus any known Copilot catalog ids. Skip
   non-chat models (tts / image / embedding / live / robotics / computer-use).
2. Add or update profiles per the rubric above; keep existing judgment calls
   unless there's a reason to change them. Bump
   `MODEL_CONFIDENCE_GENERATED_AT`; bump `MODEL_CONFIDENCE_SCHEMA_VERSION`
   only on shape changes.
3. Preserve the dataset's invariants — id uniqueness and value ranges among
   them. The automated suite that enforces them is maintained outside this
   repository.
4. Commit with the rest of the release; there is no CI automation for this
   (same discipline as the pricing snapshot).
