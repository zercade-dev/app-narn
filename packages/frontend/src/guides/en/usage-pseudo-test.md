# Pseudo Test

## Overview

**Pseudo Test** is not a real language. It is a free, offline QA language that rewrites your source text into a deliberately mangled version, so you can load it into your game and see which strings break the interface — before a single real translation exists.

It costs nothing, needs no API key, and never sends anything to a provider.

## What it produces

`Save changes` becomes something like `⟦Şàvé çhàñgéş~~~~⟧`. Three things are happening at once, and each one exposes a different class of bug:

* **Accented letters.** Every letter is swapped for a look-alike with an accent. Any text still showing up as plain English in your game was never pulled into the string table — it is hardcoded, and no translator will ever be able to reach it.
* **Padding.** The text is stretched with `~` characters to roughly 1.4× its original length, simulating languages such as German that run long. Labels that overflow their buttons, wrap badly, or push the layout around show up immediately.
* **Brackets.** The result is wrapped in `⟦…⟧`. If either bracket is missing on screen, that string is being truncated.

Placeholders and markup tags in your text pass through untouched, so if one of them comes out mangled, that is a bug worth reporting rather than a layout problem.

## Using it

1. In the **Data** tab, tick **Pseudo Test** under *Target Languages* and save.
2. Run a translation as usual. Pseudo Test entries are always handled by the built-in pseudo generator — there is nothing to enable, no routing rule to write, and no cost. Your paid providers never see these strings.
3. Your real translations are safe: Pseudo Test text is stored in its own column and can never overwrite another language.

## Getting it into your game

In the export card, set **Export pseudo text as** to a language you are not currently shipping — German, say — then download the file and load it in the game with that language selected. The chosen language's column is filled with the Pseudo Test text for that one download only; nothing stored changes, and the real translations are still there next time you export.

When you are done testing, export again with the substitution set back to **No substitution**. A normal export never contains a Pseudo Test column — the pseudo text only ever reaches your game through the substitution above — so leaving Pseudo Test switched on does not affect the files you ship.

## When to use it

Run a pseudo pass early, before you commission any translation. Every layout bug it finds is one you fix once, instead of fifteen times after fifteen languages arrive.
