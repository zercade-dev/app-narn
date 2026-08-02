# Config Tab

## Overview

The **Config** tab holds the translation policy for the selected project: per-module model choices, translation-memory reuse, batch grouping, quality (LQA) checks, and project management. Its **languages** and **CSV import/export** now live on the separate **Data** tab. Provider credentials are not set here — they live in the **credential vault** (see the *Configure Module* guides and **Global Config**).

## Languages (on the Data tab)

Set the **source language** and the **target languages** to translate into on the **Data** tab. The active target set drives every other tab — the entry columns, routing rules, and quality checks all follow it.

## Import and export CSV (on the Data tab)

CSV import and export also live on the **Data** tab:

* **Import CSV** loads source entries and any existing translations. A safety snapshot is taken automatically just before each import, so you can roll back from the **Backup** tab.
* Rows that can't be parsed cleanly (a quote immediately followed by a comma) are dropped and reported, rather than written as column-shifted data.
* **Export CSV** downloads the project; you can choose languages and whether to include the translator-context column.

## Modules and models

Enable providers once in **Global Config**. Here in Config you choose, per project, the **model** and **reasoning effort** for each enabled module — or leave them set to *Inherit from global config*. Which module actually runs for a given entry is decided by **routing rules** (see the *Routing* guide).

## LQA checks

The **LQA Checks** panel configures the quality gate that runs on every translation: toggle individual checks (tag equality, length limit, overflow, glossary adherence, forbidden terms, regex assertions, and more) and set each to **Blocking** or **Warning**. Blocking issues fail the gate and can trigger one automatic retry; warnings are reported only.

## Batch grouping

**Batch grouping** keeps related entries (by category and/or glossary) together in the same request so the model sees them in context. You can set a project default and override it per run.

## Project management

The **Danger Zone** lets you **Duplicate** the project (config and entries, never secrets) or **Delete** it permanently.
