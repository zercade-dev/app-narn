Translations from GitHub Copilot no longer keep stray HTML codes in place of ordinary punctuation.

- A model that writes an apostrophe as `&#39;` or a space as `&nbsp;` now has those turned back into real characters before the translation is saved.
- Every other AI provider already did this, so the same model could give a clean result through one provider and a corrupted one through Copilot.
- Affected entries no longer raise the "HTML entity" quality warning, and exported text comes out clean.
- A code your source text genuinely contains is still left exactly as it is.
