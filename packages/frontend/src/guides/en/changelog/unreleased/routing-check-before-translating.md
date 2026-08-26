Starting a translation with no routing rule for the language now tells you straight away, instead of running and failing.

- A run whose target language has no routing rule is stopped before it starts, so nothing is queued and no time is wasted.
- The message names the languages that have no rule and takes you to the Routing tab in one click.
- This applies everywhere you can start a translation: the multi-language text view, the Compare tab, and the Review tab.
- Runs where only some strings are unmatched are untouched — those still run, and report what they skipped afterwards.
