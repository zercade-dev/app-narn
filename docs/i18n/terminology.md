# NARN terminology for translators

Domain vocabulary that must be rendered consistently across every namespace and every
locale. Translating one of these two ways in two namespaces is a bug, not a style choice.

**How to use this file:** before translating a namespace, read it. When a string contains a
term below, use the agreed rendering for your locale. If your locale's cell is empty, you
are the first translator to reach it — decide it, fill it in, and use it consistently from
then on. If the agreed rendering does not fit a particular sentence, change the sentence,
not the term.

Every per-locale cell starts empty on purpose. Nobody fills a column in advance; you fill
the row for the term you just met, in the locale you are working in, in the same change
that introduces the wording — so the file is always a record of decisions actually taken,
never a prediction. Use the Notes column for anything the next translator would otherwise
have to rediscover: a declension that forced a different word, a term you deliberately
left in English, an acronym you expanded.

## Never translated

`NARN` · provider and module names (`DeepL`, `Copilot`, `OpenRouter`, `Anthropic`,
`Gemini`, `OpenAI`, `DeepSeek`, `GitHub Copilot`) · module ids and module-instance ids
(`generic-ai`, `openai:default`) · model ids · vault key names (`OPENAI_API_KEY`) ·
the language code `pseudo-test` · CSV header tokens · version numbers · anything inside
`{{…}}`.

The product name appears in English as `narn`, `Narn` and `NARN`. That inconsistency is
known and unresolved; copy whatever spelling the source string contains, and never
translate or re-case it.

`LQA` is an industry acronym; keep it as `LQA` unless the target language has an
established localized form, and record that decision in its row below.

## Surface names

A surface — a tab, a page, a tool — does **not** have one key. Its name is written out
two or three times, in different namespaces: the tab label, the page or section title
the tab opens, and sometimes a sidebar item or a guide topic. Twelve of the seventeen
tab labels are duplicated verbatim at another key today. On top of that, other strings
name the surface inside a sentence — "…from the Translations tab", "Track it in the
Activity tab", "restore it from the Backup tab".

> **The rule:** every key that names the same surface gets the **same rendering**, and
> prose that mentions the surface repeats that rendering verbatim. Translating the tab
> label and its page title differently is the single highest-frequency drift risk in
> this app, because the two are never on screen at the same moment.

The names to keep in step (tab label first, then its other homes):

| Surface | Keys that must agree |
| --- | --- |
| Orphans | `strings:tabs.orphans` · `orphans:title` |
| Glossary | `strings:tabs.glossary` · `glossary:title` |
| Sharing | `strings:tabs.sharing` · `collab:sharing.pageTitle` |
| Stage details | `strings:tabs` (stage-details) · `stage-details:title` |
| Text Styler | `strings:tabs` (color-text) · `colorText:title` · `sidebar:colorText` |
| Translation AI review | `strings:tabs` (review-translation-ai) · `review:translationAi.title` |
| Source AI review | `strings:tabs` (review-source-ai) · `review:sourceAi.configTitle` |
| Activity | `strings:tabs.runs` · `strings:guide.topicActivity` |
| Quality | `strings:tabs.quality` · `strings:guide.topicQuality` |

(Where a key path contains a hyphen it is given as namespace plus the sub-key in
brackets, so the citation checker does not read it as a truncated key.)

The guide topics under `strings:guide` are a third home for most of these names, and
nearly all of them append the word "Tab" — `strings:guide.topicGlossary` is "Glossary
Tab", `strings:guide.topicMultiLanguage` is "Translations Tab". Translate the surface
name identically there and add your locale's word for "tab"; do not take the chance to
rename the surface. (`topicActivity` and `topicQuality` have no "Tab" suffix — they are
the exceptions, listed in the table above.)

Three English details to know about:

- The Orphans tab is called the "Relink tab" by `config:fullReplaceOrphanNotice`. That is
  a stale English name, not a second tab. Use your rendering of **Orphans**.
- The tab now labelled "Translations" was once "Multi-language Text". Several strings
  still said so until an English source review retired the name; if you meet that
  phrasing anywhere, it is stale — use **Translations**.
- The Activity **page** title is deliberately longer than its tab label:
  `strings:runs.title` is "Translation Activity" where `strings:tabs.runs` is just
  "Activity". Keep that relationship — expand the page title, do not shorten it to
  match, and do not invent a third wording.

## Terms

Grouped by area for a first read-through. To look one term up, jump to its heading
or search the file for the word.

### Content and structure

#### project

**Means here:** the top-level container for one game or product's text: its imported entries, its languages, its routing rules, glossaries, backups and runs. Created from the sidebar; almost everything else in the app is scoped to exactly one project.

**Part of speech in UI:** noun. The verb for making one is "create", never "open a new project".

**Example:** `sidebar:createProjectTitle` — "Create project"

**Not:** file, folder, workspace, job, board. "Workspace" is a *wider* scope — see below — so the two must not share a word.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### workspace

**Means here:** everything above the project level: global module defaults, module instances, the credential vault, translation memory and templates. A setting labelled "workspace" applies to every project at once.

**Part of speech in UI:** noun, usually attributive ("workspace setting", "workspace-wide").

**Example:** `config:workspaceSettingsTitle` — "Workspace Settings"

**Not:** project, account, environment, desktop, dashboard. Never the same word you chose for "project" — several strings contrast the two ("Use workspace setting" vs the project value).

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### entry

**Means here:** one row of imported source content: a key, its source text, its metadata (categories, tone, translator context, source labels) and its translation in each target language. This is the unit the whole app counts.

**Part of speech in UI:** noun. **Canonical term.** The `logs` namespace narrates about the same object using the word "string" ("Queued {{total}} strings for translation"); translate that occurrence with your *entry* rendering too, so the UI counts one thing, not two.

**Example:** `category:countLabel_other` — "{{count}} entries"

**Not:** string, row, line, record, item, key, cell, field. "Row" in particular reads as a table artefact rather than a piece of content.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### source text

**Means here:** the original-language text of an entry, exactly as imported. The app never rewrites it during translation; only source review proposes changes to it.

**Part of speech in UI:** noun phrase.

**Example:** `review:sourceText` — "Source text"

**Not:** original, original text, source string, base text, input, raw text. Keep the same word for "source" here as in "source language" and "source label" only if that reads naturally — if not, prefer clarity per string and record what you chose.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### translation

**Means here:** the target-language text stored on an entry for one language — whether produced by a module, reused from translation memory, or typed by a person. Also the name of the main editing tab.

**Part of speech in UI:** noun. The verb is "translate". "Translations" plural is the tab label.

**Example:** `strings:tabs.strings` — "Translations"

**Not:** target, target text, localization, version, output, result. The tab was formerly labelled "Multi-language Text"; that name is dead in English and must not be revived in any locale.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### source label

**Means here:** a tag recorded on an entry saying which imported file or origin it came from. Routing rules can match on it, and the routing UI shortens the column heading to "Sources".

**Part of speech in UI:** noun phrase.

**Example:** `generation:fieldSources` — "Source labels"

**Not:** source language, source text, source file, origin, provenance, tag, label alone. A translator who renders this as "source" full stop makes it indistinguishable from the two entries above it.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### achievement

**Means here:** a game achievement, whose name and description are two linked entries. They carry their own UTF-8 byte limits and their own LQA check, and routing rules can target them by achievement type.

**Part of speech in UI:** noun, frequently attributive ("achievement name", "achievement description").

**Example:** `strings:achievement.label` — "Achievement"

**Not:** trophy, award, badge, unlock, accomplishment, medal. Use whatever the target locale's game platforms call these, but pick one and keep it across the routing, LQA and string-table strings.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### inline tag

**Means here:** markup that lives inside the text itself — `{{…}}` placeholders, colour and formatting tags, literal `\n` escapes. It must survive translation unchanged or the string renders wrong in game.

**Part of speech in UI:** noun phrase.

**Example:** `logs:translation.maskMismatch` — "Formatting tags didn't survive translation into {{language}}."

**Not:** label, marker, keyword, hashtag, category, annotation. Distinct from "source label" (metadata *about* an entry) — this is inside the text.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### translator context

**Means here:** a free-text note a person attaches to an entry explaining how the string is used, sent to the model with the job. Three different things are called "context" in English: this, the entry metadata bundle ("Include entry context"), and a model's token budget ("context window").

**Part of speech in UI:** noun phrase.

**Example:** `strings:compare.editContext` — "Edit translator context"

**Not:** comment, note, description, background, remark — and above all not the same word you use for "context window", which is a model capability, not authoring input.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

### Languages

#### source language

**Means here:** the single language the project's entries are written in. One per project, set in Config.

**Part of speech in UI:** noun phrase.

**Example:** `config:sourceLanguage` — "Source Language"

**Not:** original language, base language, default language, main language, from-language. Whatever you pick has to pair naturally with "target language" — the two appear side by side.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### target language

**Means here:** a language the project translates into. A project has many, chosen in Config.

**Part of speech in UI:** noun phrase.

**Example:** `config:targetLanguages` — "Target Languages"

**Not:** destination language, output language, to-language, foreign language, locale. "Locale" is wrong: the app tracks languages, not regional formatting.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### reference language

**Means here:** an already-translated language a person displays beside the one they are editing, and can optionally send to the model as extra context. It is a reading aid, never a second source.

**Part of speech in UI:** noun phrase.

**Example:** `strings:compare.translateUseReferenceNone` — "Use reference language as context"

**Not:** source language, pivot language, secondary language, comparison language, model language. Calling it a pivot implies the app translates *through* it, which it does not.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### writable language

**Means here:** in a shared project, a language a specific collaborator is permitted to edit. Everything outside their writable languages is read-only for them.

**Part of speech in UI:** adjective + noun.

**Example:** `collab:sharing.columnLanguages` — "Writable languages"

**Not:** editable / assigned / granted / available / permitted used interchangeably. Any one of them may be the right adjective in your language — the bug is alternating between them, because the same permission is named in a table column, in lock messages and in the invite dialog.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### Pseudo Test

**Means here:** the synthetic language `pseudo-test`: a free offline QA pass that rewrites source text with accents, extra length and ⟦brackets⟧ so hardcoded strings, overflow and truncation show up. Not a real locale and never a real translation target.

**Part of speech in UI:** proper noun (a language entry and a guide topic).

**Example:** `strings:guide.topicPseudoTest` — "Pseudo Test"

**Not:** test mode, dummy language, fake translation, mock, sample, demo. The language code `pseudo-test` itself is never translated, anywhere.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

### Runs and engines

#### run

**Means here:** one execution of a background engine — translation, AI review, source review, glossary generation, category generation — with a status, progress, a cost and a row in Activity.

**Part of speech in UI:** noun. It is **never a verb** in this UI: the verbs are "translate", "start", "generate". Where English says "Run" as a standalone label it is still the noun (the run picker in the Compare toolbar).

**Example:** `logs:translation.runQueued` — "Translation run queued — position {{position}}."

**Not:** job, task, execution, process, session, operation, batch. "Batch" especially: a run contains many batches.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### Activity

**Means here:** the per-project tab listing every run with its status, progress, cost and per-entry detail. It is a history of runs, not a feed of user actions.

**Part of speech in UI:** proper noun (a tab name and a guide topic).

**Example:** `strings:tabs.runs` — "Activity"

**Not:** history, log, logs, feed, events, timeline, jobs. "Log" is taken by the live server-log panel, which is a different surface.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### batch

**Means here:** the group of entries packed into a single request to a model. Batch mode ("by language" / "by entry") and batch size control how many entries share one request.

**Part of speech in UI:** noun.

**Example:** `config:module.batchMode` — "Batch mode"

**Not:** group, chunk, lot, package, set, bulk. Keep it distinct from "bulk operation", which is a user action over selected rows, and from "run", which contains batches.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### batch grouping

**Means here:** the setting deciding which entries are *allowed* to share a batch — by category, by glossary, by tone, or by category and glossary — so the model sees related entries together.

**Part of speech in UI:** noun phrase.

**Example:** `config:batchGroupingLabel` — "Batch grouping"

**Not:** batch mode (a different setting entirely), sorting, ordering, clustering, classification. If your rendering of "batch grouping" and "batch mode" end up identical, change one.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### AI review

**Means here:** the umbrella name for the AI quality passes: over finished translations (Translation AI review) and over the source text (Source AI review). Also the badge on a run that has been reviewed.

**Part of speech in UI:** noun phrase.

**Example:** `strings:runs.judgeBadge` — "AI review"

**Not:** AI check, AI control, AI verification, proofreading, correction, revision, audit. Reserve your "check" word for LQA checks: those are deterministic rules, this is a model's opinion. The two systems do meet — a judge's issues are filed alongside the LQA results for the same entry — but they are never the same thing to a reader, so they must not share a word.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### judge

**Means here:** the engine that scores completed translations for accuracy, fluency, terminology and tone, and can propose a corrected translation. It surfaces to the user as "Translation AI review"; "judge" appears mainly as a verb in explanatory copy.

**Part of speech in UI:** verb in prose ("will judge the latest completed translation run"). The *feature* is called "AI review" — do not introduce "the judge" as a noun in a locale where English does not use it.

**Example:** `review:translationAi.description` — "Have an AI judge score completed translations for accuracy, fluency, terminology and tone."

**Not:** referee, arbiter, magistrate, court, sentence, condemn. Many languages' first-choice word for "judge" is the legal one; pick the evaluative sense.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### source review

**Means here:** the AI pass that inspects the **source text** for problems in five independently toggleable categories: typo, grammar, terminology, clarity and unsafe wording. Report-only: it never writes a translation, and applying its suggestion edits the source.

**Part of speech in UI:** noun phrase (also the tab "Source AI review").

**Example:** `review:sourceAi.configTitle` — "Source AI review"

**Not:** proofreading, revision, source correction, source check, editing. It must not be confusable with the *translation* review — the two tabs sit next to each other.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### finding

**Means here:** one issue the source review reports against one entry, carrying a type — typo, grammar, terminology, clarity or unsafe — and a description of what is wrong. An entry can carry several findings; the corrected source text is **not** attached to each one. There is at most ONE suggestion per entry, a single unified rewrite of the whole source that addresses all of its findings together.

**Part of speech in UI:** noun, usually plural. The five type labels live at `review:sourceAi.findingTypo`, `findingGrammar`, `findingTerminology`, `findingClarity` and `review:sourceAi.findingUnsafe` — translate all five, and keep them distinct from the LQA check names.

**Example:** `review:sourceAi.findingsTitle` — "Findings"

**Not:** error, bug, result, discovery, observation, remark — and not the word you use for an LQA "issue", which is a machine verdict rather than an AI opinion.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### suggestion

**Means here:** a proposed change the user reviews and then applies or discards: a judge's rewritten translation, a source review's corrected source text, a generated glossary term, a proposed category assignment.

**Part of speech in UI:** noun. The action on it is "apply" (or "discard"), not "accept" or "save".

**Example:** `category:reviewTitle` — "Review suggestions"

**Not:** proposal, recommendation, advice, hint, tip, idea. Keep one word across the judge panel, the glossary generator and the category generator — they are the same interaction.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### needs review

**Means here:** a flag set on a single translation meaning a person should look at it. Its counterpart action is "Mark as reviewed". It is a state, not an instruction to the app.

**Part of speech in UI:** adjectival state; used as a filter label, a row badge and inside bulk-action confirmations.

**Example:** `strings:compare.needsReviewFilter` — "Needs review"

**Not:** to review, pending, unverified, unchecked, requires revision, for approval. Whatever you choose has to work identically in the filter, the badge and "Flag all as needs review".

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

### Modules, providers, credentials

#### module

**Means here:** one translation backend the app can call — `openai`, `deepl`, `pseudo` and the rest. It is what every "choose what to translate with" picker selects and what a routing rule points at. In practice a rule stores a *named instance* of a module (see below) for the modules that support instances, and the bare module id only for `deepl` and `pseudo`, which cannot have instances. The user-facing word for all of it is still **module**.

**Part of speech in UI:** noun. **Canonical term** for the thing you pick before an AI call.

**Example:** `config:routing.labelModule` — "Module"

**Not:** plugin, extension, engine, connector, driver, add-on, service. The app has no plugin system — "plugin" would promise something that does not exist. See "provider" for the three English strings that call this same control something else.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### module instance

**Means here:** a named configuration of a base module, identified as `<base>:<slug>` (for example `openai:default`), with its own credentials, model and settings. One base module can have several. A picker offers named instances, plus modules that cannot have instances at all (`deepl`, `pseudo`), plus a base module that is still instance-less; what it does not offer is a base module that already has instances, because its configuration has moved into them.

**Part of speech in UI:** noun phrase; often shortened to "instance" once "module" is established in the sentence.

**Example:** `config:instances.formTitle` — "New instance of {{base}}"

**Not:** copy, clone, profile, account, connection, occurrence, configuration. The instance id itself (`generic-ai:my-ollama`) is a literal identifier and is never translated. English shows the user the word "slug" in exactly one string, `config:instances.slugReserved` — there it names the second half of that identifier, not a UI concept, so translate it as the identifier fragment it is (the field itself is labelled "Instance id").

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### provider

**Means here:** the outside company or service behind a module — OpenAI, Anthropic, DeepL, Google. Correct in strings about API keys, pricing, rate limits and per-request caps.

**Part of speech in UI:** noun.

**Example:** `config:enableModuleHelp` — "Add an AI or translation provider to use across your projects."

**Not:** a synonym for "module". Three English strings label a *module-instance* picker "Provider" — `colorText:assistant.instanceLabel`, `stage-details:chatInstanceLabel` and `config:routing.simplePlaceholder`. That is a known English inconsistency awaiting a copy fix. Translate those three as written ("provider"), and do not let them drag your rendering of *module* toward *provider* anywhere else.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### model

**Means here:** the specific AI model a module instance calls (`gpt-5-mini`, `claude-sonnet-4`, a local Ollama tag). Chosen under the module, overridable per routing rule, and priced per million tokens.

**Part of speech in UI:** noun.

**Example:** `config:routing.labelModelOverride` — "Model override"

**Not:** module, provider, engine, mode, version, template. In several languages the natural word for "template" is also "model" — if that is yours, choose a different word for **template**, not for this. Model ids themselves are never translated.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### routing rule

**Means here:** one ordered condition-to-module mapping. The first rule that matches (in ascending priority order) decides which module translates a given entry into a given language; if none matches, the job fails.

**Part of speech in UI:** noun phrase.

**Example:** `config:routing.title` — "Routing Rules"

**Not:** filter, condition, mapping, policy, redirect, forwarding, route. Avoid any word that suggests *network* routing — this is content routing.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### rule group

**Means here:** a named, switchable set of routing rules. Exactly one group is active per project, and it cannot be switched while translations are running.

**Part of speech in UI:** noun phrase.

**Example:** `config:routing.groupSelectLabel` — "Rule group"

**Not:** ruleset, folder, category, profile, collection, preset — used interchangeably. Any of these may be the best word in your language; alternating between two of them is the failure. Do not reuse the word you chose for "category" or for "batch grouping".

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### credential vault

**Means here:** the password-encrypted store holding the API keys modules use. It is locked until the user types the password each session; while locked, every AI action fails and offers an unlock prompt.

**Part of speech in UI:** noun phrase; shortened to "vault" where the context is unambiguous ("Vault locked", "Unlock vault").

**Example:** `vault:statusLabel` — "Credential vault"

**Not:** safe, keychain, keystore, password manager, wallet, locker, storage. One word has to carry "credential vault", "vault locked", "unlock vault" and "vault password" — check all four read well before deciding.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### credential

**Means here:** one secret a module needs — an API key, token or endpoint — stored in the vault under a fixed key name.

**Part of speech in UI:** noun, usually plural ("Credentials missing").

**Example:** `config:credentialsMissingChip` — "Credentials missing"

**Not:** password, login, account, access data, identity, authorization. The vault *key names* themselves (`OPENAI_API_KEY`, `GENERIC_API_KEY__MY-OLLAMA`) are literal identifiers and are never translated.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

### Quality

#### LQA

**Means here:** Linguistic Quality Assurance: the deterministic check suite that runs on every translation. It is a separate system from the AI review — rules, not a model judgement — though the judge does file its issues into the same per-entry LQA results, always at warning severity, so an AI opinion can never fail the gate.

**Part of speech in UI:** acronym, used attributively — "LQA checks", "LQA gate", "LQA results", "LQA retries".

**Example:** `config:lqa.title` — "LQA Checks"

**Not:** QA, QC, quality control, linguistic testing. Keep it as `LQA` unless your language has an *established* localized form in the localization industry; if you do localize it, record the expansion in your row and use the same acronym in every LQA string, including the filter chip.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### quality gate

**Means here:** the point where LQA verdicts are applied: an issue at blocking severity fails the gate and can trigger one automatic retry, while warnings are reported only.

**Part of speech in UI:** noun phrase; English also uses bare "the gate" once "quality checks" has been said.

**Example:** `config:lqa.description` — "Quality checks run on every translation. Blocking issues fail the gate and can trigger an automatic retry; warnings are reported only."

**Not:** door, gateway, portal, barrier, firewall, filter. Physical-door readings are the common trap; pick the process-control sense.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### check

**Means here:** one named LQA rule — inline tag equality, length overflow, glossary adherence, number parity and so on — each configurable to blocking or warning severity.

**Part of speech in UI:** noun. The severity words are "blocking" and "warning"; keep both distinct from "error".

**Example:** `quality:checkLabels.overflow` — "Length overflow"

**Not:** test, control, verification, validation, inspection, rule. Use the same word in "quality check", "LQA checks" and each individual check name.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### overflow

**Means here:** a translation longer than the entry's allowed ratio of the source length — it would not fit the space available in game. Configured as an "overflow ratio" (default 1.75) and checked at the gate.

**Part of speech in UI:** noun; also attributive ("overflow ratio", "overflow only", "ignore overflow").

**Example:** `config:lqa.checks.overflow.name` — "Length overflow"

**Not:** excess, surplus, spill, flood, overrun, simply "too long". Keep it clearly different from **length limit** below — one is a ratio, the other a hard cap, and both appear in the same checks list.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### length limit

**Means here:** a hard per-language character or UTF-8 byte cap imposed by the game editor; a translation exceeding either bound is flagged. The same phrase also names the routing-rule condition on source length.

**Part of speech in UI:** noun phrase.

**Example:** `config:routing.labelMaxLength` — "Entry length limit"

**Not:** max size, character count, quota, restriction, boundary, limitation. Do not reuse your **overflow** word: a length limit is absolute and set by the game, an overflow is relative to the source.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

### Terminology assets

#### glossary

**Means here:** a named list of terms with an approved translation per language, attached to a project and sent to the model as binding terminology. Can also be pushed to DeepL.

**Part of speech in UI:** noun.

**Example:** `strings:tabs.glossary` — "Glossary"

**Not:** dictionary, vocabulary, lexicon, word list, index, terminology base. If your locale's CAT tools have a settled word for this, use it — but use it for **glossary** only, not also for "translation memory".

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | glosario | Masculine. Already used throughout the shipped `glossary` namespace; "diccionario" is wrong here. |
| fr | glossaire | Masculine. Already used throughout the shipped `glossary` namespace. |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### glossary term

**Means here:** one row of a glossary: a source word or phrase plus its approved translation in each active language. A term missing any active language is flagged and excluded from matching and assignment.

**Part of speech in UI:** noun; shortened to "term" inside the Glossary tab.

**Example:** `glossary:totalTerms` — "Total terms:"

**Not:** word, expression, keyword, concept, item — and never **entry**, which is reserved for string entries. "Add a term" and "{{count}} entries" must not collide.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | término | Masculine. Shortened to "término" alone inside the Glossary tab, exactly as English shortens "glossary term" to "term". Never "entrada", which is reserved for _entry_. |
| fr | terme | Masculine. Shortened to "terme" alone inside the Glossary tab. Never "entrée", which is reserved for _entry_. |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### translation memory

**Means here:** the store of approved translations, reused automatically for identical source text across every project. Approving is the only way a translation gets in — nothing a run produces is stored here until a person approves it (`config:tm.browserEmpty` states this to the user). Whether a stored translation is then reused, and how exact the match must be, is the project's memory policy. An industry concept (TM), with its own workspace page.

**Part of speech in UI:** noun phrase.

**Example:** `sidebar:translationMemory` — "Translation Memory"

**Not:** cache, history, archive, database, saved translations — and not bare "memory", which reads as RAM (`logs:vault.credentialsEvicted` genuinely means RAM). Use your locale's established CAT-tool term if one exists.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### approve

**Means here:** to store a translation into translation memory so it can be reused later, and mark it reviewed at the same time. It is a promotion, not an edit — the text does not change. This is the only route into translation memory, which is why the word matters: if your rendering reads as "confirm" or "save", the user has no way to tell this action from the three around it.

**Part of speech in UI:** verb ("Approve to memory", "Approved {{count}} translations to memory").

**Example:** `strings:bulk.approveSelected` — "Approve to memory"

**Not:** accept, validate, confirm, authorize, publish, mark as done. Keep it distinct from "apply" (accept a suggestion), "mark as reviewed" (clear a flag) and "save" (persist an edit) — all four exist in the same bulk bar.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### category

**Means here:** a content label assigned to entries, grouping them by kind of text. Used to filter, to match routing rules, and to keep related entries in one batch. Generated by AI or assigned by hand.

**Part of speech in UI:** noun. The tab label is singular ("Category"); the page title is plural ("Categories") — that is deliberate.

**Example:** `strings:tabs.category` — "Category"

**Not:** tag, group, type, class, genre, section, folder. Do not reuse your word for "rule group" or for "source label".

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### tone

**Means here:** a per-entry note on register or voice ("formal", "playful"), set in the Compare tab, matchable by routing rules and passed to the model. One value per entry.

**Part of speech in UI:** noun.

**Example:** `config:routing.labelTones` — "Tones"

**Not:** sound, pitch, tonality, mood, colour — the acoustic and visual senses are the trap. "Style" and "voice" are also wrong here, because they read as the model's writing style rather than an authoring instruction. If your language has no word separate from "register", use "register" consistently.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

### Maintenance

#### orphan

**Means here:** an entry that a **full-replace** CSV import found missing from the imported file. It keeps its translations, is excluded from every AI run, is hidden from the strings list, and waits in the Orphans tab to be relinked or deleted. Only a full-replace import orphans anything — a merge import never does — and an entry stops being an orphan automatically if a later import (in either mode) carries it again.

**Part of speech in UI:** noun; also "orphaned" as an adjective ("{{count}} orphaned", "an orphaned string").

**Example:** `orphans:title` — "Orphans"

**Not:** obsolete, deleted, missing, unused, abandoned, lost, stray, dangling. If a literal "orphan" reads oddly in your language, choose one figurative noun and then use it for the tab title, the count chip, the confirm dialog and the log lines alike — do not describe the state differently in each place.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### relink

**Means here:** to move an orphan's translations onto a different, existing entry, optionally followed by an AI pass that updates them to the new source text.

**Part of speech in UI:** verb; also used as a surface name ("resolve them later in the Relink tab").

**Example:** `orphans:relink.title` — "Relink orphan"

**Not:** reconnect, reattach, re-associate, remap, restore, merge, migrate — used interchangeably. One verb has to serve a row button, a dialog title, a confirm step and an import warning.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### backup

**Means here:** a verifiable `.zip` of one project (its config, entries and glossary) stored on the server and restorable from the Backup tab.

**Part of speech in UI:** noun. The verb is "create a backup", never "to backup".

**Example:** `backup:createSection` — "Create backup"

**Not:** copy, save, archive, export, dump. Keep it separate from **export** (which downloads a JSON of everything) and from **snapshot** below.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### snapshot

**Means here:** an automatic backup taken immediately before a risky operation — a CSV import, a re-translation, accepting AI suggestions — so the operation can be undone. English also calls these "restore points".

**Part of speech in UI:** noun.

**Example:** `config:importSnapshotNote` — "A safety snapshot was taken just before this import ({{date}}). You can restore it from the Backup tab."

**Not:** photo, screenshot, image, capture, instant. It must stay distinguishable from **backup**, because several strings use both in one sentence. (`config:templatesDescription` also uses "snapshots" loosely to describe templates — there it means a saved configuration, not a restore point.)

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### template

**Means here:** a saved, reusable project configuration — languages, routing rules, module settings and glossary selections — offered when creating a new project. There is also a routing-rule template. It is never a *text* template.

**Part of speech in UI:** noun.

**Example:** `config:templatesTitle` — "Project Templates"

**Not:** model, pattern, blueprint, preset, sample, form, boilerplate. **"Model" is the dangerous one**: in several Romance and Slavic languages it is the obvious word for template, and it is already taken by the AI model. Pick something else.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

### Collaboration

#### collaborator

**Means here:** a person invited into someone else's project. They may edit only their writable languages, and their runs use their own credentials and routing rules rather than the owner's.

**Part of speech in UI:** noun.

**Example:** `collab:join.description` — "Enter an invite code to join someone else's project as a collaborator."

**Not:** contributor, participant, partner, guest, editor, colleague, user. Not interchangeable with **member** — see below.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### member

**Means here:** anyone with access to a project, the owner included. It is the row type of the Members table in the Sharing tab. Every collaborator is a member; the owner is a member but not a collaborator.

**Part of speech in UI:** noun.

**Example:** `collab:sharing.membersTitle` — "Members"

**Not:** collaborator (narrower), user, participant, account, person, team member. Two distinct words are required, because "Members" and "collaborators" appear in adjacent strings on the same page.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

### Product surfaces

#### stage

**Means here:** a playable level in the game. "Stage details" is the tab for a stage's name, gameplay details and description. It is game content — never a phase of a process or a step in a workflow.

**Part of speech in UI:** noun.

**Example:** `stage-details:title` — "Stage details"

**Not:** phase, step, stage of a process, progress level, platform, scene, theatre stage. This is the single most likely mistranslation in the whole app: almost every language's default reading of "stage" is the process one.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### Text Styler

**Means here:** the workspace tool for applying colour and formatting tags to game text, with an AI assistant that can style a selection for you.

**Part of speech in UI:** proper noun (a product surface name).

**Example:** `sidebar:colorText` — "Text Styler"

**Not:** text editor, formatter, colour tool, rich text editor, style editor — used interchangeably. Translate the name once and use exactly that in the sidebar item, the tab label and the tool's own title.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### guide

**Means here:** the built-in documentation section, organised into topic pages grouped by task.

**Part of speech in UI:** noun (a sidebar item, and the target of every "read the guide" link).

**Example:** `sidebar:guide` — "Guide"

**Not:** help, manual, documentation, tutorial, handbook, FAQ — used interchangeably. Any of them may be the right word; using two of them is the bug.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### changelog

**Means here:** the page listing what changed in each released version of the app.

**Part of speech in UI:** noun.

**Example:** `sidebar:changelog` — "Changelog"

**Not:** history, news, updates, release notes, versions, log, journal. Version numbers (`v1.56.0`) are never translated.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | | |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |
