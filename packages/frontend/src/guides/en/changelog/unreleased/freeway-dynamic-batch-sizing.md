Freeway now sizes each request dynamically: bigger batches on strong models with scarce daily quotas, smaller ones on abundant models, adapted to your strings' length.
- Short strings pack more per request, so tight daily allowances (like Gemini Flash's) translate far more of your file.
- A batch that comes back malformed is retried in halves on the same model instead of failing every string in it.
- Rescued batches now keep their results — failed strings no longer stay failed after a successful retry elsewhere.
