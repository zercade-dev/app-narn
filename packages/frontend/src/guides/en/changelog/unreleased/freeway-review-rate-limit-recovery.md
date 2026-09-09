AI review runs on free providers now recover from a rate limit instead of failing the whole batch.

- A translation review or source review that hits a provider's rate limit waits out that provider's own cool-down and retries, rather than reporting every item in the batch as failed.
- If the provider is still out of capacity, the run moves the batch to another free provider once, and sets the exhausted one aside for the rest of the run.
- Reviews running on your own provider key are unchanged: a busy provider is still handled by retrying smaller and smaller batches.
