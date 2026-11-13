# Quick Setup

## Overview

New to NARN? The short path below takes you from nothing to an exported translation in five steps. The in-app guided setup walks you through the same steps, and you can skip it and pick it up again later — **Continue setup** in the sidebar resumes where you left off, and you can restart it from this Guide. Everything after the short path is for when you want more control.

## The short path

1. **Create your vault password.** Your provider keys are encrypted with it — see the [Credential Vault](guide:usage-vault) guide. On the cloud version, steps 1 and 2 happen together on the vault page.
2. **Add one free key.** A Google AI key is the easiest start — get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), or choose **Use my own provider**. [NARN Freeway](guide:usage-freeway) then picks free models for you.
3. **Create a project and import your text.** Create a project, then in the **Data** tab choose the source language and the languages to translate into, and use **Import CSV**.
4. **Translate.** In **Translations**, select all entries and click **Translate**. NARN Freeway picks free models for you; follow progress in **Activity**.
5. **Export.** Download your translated file from the project.

New users start in **Simple mode**, which shows only Config, Data, Translations and Activity (plus Guide, Settings and **Provider keys**). Switch between **Simple** and **Advanced** from the top bar or in Settings whenever you like.

## When you want more

These steps live in **Advanced mode** and improve quality or give you finer control. Steps marked *(Optional)* aren't needed for a first translation — skip them and come back later. The first time you open Routing, Glossary, Quality, Compare or Translation AI review in Advanced mode, a short tour is offered; you can start any tour again from this Guide, or turn the offers off in Settings.

## Add more providers and credentials

1. Open **Global Config** and **enable a module** for each provider you want (Anthropic, OpenAI, DeepL, and so on) from the **Enable a module** list — DeepL is listed by name, while the AI providers appear as **Add another … instance…**, which creates the provider's first instance. A module can have several **named instances** — useful for two configs of the same provider with different keys or defaults.
2. Provider credentials are stored in the encrypted **credential vault** — set it up on first use and unlock it once per session. See the *Credential Vault* guide for how it works.
3. Pick a **model** (and optional **reasoning effort**) per module or instance. Cheaper models translate worse, so expect some trial and error to find your sweet spot. Watch **reasoning effort** — on thinking models it can multiply billing quickly.

## *(Optional)* Review your source text first

Run **Source AI review** over the source language before translating — fixing typos and unclear phrasing here benefits every translation made afterward. If a fix changes an entry that already had translations, the old translations land in the **Orphans** tab — **relink** them, with optional re-translation.

## *(Optional)* Enable glossaries

In the **Glossary** tab, enable the glossaries that apply to your project. Auto-apply matches terms as **whole words, case-insensitively** — inflected forms (plurals, conjugations) won't be picked up. Translating with **DeepL**? Push glossaries to it with **Push to DeepL** (top right), and re-push after editing.

## Set up routing

Open the **Routing** tab and pick your provider from the selector it opens on — that sends every entry in the project to it, which is all a single-provider setup needs. Want different providers per language, category, or entry length? Switch to **Advanced** and add **routing rules** there instead. Your choice is saved for you either way. A project with no rules at all sends everything through NARN Freeway, so this step is optional to begin with. Once a project has rules, an entry that matches none fails translation with a *"no route"* error.

## *(Optional)* Build glossaries from your own content

Grow your glossaries before bulk translation: add terms manually, run **Generate glossaries** over the whole source, or — more targeted — select good candidate entries in **Translations** and use **Generate Glossary from Selection** (include existing translations). Use a capable model here; glossary quality compounds across everything translated afterward.

## *(Optional)* Iterate quality in Compare first

Before a full translation run, use the **Compare** tab to dial in one language you can personally judge:

- Refine each entry's **context** (character, tone, notes) and glossaries until the translation reads right. Context is stored per entry, not per language, so the work carries over to every other language automatically.
- Since you're iterating entry by entry, a cheap or free model is fine here — for example a free Gemini key (see the *Google AI (Gemini)* guide), added as its own **module instance** with routing pointed at it temporarily. The free tier has a daily cap, so prefer grouped requests.
- Happy with the results? Translate the full batch once with the same settings to confirm it holds up in bulk.

## Translate in bulk

Two ways to run the real translation:

- **Translations** — select entries and **Translate Selected** to cover every target language at once.
- **Compare** — one language at a time, optionally with an already-reviewed language as **reference** context.

For a full project, one language at a time with a reviewed reference language usually wins: the AI review afterward stays focused on a single language. Watch progress in the **Activity** tab.

Batching is automatic by default; for a small project with many short entries, a custom batch size of **0** (whole language in one request) can work better with a capable model.

## Review the run

Pick one:

- Trigger an **AI review** for the completed run from the **Activity** tab.
- Review by hand in **Manual review** or **Compare**.
- Approve everything as-is and review later.
