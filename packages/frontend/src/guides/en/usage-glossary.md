# Glossary Tab

## Overview

The **Glossary** tab keeps terminology consistent. A project can hold several glossaries; each is a list of source terms with a translation per target language. Glossaries are matched against entries automatically and the matched terms are passed to the model during translation.

## Glossaries and terms

* Create a glossary with **New glossary**; rename or delete it later.
* **Enable** or **disable** a glossary — a disabled glossary is ignored during import and translation.
* Add terms with a **source**, a **translation per language**, and optional **notes**.
* Mark a term **constant** when it must come out exactly as written in the glossary, such as a character name or a brand — see *Constant terms* below.
* A glossary has two tabs: **Terms** lists its terms, and **Matches** lists the entries that contain them, where you can assign the glossary to entries or remove it.

Some glossaries are **read-only** (managed globally) and contribute terms without being editable here.

## Constant terms

* A constant term is **never sent to the translation engine**. NARN swaps it for a placeholder before translating and puts the glossary translation in its place afterwards, so a character name like *Diluc* always comes out exactly as written in the glossary.
* **Letter case matters.** Only text spelled exactly like the term is protected: *Venti* (the character) is, *a venti latte* is not. Capitals count as the same spelling: *VENTI* in a heading is protected too, and its translation is written in capitals. Any other spelling is sent to the engine as an ordinary glossary hint, marked as a name, so it can tell the name from the everyday word.
* **The engine can't change the word.** Because it never sees the term, it can't decline it or make other words agree with it: in languages such as Russian, Korean or Turkish, a constant name always appears in its base form. Keep constant for names and codes that must stay fixed.
* Leave names that are also everyday words as normal terms, since titles and labels often capitalise them (*Gaming Settings*). In the bundled glossaries, character names, nations and the product names Genshin Impact, Miliastra Sandbox and Miliastra Wonderland are constant, except Gaming, Amber, Razor, Sucrose, Prune, Traveler and Wanderer.

## Import and export

Import terms from **CSV** or **TBX** — a preview shows how many terms are added, updated, or in conflict before you apply. Export the glossary back to **CSV** or **TBX**.

## Generate with AI

* **Generate glossaries** scans the source text and proposes glossaries of recurring names and custom terms. It runs in the background — track it in the **Activity** tab and review the suggestions before creating them. You can pass existing glossaries as "already known" so the model doesn't repeat them.
* **Generate translations** fills in target translations for terms that are still missing them.

## DeepL

If you translate with DeepL, use **Push to DeepL** to upload glossary terms. After editing a pushed glossary the tab shows *Re-push required* — push again to update DeepL.

## Per-entry control

From the Translations tab you can choose which glossaries are **enabled** for an individual entry.
