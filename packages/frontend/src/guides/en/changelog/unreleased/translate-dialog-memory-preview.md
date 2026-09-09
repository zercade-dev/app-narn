The Translate dialog's "already in translation memory" figure now appears quickly even when you select a whole project across many languages.

- Previously the estimate re-read your glossaries once for every string-and-language pair, so a large selection could leave the dialog waiting and slow the server for everyone else on it.
- The glossaries are now read once per language instead, which is exactly what a real translation run does.
- For very large selections the figure is now based on the first several thousand pairs rather than every last one, so it can read low. It stays an estimate either way — the run itself is unaffected.
