Rich mode in the Compare tab no longer floods the app with one tag-parsing request per row on the page.

- Formatting is parsed a few cells at a time, so opening a large page in Rich mode no longer slows the rest of the app down.
- Turning a page, changing the compared language or leaving the tab drops the parses still waiting instead of letting them finish in the background.
- Dropping them is never treated as a failure, so cells you come back to still show their formatting rather than raw markup.
