AI glossary and category generation can now run on NARN Freeway's free model pool, and background AI runs recover from rate limits instead of failing.

- Both the "Generate Glossary" and "Generate Categories" panels now offer NARN Freeway as a provider, spending free-tier quota the same way translation and review runs already do.
- A background run that hits a provider rate limit now moves to another free model once instead of failing the run.
- Free-pool selection now accounts for how much work a run will actually send, picking a bucket with room for it.
