# Questions & Answers

## Overview

Short answers to the questions that come up most often, each pointing at the guide that covers the topic properly. This list grows as new questions come in, so if yours isn't here yet, the topic list on the left goes into far more detail.

## What gets translated

### Which entries does a run translate, and which does it skip?

Only entries that still need it. For every entry and every target language you selected, the run translates that pair when it has no translation yet — or when you explicitly asked to **re-translate**. A pair that already has text is left alone, so re-running a translation never overwrites work you have already done or reviewed.

An entry, or a single entry-and-language pair, is left out when any of these is true:

* **It is already translated**, and you didn't ask to re-translate.
* **You marked it Ignored.** That takes it out of *every* AI operation — translation, AI review, source review, and glossary or category generation. Ignored entries stay visible in the table with a badge, so the decision is always visible and always reversible.
* **It is orphaned** — it dropped out of your last CSV import and is waiting in the [Orphans](guide:usage-orphans) tab.
* **It was imported with `Need translation? = FALSE`.**
* **The target is the source language.** An entry is never translated into its own source language, even if you select that language as a target.
* **There is nothing to translate.** Empty text, a number like `3.14` or `100%`, a hex colour like `#ff8800`, or a string that is only tags and placeholders such as `<b>{count}</b>` are copied through unchanged, without calling a provider.

An entry filled from [Translation Memory](guide:usage-translation-memory) also never reaches a provider — the stored translation is reused instead. It still counts as translated.

### Can I re-translate something that is already translated?

Yes, but you have to ask for it, since runs skip finished pairs by default. Tick **re-translate** in the *Translate…* dialog for a batch, or use **Re-translate** on a single row in the [Compare](guide:usage-compare) tab or the manual review queue.

### Why did an entry come back with its source text unchanged?

Almost always because there was nothing to translate — the last bullet in the skip list above. Numbers, colours and pure markup are recognised and copied through, because a model can only echo them back or corrupt them. Nothing was sent to a provider and nothing was charged for those entries.

## Providers, models and routing

### How do I change the model used for translations?

There are three levels, and the one you want depends on how widely the change should apply:

1. **For a provider everywhere** — open **Global Config**, find the module, and pick its **model** there. Every project set to *Inherit from global config* follows it.
2. **For one project** — open that project's [Config](guide:usage-config) tab and set the **model** (and **reasoning effort**) for the module, instead of inheriting.
3. **For some entries only** — open the [Routing](guide:usage-routing) tab, switch to **Advanced**, and set a **model override** on a routing rule. Only entries matched by that rule use the override.

The Routing tab's simple view picks a **provider**, not a model: it deliberately runs whatever model that module is already configured with.

### Can different languages use different providers?

Yes. Switch the [Routing](guide:usage-routing) tab to **Advanced** and add one rule per language — or per category, or per entry length. Rules are checked in priority order and the first one that matches an entry wins. If you would rather not choose at all, point a single rule at [NARN Freeway](guide:usage-freeway) and let it pick a free model for each batch.

### Translation won't start and says there is no routing rule. What now?

A run only starts when every language in it has somewhere to go. If a target language matches no rule, the run is refused before anything is sent and the message names the language. Open the [Routing](guide:usage-routing) tab and add a rule that covers it — the simple provider selector covers every language at once — then start the run again.

## Running, failures and recovery

### Some strings failed. Do I have to run everything again?

No. Use **Retry failed** on the run in the [Activity](guide:usage-activity) tab: it re-runs only the entry-and-language pairs that errored, and leaves everything that succeeded alone.

### Why do I have to unlock the vault again?

The [credential vault](guide:usage-vault) is unlocked per session rather than permanently, and it also re-locks itself after a stretch of inactivity. Unlock it and carry on. If a run was in flight when it locked, use **Retry failed** on that run afterwards.

### I re-imported my CSV and some translations vanished. Are they lost?

No. When a re-import no longer contains an entry, its translations are kept in the [Orphans](guide:usage-orphans) tab rather than deleted. **Relink** an orphan onto the entry that replaced it to move the translations across; only empty languages on the target are filled, so nothing is overwritten. A snapshot is also taken automatically just before every import, so you can roll the whole project back from the [Backup](guide:usage-backup) tab.
