# Routing Tab

## Overview

The **Routing** tab is where you define **routing rules** that decide which module and model handles each entry. There is no "translate everything with one module" button here — translations are started from the **Translations** or **Compare** tab, and routing rules decide how each selected entry is dispatched once you do.

## Routing rules

Rules are evaluated in priority order; the first one that matches an entry wins. Each rule can match on:

* **Sources** — the source/origin labels of imported entries.
* **Entry length limit** — apply only to entries at or under a character count.
* **Target language** and **categories**.

For matched entries the rule sets the **module** (and optional **model** and **reasoning effort** override) plus optional prompt hints (character, tone, gender, notes). Add rules with **Add Rule**, then **Save** — runs use the *saved* rules, so unsaved edits in the editor have no effect. You can keep several named **rule groups** and switch between them (switching is locked while a run is in progress).

## Batch grouping

The Routing tab also has a **Batch grouping** control — the same per-project default shown on the Config tab, with a matching **Ignore batch size limit** toggle. It keeps related entries in the same provider request across translation, judge, and source-review runs.

## Starting a translation

1. Select entries in the **Translations** or **Compare** tab.
2. Open the **Translate…** dialog from there — it offers re-translate, memory, and per-run grouping options, then starts the run.
3. Watch progress, retries, and failures in the **Activity** tab.
