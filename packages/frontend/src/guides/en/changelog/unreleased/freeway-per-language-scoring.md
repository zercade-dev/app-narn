The free-model router now knows which models are strong in each language, routes every language to a model proven good at it, and batches several languages into one request.
- Each free model was benchmarked per language with a judged quality score; routing prefers measured-strong pairings.
- Model/language pairs that produced unusable output are never routed anymore.
- Languages that share a winning model are batched into one request, so multi-language runs spend fewer free requests.
