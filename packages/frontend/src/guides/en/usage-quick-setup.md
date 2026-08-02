# Quick Setup

## Overview

The full path for a new project: enable providers, import your entries, configure glossaries and routing, translate, and review. Steps marked *(Optional)* improve quality but aren't required for a first translation — skip them on a first pass and come back later.

## 1. Enable providers and store credentials

1. Open **Global Config** and **enable a module** for each provider you want (Anthropic, OpenAI, DeepL, and so on). A module can have several **named instances** — useful for two configs of the same provider with different keys or defaults.
2. Provider credentials are stored in the encrypted **credential vault** — set it up on first use and unlock it once per session. See the *Credential Vault* guide for how it works.
3. Pick a **model** (and optional **reasoning effort**) per module or instance. Cheaper models translate worse, so expect some trial and error to find your sweet spot. Watch **reasoning effort** — on thinking models it can multiply billing quickly.

## 2. Create the project and import entries

Create a project, set its **source language**, then use **Import CSV** in the **Data** tab to load your source entries (and any translations the file already has).

## 3. *(Optional)* Review your source text first

Run **Source AI review** over the source language before translating — fixing typos and unclear phrasing here benefits every translation made afterward. If a fix changes an entry that already had translations, the old translations land in the **Orphans** tab — **relink** them, with optional re-translation.

## 4. *(Optional)* Enable glossaries

In the **Glossary** tab, enable the glossaries that apply to your project. Auto-apply matches terms as **whole words, case-insensitively** — inflected forms (plurals, conjugations) won't be picked up. Translating with **DeepL**? Push glossaries to it with **Push to DeepL** (top right), and re-push after editing.

## 5. Set up routing

Add **routing rules** in the **Routing** tab to map entries to a module, then **Save** — runs use the saved rules only. For a single-provider setup, just use the matching entry in **Templates**. This step is required: an entry with no matching rule fails translation with a *"no route"* error.

## 6. *(Optional)* Build glossaries from your own content

Grow your glossaries before bulk translation: add terms manually, run **Generate glossaries** over the whole source, or — more targeted — select good candidate entries in **Translations** and use **Generate Glossary from Selection** (include existing translations). Use a capable model here; glossary quality compounds across everything translated afterward.

## 7. *(Optional)* Iterate quality in Compare first

Before a full translation run, use the **Compare** tab to dial in one language you can personally judge:

- Refine each entry's **context** (character, tone, notes) and glossaries until the translation reads right. Context is stored per entry, not per language, so the work carries over to every other language automatically.
- Since you're iterating entry by entry, a cheap or free model is fine here — for example a free Gemini key (see the *Google AI (Gemini)* guide), added as its own **module instance** with routing pointed at it temporarily. The free tier has a daily cap, so prefer grouped requests.
- Happy with the results? Translate the full batch once with the same settings to confirm it holds up in bulk.

## 8. Translate

Two ways to run the real translation:

- **Translations** — select entries and **Translate Selected** to cover every target language at once.
- **Compare** — one language at a time, optionally with an already-reviewed language as **reference** context.

For a full project, one language at a time with a reviewed reference language usually wins: the AI review afterward stays focused on a single language. Watch progress in the **Activity** tab.

Batching is automatic by default; for a small project with many short entries, a custom batch size of **0** (whole language in one request) can work better with a capable model.

## 9. Review the run

Pick one:

- Trigger an **AI review** for the completed run from the **Activity** tab.
- Review by hand in **Manual review** or **Compare**.
- Approve everything as-is and review later.
