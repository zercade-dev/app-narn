Multi-language projects now spend fewer free requests and route each language to a free model measured to be good at it.
- Every bundled free model — Google, OpenRouter, Groq and DeepL — was benchmarked per language (24 test strings judged for quality and format compliance); routing prefers measured-strong pairings.
- Model/language pairs measured weak (for example one small model on Vietnamese) are avoided on demanding strings and deprioritized elsewhere.
- Languages that share a winning model are batched into one request, so multi-language runs spend fewer free requests.
- A Groq model the provider retired (Llama 3.3 70B) was removed from the rotation — requests to it could only fail.
