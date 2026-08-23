Freeway got sharper after a full real-game translation run: cleaner output, smarter pacing, and fewer wasted free requests.

- Stray formatting codes that a provider sometimes adds to translations (like non-breaking space markers) are now cleaned out automatically, and a new quality check flags any that slip through.
- A provider's per-minute rate limit is no longer mistaken for a used-up daily quota, so affected strings resume in about a minute instead of waiting until the next day.
- Free-tier pacing now also accounts for how many tokens a response is expected to cost, not just the number of requests, avoiding rejections on providers that cap tokens per minute.
- Color codes and strings made up only of markup or placeholders now skip translation entirely — there's nothing translatable in them.
- A translation that comes back too long for the game's UI now gets one automatic "make it shorter" retry.
- The Freeway panel now explains when your credential vault is locked, instead of showing every provider as missing its key.
