# Glossary Tab

## Overview

The **Glossary** tab keeps terminology consistent. A project can hold several glossaries; each is a list of source terms with a translation per target language. Glossaries are matched against entries automatically and the matched terms are passed to the model during translation.

## Glossaries and terms

* Create a glossary with **New glossary**; rename or delete it later.
* **Enable** or **disable** a glossary — a disabled glossary is ignored during import and translation.
* Add terms with a **source**, a **translation per language**, and optional **notes**.
* Mark a term **constant** when it must never be translated (brand names, codes). Constant terms are masked during translation so they pass through unchanged.

Some glossaries are **read-only** (managed globally) and contribute terms without being editable here.

## Import and export

Import terms from **CSV** or **TBX** — a preview shows how many terms are added, updated, or in conflict before you apply. Export the glossary back to **CSV** or **TBX**.

## Generate with AI

* **Generate glossaries** scans the source text and proposes glossaries of recurring names and custom terms. It runs in the background — track it in the **Activity** tab and review the suggestions before creating them. You can pass existing glossaries as "already known" so the model doesn't repeat them.
* **Generate translations** fills in target translations for terms that are still missing them.

## DeepL

If you translate with DeepL, use **Push to DeepL** to upload glossary terms. After editing a pushed glossary the tab shows *Re-push required* — push again to update DeepL.

## Per-entry control

From the Translations tab you can choose which glossaries are **enabled** for an individual entry.
