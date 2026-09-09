Relink retranslation now protects the placeholders in your source text, and flags a translation that comes back missing one.

- Placeholders like `{0:playerName}`, inline styling tags and line breaks are hidden behind protected tokens before the string is sent to the AI, so a model updating an existing translation can no longer rename, translate or drop one.
- A reply that loses or invents a placeholder is saved with a blocking quality issue instead of quietly replacing a working translation with a string your game cannot format.
- This is the same protection ordinary translation runs have always had; relink was the one route that sent its text through unprotected.
