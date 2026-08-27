NARN Freeway runs are much faster: it now sends many translation requests at once instead of three, paced to each provider's limits.

- Freeway keeps several providers busy in parallel, staying within what each one allows per minute rather than leaving most of that allowance unused.
- Providers that limit by tokens rather than by request count are now paced correctly too.
- Retries, split batches and provider switchovers all count towards pacing, so a run that hits trouble no longer speeds up and runs into rate limits.
- When a run is waiting on a provider's limit, the run details now say so instead of looking stalled.
