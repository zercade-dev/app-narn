NARN Freeway routes smarter: the free-model catalog was re-benchmarked for translation quality and shared provider quotas are now tracked as one budget.

- Every bundled free model was scored on a multi-language translation benchmark; rankings now reflect measured quality, with retired or unreliable models removed and stronger ones added.
- OpenRouter's account-wide free allowance is treated as a single shared pool, so Freeway no longer over-plans against it, and a rate limit on one model briefly cools the whole pool instead of burning retries.
- DeepL's measured quality earned it a big promotion in the routing order, and its monthly character allowance is saved for when daily free quotas run out; per-minute rate limits now pause a provider briefly instead of for the rest of the day.
- Freeway now decides per model whether to request structured output from the provider, based on tested support — no configuration needed, and one model's quirks never break another's run.
