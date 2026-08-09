# Routing Tab

## Overview

The **Routing** tab decides which module and model handles each entry. It opens on a single provider selector: pick a provider and every entry in the project goes to it. That is all most projects ever need.

Need more than one destination? Switch the tab to **Advanced** and the full rule builder appears, where routing can differ by target language, category, or entry length, and where you can keep several named rule groups. The tab remembers which of the two you last used. A project whose routing is richer than one provider always shows the builder, whichever mode you picked — an existing setup is never hidden from you.

Either way, this tab only decides *how* entries are dispatched. Translations are started from the **Translations** or **Compare** tab.

## Routing rules

Rules live in the **Advanced** view. They are evaluated in priority order; the first one that matches an entry wins. Each rule can match on:

* **Sources** — the source/origin labels of imported entries.
* **Entry length limit** — apply only to entries at or under a character count.
* **Target language** and **categories**.

For matched entries the rule sets the **module** (and optional **model** and **reasoning effort** override) plus optional prompt hints (character, tone, gender, notes). Add rules with **Add Rule**; every change is saved for you as you make it, so there is no **Save** button to remember. You can keep several named **rule groups** and switch between them (switching is locked while a run is in progress).

## Batch grouping

The Routing tab also has a **Batch grouping** control — the same per-project default shown on the Config tab, with a matching **Ignore batch size limit** toggle. It keeps related entries in the same provider request across translation, judge, and source-review runs.

## Starting a translation

1. Select entries in the **Translations** or **Compare** tab.
2. Open the **Translate…** dialog from there — it offers re-translate, memory, and per-run grouping options, then starts the run.
3. Watch progress, retries, and failures in the **Activity** tab.
