NARN Freeway now paces requests to each free provider's per-minute limit, so large runs no longer fail partway through with rate-limit errors.

- Free models that only allow a handful of requests per minute are no longer overwhelmed by a large multi-language run — one earlier run lost 142 entries this way.
- When a model's allowance for the current minute runs out, NARN sets it aside and comes back to it seconds later, instead of treating it as unavailable for the rest of the day.
- Other available models keep working in the meantime, so a run keeps making progress instead of stalling.
