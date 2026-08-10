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
the language code `pseudo-test` · CSV header tokens · version numbers ·
anything inside `{{…}}`.

**Keyboard key names are not on that list — they are per-locale.** See the next section;
they are the one term class where "copy the English" is the wrong default.

The product name appears in English as `narn`, `Narn` and `NARN`. That inconsistency is
known and unresolved; copy whatever spelling the source string contains, and never
translate or re-case it.

`LQA` is an industry acronym; keep it as `LQA` unless the target language has an
established localized form, and record that decision in its row below.

## Keyboard key names

`Enter`, `Esc`, `Shift`, `Tab`, `Ctrl` and `Alt` name physical keys. The reader has to
find that key on the keyboard in front of them, so the only thing that matters is what
**their** keycap says.

> **The rule:** write the key name **as it is engraved on that locale's keyboard**. Keep
> the English word only where that locale's keycap is in fact English.

For the locales in this repo and the ones arriving next, the English word is often *not*
what is engraved: French AZERTY shows **Entrée**, **Échap** and **Maj**; Spanish shows
**Intro** and **Mayús**; German shows **Strg** for Ctrl and **Umschalt** (or the bare ⇧
glyph) for Shift. `Tab`, `Ctrl` and `Alt` happen to be engraved in English on most
European layouts, so those usually stay — but that is an observation about the keycap,
not a rule about the word. If you are unsure what a layout engraves, say so in the Notes
column rather than guessing; a wrong key name is an instruction to press a key that does
not exist.

**These strings are currently inconsistent, and that is a known defect for the backfill
to settle — not a rule.** Measured against the shipped files on 2026-08-09:

| Key | es | fr |
| --- | --- | --- |
| `strings:compare.cellEditTooltip` | `Enter` / `Esc` kept in English | `Enter` / `Esc` kept in English |
| `strings:compare.cellEditReviewedTooltip` | "pulsa **Enter**" — kept in English | "appuyez sur **Enter**" — kept in English |
| `common:webSearch.hint` | "Pulsa **Intro**" — localized | "Appuyez sur **Entrée**" — localized |
| `strings:compare.contextPlaceholder` | `Enter` / `Esc` kept, **Mayús** localized — mixed | **Entrée** / **Maj+Entrée** / **Échap** — localized |
| `strings:compare.tonePlaceholder` | `Enter` / `Esc` kept, **Mayús** localized — mixed | **Entrée** / **Maj+Entrée** / **Échap** — localized |

So both locales already localize some key names and not others, and es even mixes the two
inside a single string. Under the rule above the **localized** cells are the correct ones:
`common:webSearch.hint`, and the fr placeholders, are right and must not be "fixed" back
to English. The rows still in English are the ones that need changing — as one deliberate
sweep, so a tooltip and the placeholder next to it stop naming the same key two ways.
Until that sweep lands, match the locale's engraved name in anything you newly write; do
not propagate the English leftovers.

The same words appear in the same files as **verbs and nouns, and there they translate
normally** — "Enter your password", "Enter a valid hex color", "Enter edit mode", the
_Tab_ that means a tab in the UI. Eight of the fifteen `Enter`s in `en` are the verb. Read
the string, not the word: the key-name reading is the one that names a keystroke. This is
one reason key names are not in the guard's do-not-translate list, which is a per-term
count check and would demand every one of those verbs survive untranslated; the other is
the rule above — a locale that correctly writes **Entrée** would fail a check that
insisted on `Enter`.

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

Three more surfaces need the same discipline without appearing in that table, because they
have no second *title* key — they are named from **other namespaces in prose**, which is the
same drift risk by another route. **Compare** (`strings:tabs.compare`) is named by
`config:routing.tonesHint`; **Translations** (`strings:tabs.strings`) by
`config:routing.categoriesConfiguredHint`; **Backup** (`strings:tabs.backup`) by
`config:importSnapshotNote`. In each case the tab label is the authority and the prose
repeats it verbatim — which means the namespace naming the surface and the namespace owning
it are usually translated by different people, at different times.

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
  phrasing in a UI string, it is stale — use **Translations**. Published changelog
  entries are the exception: they are frozen release history and keep the name they
  shipped with.
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
| ru | проект | Masculine; gen. проекта, dat. проекту, instr. проектом, pl. проекты, gen. pl. проектов. The verb is «создать» — `sidebar:createProjectTitle` is «Создать проект», never «открыть новый проект». Deliberately not the word chosen for _workspace_, which several strings contrast with it in one sentence. |
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
| ru | рабочая область | Feminine phrase whose adjective agrees: «рабочей области» in the genitive, which is the form the attributive uses take — `config:workspaceSettingsTitle` is «Настройки рабочей области». The settled Russian for a scope above the project, and never «проект». |
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
| ru | запись | Feminine, 3rd declension: gen. записи, instr. записью, gen. pl. записей — counts run «1 запись / 2–4 записи / 5+ записей», so every counted family needs all four plural keys. «Запись» is the ordinary Russian for an _entry_ (in a dictionary, a journal, a log); the English ban on _record_ targets a database flavour «запись» does not carry here. Never «строка», which is both _string_ and _row_. Where `logs` narrates about "strings" it takes «запись» too. |
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
| ru | исходный текст | Masculine; gen. «исходного текста». «Исходный» is shared with «исходный язык» (_source language_) and reads naturally in both. _Source label_ deliberately switches to the noun «источник», so «исходный» always means the original-language material and «источник» always means where an entry came from. |
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

**Not:** target, target text, localization, version, output, result. The tab was formerly labelled "Multi-language Text"; that name is dead in the live UI and must not be revived in any locale. The one place it legitimately survives is the shipped changelog entries that announced those releases (`guides/en/changelog/v1.9.17.md` and four others) — release history is frozen, so leave it exactly as it stands there and do not "correct" it.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | traducción | Feminine — every standalone status word agreeing with it is feminine too. Already used throughout the shipped `strings` and `review` namespaces; the tab label is the plural "Traducciones". The verb is "traducir", and "re-translate" is "retraducir" (`review:retranslate`). |
| fr | traduction | Feminine. Already used throughout the shipped `strings` and `review` namespaces; the tab label is the plural "Traductions". The verb is "traduire", and "re-translate" is "retraduire" (`review:retranslate`). |
| de | | |
| it | | |
| pt-br | | |
| ru | перевод | Masculine — which matters for the _reviewed_ family above: unlike es/fr the implied noun is masculine, so the citation form and the agreeing form coincide. Gen. перевода, pl. переводы, gen. pl. переводов; the tab label is the plural «Переводы». The verb is «перевести» / «переводить», and _re-translate_ is «перевести заново» (`review:retranslate`). Never bare «память» for _translation memory_. |
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
| ru | метка источника | Feminine head noun «метка» (gen. метки, gen. pl. меток); plural «метки источников», and the shortened routing column heading _Sources_ is «Источники». Never «ярлык», which is a shortcut, and never «тег», which is reserved for _inline tag_. |
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
| ru | достижение | Neuter; gen. достижения, gen. pl. достижений. «Достижения» is what Steam and Xbox call these in Russian; PlayStation's «трофеи» is platform-specific and would not match the rest of the app. Attributive forms are genitive: «название достижения», «описание достижения». |
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
| ru | встроенный тег | Head noun «тег» (masculine, gen. тега, pl. теги, gen. pl. тегов). In running text it usually appears as «теги форматирования» — `logs:translation.maskMismatch` is «Теги форматирования не сохранились при переводе на {{language}}.» — but the head noun stays «тег» everywhere. Never «метка», which is taken by _source label_, and never «ярлык». |
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
| ru | контекст для переводчика | Head noun «контекст» (masculine, gen. контекста); the prepositional phrase does not inflect, so the term survives every case unchanged. The model capability is «контекстное окно» and the entry metadata bundle is «контекст записи» — three phrases sharing one head noun, exactly as English shares the word _context_. |
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
| ru | исходный язык | Masculine; gen. «исходного языка». Pairs with «целевой язык» (_target language_), and that pair is the settled wording in Russian CAT and MT interfaces — `config:sourceLanguage` is «Исходный язык». |
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
| ru | целевой язык | Masculine; plural «целевые языки», gen. pl. «целевых языков» — `config:targetLanguages` is «Целевые языки». Never «локаль»: the app tracks languages, not regional formats. |
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
| ru | справочный язык | Masculine. «Справочный» is the reading-aid sense, as in «справочник»; «опорный» and «промежуточный» were rejected because both imply the app translates *through* the language. Checked against _guide_, which is «Руководство» and not «Справка», so nothing else in the UI carries the справ- root. |
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
| ru | редактируемый язык | Participial adjective, agrees with its noun: «Редактируемые языки» in the column heading (`collab:sharing.columnLanguages`), «редактируемых языков» in the genitive. Use this one adjective in the table column, the lock messages and the invite dialog; the read-only counterpart is «только для чтения», not a second adjective. |
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
| ru | Псевдотест | Proper noun, written solid, capital on the first letter only. The language list around it is fully Cyrillic and lowercase («русский», «испанский»), so an English name would read as a stray token — `strings:guide.topicPseudoTest` is «Псевдотест». The concept is «псевдолокализация»; the language code `pseudo-test` is never translated. |
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
| ru | прогон | Masculine; gen. прогона, pl. прогоны, gen. pl. прогонов — «стоимость прогона», «статус прогона», «Прогоны» in Activity. «Запуск» was rejected: it shares a root with «запустить», which the UI needs as the separate action _start_, and «стоимость запуска» reads as the cost of starting rather than the cost of the run. Never «задача», «сеанс», «операция» or «партия». `logs:translation.runQueued` is «Прогон перевода поставлен в очередь — позиция {{position}}.» One thing to know and accept: «прогон» has an unrelated colloquial sense (a tall tale, a wind-up). It is suppressed by the technical collocations this app always supplies — «прогон перевода», «стоимость прогона», «Прогоны» in a table of statuses — and no candidate without a drawback exists, so this is a known cost rather than an oversight. |
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
| ru | Активность | Feminine, 3rd declension (gen. активности). Ten characters against the English eight, so it fits the tab; «История выполнения» does not. The page title stays longer than the tab exactly as in English: `strings:runs.title` is «Активность переводов», `strings:tabs.runs` is «Активность». Never «Журнал», which belongs to the live server-log panel. |
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
| ru | пакет | Masculine; gen. пакета, pl. пакеты, gen. pl. пакетов. Attributive takes the adjective — `config:module.batchMode` is «Пакетный режим», and batch size is «размер пакета». Bulk operations are «массовые операции», a different word, as in English. |
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
| ru | группировка пакетов | Feminine head noun «группировка», deliberately a different lexeme from the «группа» of _rule group_: gen. pl. «группировок» against «групп», so the two never coincide in any case. `config:batchGroupingLabel` is «Группировка пакетов», which shares no word with «Пакетный режим» (_batch mode_). |
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
| ru | ИИ-рецензия | Feminine; gen. «ИИ-рецензии». The prefix «ИИ-» does not inflect and follows the ordinary «ИИ-помощник» pattern. The two tabs are «ИИ-рецензия переводов» and «ИИ-рецензия исходного текста»; the run badge `strings:runs.judgeBadge` is the bare «ИИ-рецензия». «Рецензия» is an expert opinion, which is the distinction this file asks for: «проверка» is reserved for LQA checks and «вычитка» for a person reading a translation, so three concepts keep three words. |
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
| ru | оценивать | Verb: imperfective «оценивать», perfective «оценить» — the evaluative sense only, never «судить» or «судья». `review:translationAi.description` becomes «Пусть ИИ оценит завершенные переводы по точности, беглости, терминологии и тональности». The noun «оценка» is the score it produces, not a name for the feature, which is «ИИ-рецензия»; do not introduce «судья» as a noun. |
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
| ru | рецензия исходного текста | Built from _AI review_ and _source text_ on purpose, so the two passes read as siblings: `review:sourceAi.configTitle` is «ИИ-рецензия исходного текста». Report-only, so the verbs around it are «предложить» and «применить», never «исправить», and it must not be confusable with the translation pass on the neighbouring tab. |
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
| ru | замечание | Neuter; gen. замечания, gen. pl. замечаний. `review:sourceAi.findingsTitle` is «Замечания». The five type labels are «Опечатка», «Грамматика», «Терминология», «Ясность» and «Небезопасная формулировка». Keep «замечание» for the AI's opinion and «проблема» for an LQA verdict — that is the English _finding_ / _issue_ split, and both words are needed on the same entry. |
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
| ru | предложение | Neuter; gen. предложения, gen. pl. предложений. «Предложение» also means _sentence_ in grammar; that was weighed and accepted, because nothing in this app counts sentences (it counts «записи») and the actions beside it — «Применить», «Отклонить» — settle the reading. `category:reviewTitle` is «Просмотр предложений». One word across the judge panel, the glossary generator and the category generator. |
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

**The three surfaces, and the casing trap.** The filter label (`strings:filters.needsReview`, `strings:compare.needsReviewFilter`) is sentence case; the row badge (`strings:compare.cellNeedsReviewBadge`) is deliberately **lowercase**, because all three cell chips are lowercase 10px chips by design. That is the mirror of the "preserve uppercase where English uses it for layout" rule in the style guides: preserve the lowercase too. Same wording, different casing — do not "fix" the badge to sentence case, and do not let the casing difference tempt you into two different renderings.

**Gender, for languages that inflect adjectives (the "reviewed" family).** The implied noun is always *translation*, but the same word appears in three grammatical roles and they do not all agree the same way. The rule settled for es/fr, which every inflecting locale should follow:

- **Status token — invariant (masculine in es/fr).** The two adjectival cell badges `strings:compare.cellTranslatedBadge` / `cellReviewedBadge` render the stored status value itself, and `strings:contextMenu.clearReviewed` quotes that same token («revisado» / « révisé »). A quoted token is *mentioned*, not used, so it does not agree with anything: es "traducido"/"revisado", fr "traduit"/"révisé".
- **Explicit antecedent — agrees.** Where the string names the noun, agreement is forced: `strings:compare.cellMarkReviewedAria` is "Marcar la traducción de {{language}} como revisad**a**" / "Marquer la traduction {{language}} comme révisé**e**".
- **Elliptical action label — follows the token.** `strings:shortcuts.markReviewed` ("Mark as reviewed") has no visible noun and sets the status, so it takes the token form: "Marcar como revisado" / "Marquer comme révisé". Note that `strings:compare.markAllReviewed` ("Marcar todo como revisado") is *not* evidence for this — it agrees with masculine "todo", so dropping "todo" removes the antecedent rather than preserving it. The basis is the quoted status token above.
- **Counter-precedent to know about:** `vault:statusLocked` ships as "Bloqueada", agreeing with an invisible "bóveda". That is a standalone status word that *does* agree, so the rule is not "status words never inflect" — it is that a value quoted as a token elsewhere in the UI stays in its citation form. If your language has no such citation form, agree with *translation* everywhere and say so in your Notes cell.

"Needs review" itself sidesteps all of this in es/fr: it is a verb phrase, not an adjective, so it carries no gender.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | necesita revisión | Verb phrase, so no gender to agree. Sentence-cased in the filter ("Necesita revisión" — `filters.needsReview`, `compare.needsReviewFilter`), lowercase in the row badge ("necesita revisión" — `compare.cellNeedsReviewBadge`), same wording in both. "Marcar todo como necesita revisión" is the bulk form. For the related *reviewed* adjective see the gender rule above: token form "revisado", agreeing form "revisada". |
| fr | à réviser | No gender to agree. Sentence-cased in the filter ("À réviser"), lowercase in the row badge ("à réviser"), same wording in both. Note the capital À keeps its accent in the filter form. For the related *révisé* adjective see the gender rule above: token form "révisé", agreeing form "révisée". |
| de | | |
| it | | |
| pt-br | | |
| ru | на вычитку | A prepositional phrase, so there is no gender and no agreement anywhere — the same shape as fr «à réviser». Sentence-cased in the filter («На вычитку» — `strings:filters.needsReview`, `strings:compare.needsReviewFilter`), lowercase in the row badge («на вычитку» — `strings:compare.cellNeedsReviewBadge`), same wording in both; the bulk form is «Отметить всё на вычитку». «Вычитка» is a person reading a text and keeps «проверка» free for LQA checks — use the noun, not the verb «вычитать», which is a stress-only homograph of _subtract_. Be aware that «вычитка» is **narrower** than English _review_: it is proofreading, not accuracy checking against the source. That narrowing is accepted deliberately, and it is not a reason to reach for «на проверку» in some later namespace — one rendering, everywhere. For the related _reviewed_ family: the implied noun «перевод» is masculine, so the token form and the agreeing form do not diverge the way es/fr's do — badge «переведено» / «вычитано» (neuter short forms, the citation shape Russian status values take), explicit antecedent «Отметить перевод на {{language}} как вычитанный» (`strings:compare.cellMarkReviewedAria`), elliptical label «Отметить как вычитанное» (`strings:shortcuts.markReviewed`). |
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
| ru | модуль | Masculine inanimate, so the accusative equals the nominative («выбрать модуль»); gen. модуля, pl. модули, gen. pl. модулей. `config:routing.labelModule` is «Модуль». Read the hazard recorded on _model_ below before writing either word: the two are minimal pairs in every case and sit in adjacent controls. |
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
| ru | экземпляр модуля | Masculine head noun «экземпляр» (gen. экземпляра, pl. экземпляры), shortened to «экземпляр» once «модуль» is established, exactly as English shortens to _instance_. `config:instances.formTitle` is «Новый экземпляр {{base}}». The field labelled _Instance id_ is «Идентификатор экземпляра», and the _slug_ named in `config:instances.slugReserved` is «часть идентификатора», not a UI concept. Never «копия», «профиль» or «конфигурация». |
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
| ru | поставщик | Masculine animate, so the accusative equals the genitive («выбрать поставщика»); gen. pl. поставщиков. The native word rather than «провайдер», which in Russian reads as an internet or hosting company. `config:enableModuleHelp` is «Добавьте поставщика ИИ или сервиса перевода для использования во всех проектах.» The three English strings that mislabel a module-instance picker _Provider_ keep «Поставщик» as written and must not drag _module_ toward this word. |
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
| ru | модель | Feminine, 3rd declension: gen./dat./prep. модели, instr. моделью, pl. модели, gen. pl. моделей. **The one-letter hazard:** «модель» and «модуль» stay minimal pairs through the whole paradigm (модуля/модели, модулю/модели, модули/модели, модулей/моделей) and appear in adjacent labels, so proofread this pair rather than trusting the eye. _Template_ is «шаблон» precisely so it can never be «модель». |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### prompt

**Means here:** the instruction text the app composes and sends to a model with a job. A routing rule exposes prompt options and carries a badge when it overrides them. It is the app's own composed instruction, never something the user types into a chat.

**Part of speech in UI:** noun, frequently attributive ("prompt options", "prompt override").

**Example:** `config:routing.labelPromptOptions` — "Prompt Options"

**Not:** request, query, question, command, instruction on its own. Keep it distinct from an HTTP **request** — the same settings panel carries requests-per-second and request-timeout labels — and from the **search query** behind "No models match your search".

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | промпт | Masculine loanword; gen. промпта, pl. промпты. **Chosen by elimination, and the elimination is the part worth keeping.** The native candidate «запрос» is unavailable: it is already the HTTP _request_ in the same panel (`config:requestsPerSecondLabel` is «Запросов к поставщику в секунду», `config:requestTimeoutLabel` is «Таймаут запроса (секунды)») and it is additionally the _search query_ fixed by the _match_ row. Three senses of one word was one too many, so the loanword takes this one. The same elimination holds in every namespace that mentions rate limits — do not re-open it there. `config:routing.labelPromptOptions` is «Параметры промпта»; the rule badge `config:routing.promptBadge` is the lowercase «промпт». |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### reasoning effort

**Means here:** a provider parameter on a model — low, medium or high — controlling how much the model deliberates before answering. Set on a module instance and overridable per routing rule.

**Part of speech in UI:** noun phrase.

**Example:** `config:module.reasoningEffort` — "Reasoning effort"

**Not:** a NARN concept at all — it is the provider's own parameter, so prefer whatever your locale's AI tooling already calls it. Not "effort" in the sense of work done, and never confusable with a run's cost.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | уровень рассуждений | Masculine head noun «уровень» (gen. уровня). The parameter is a scale with visible low/medium/high values, so «уровень» is right where the calque «усилие рассуждения» is not. **«Уровень» carries three loads in this app and is safe here only because the genitive complement binds it.** The three: the game-level _stage_, a log severity, and this parameter. A bare «Уровень» is ambiguous between all three; «уровень рассуждений» is not, and the three surfaces never meet — a model setting, a game-content tab and a log filter. That is a documented overload, not an unnoticed collision, and it is why the LQA sense of _severity_ drops the noun instead of becoming a fourth. `config:routing.labelReasoningEffort` is «Переопределение уровня рассуждений». |
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
| ru | правило маршрутизации | Neuter head noun «правило» (gen. правила, gen. pl. правил); `config:routing.title` is «Правила маршрутизации», which the style guide already fixes. «Маршрутизация» is the only available Russian word and does carry a network flavour — the surrounding strings are about entries and languages, which settles the reading. Note that «правила маршрутизации» is also the genitive singular, so prefer «в этом правиле» to a bare genitive where a plural could be read. |
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
| ru | группа правил | Feminine head noun «группа» (gen. группы, gen. pl. групп); `config:routing.groupSelectLabel` is «Группа правил». Distinct from «группировка пакетов» (_batch grouping_) by lexeme rather than by modifier, and never «набор», «профиль» or the word chosen for _category_. |
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
| ru | хранилище учетных данных | Neuter — which is what the standalone status word agrees with: `vault:statusLabel` is «Хранилище учетных данных» and the locked status is «Заблокировано», the Russian counterpart of the es «Bloqueada» precedent recorded above. Shortened to «хранилище» where the context is clear, and all four surfaces read: «Хранилище заблокировано», «Разблокировать хранилище», «Пароль хранилища». The English ban on _storage_ targets a vague English word; «хранилище» is the established Russian for a security vault and nothing else in this app competes for it. «Сейф» and «кошелек» were rejected. |
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
| ru | учетные данные | Plural-only in Russian: there is no natural singular, so a single credential is still «учетные данные», or «ключ» where a count is genuinely needed. `config:credentialsMissingChip` is «Отсутствуют учетные данные». Never «пароль» — the vault password is one thing, the credentials it holds are another. Written without ё, per the style guide. |
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
| ru | LQA | Kept in Latin script and never declined: the Russian localization industry uses the English acronym and no established Cyrillic form exists, so this row is a deliberate do-not-translate. Attributive in every string — `config:lqa.title` is «Проверки LQA», and «Результаты LQA», «Повторы LQA» and the filter chip use the same three letters. Never «КЛК», and never «контроль качества», which is the _quality gate_. |
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
| ru | контроль качества | Masculine head noun «контроль» (gen. контроля). **Watch the transitivity:** «не проходит контроль качества» is correct only when the *translation* is the subject («перевод не проходит контроль качества»); when the subject is the issue, it has to be «не дают пройти контроль качества», because the issues are what stops the translation, not what is being checked. So `config:lqa.description` ships as: Проверки качества выполняются для каждого перевода. Блокирующие проблемы не дают пройти контроль качества и могут вызвать автоматический повтор; предупреждения только фиксируются. Bare _the gate_ is the bare «контроль». **Never «этап»** to render _at the gate_: it is one of the two process readings of _stage_ that the style guide bans outright, and it is easy to reach for. Where English writes "Used at LQA gate", drop the noun instead of finding a synonym — `config:overflowRatioDescription` ships «Используется при контроле качества LQA…». The process-control sense only: the style guide rules out «ворота» and «шлюз». It shares «качества» with «проверки качества» exactly as English shares _quality_, but the head nouns stay different, and the tab itself is just «Качество». |
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
| ru | проверка | Feminine; gen. проверки, pl. проверки, gen. pl. проверок — «проверки» is the genitive singular *and* the nominative/accusative plural, so «результат проверки» and «Проверки LQA» are spelled alike and the number has to come from the surrounding words. One word across «проверка качества», «Проверки LQA» and every individual check name — `quality:checkLabels.overflow` is «Переполнение по длине». Reserved: _AI review_ is «рецензия» and _needs review_ is «вычитка», so «проверка» always means a deterministic rule. **The two severity values are a matched pair of nouns: «Блокировка» and «Предупреждение»** (`config:lqa.severityBlocking`, `config:lqa.severityWarning`). The adjective pair «блокирующая»/«предупреждающая» was rejected because it needs an implied feminine antecedent the reader fills as «проверка», and «предупреждающая проверка» is not idiomatic — only one member of the pair would read well, and a select whose two options are different parts of speech is worse than either. Nouns are symmetrical, need no antecedent, and match the English register. **The adjective stays correct wherever a real noun is present** — `config:lqa.description` says «Блокирующие проблемы…», and the glossary-adherence description says «сделайте проверку блокирующей». That is the same use/mention split the _needs review_ row records: a value shown as an option is a token, a modifier attached to a visible noun agrees with it. Both stay apart from «ошибка». |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### severity

**Means here:** how hard an LQA check fails — blocking or warning. Set per check; the value decides whether the gate fails and an automatic retry is triggered.

**Part of speech in UI:** noun.

**Example:** `config:lqa.checks.glossary-adherence.description` — "At warning severity the issue is informational only; set severity to blocking to trigger the automatic retry."

**Not:** level, priority, urgency, criticality, error. The two **values** are not this term — "blocking" and "warning" are fixed by *check* above and must not drift here.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | серьезность | **Prefer no head noun at all — that is what the app's strings do.** Russian expresses this adjectivally, and dropping the noun also gives «блокирующая» a feminine noun to agree with: `config:lqa.checks.glossary-adherence.description` ships as: В режиме предупреждения проблема носит только информационный характер; сделайте проверку блокирующей, чтобы включить автоматический повтор. Use «серьезность» (f., gen. серьезности) — or «критичность», which Russian issue trackers use interchangeably — only where a head noun is genuinely unavoidable, such as a column header over the two values. **«Важность» is wrong and was shipped once before being caught:** it means *importance*, a ranking of what matters most, not how hard something fails. The error is worth studying — it was argued from what the other candidates were not («уровень» is taken by _stage_, «проверка» by _check_) without anyone checking that the surviving word meant severity. Not «уровень» in any case: see _reasoning effort_ for the loads that word already carries. |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### assertion

**Means here:** one user-written regular expression the regex LQA check applies to a translation — which must match it, or must not. A check can carry several.

**Part of speech in UI:** noun.

**Example:** `config:lqa.regexAddAssertion` — "Add assertion"

**Not:** condition, check, rule, test, claim, statement. The first three are all taken — "condition" by routing conditions, "check" by the LQA checks themselves, "rule" by routing rules — so a fourth word is genuinely required rather than merely nice.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | утверждение | Neuter; gen. утверждения, gen. pl. утверждений. The logical sense, as in a test assertion. `config:lqa.regexAddAssertion` is «Добавить утверждение» and `config:lqa.checks.regex-assertions.name` is «Утверждения регулярных выражений». **Known overlap, and the reason _approve_ is now restricted:** «утверждение» is also the verbal noun of «утвердить» (_approve_), so that row bans the noun form outright — approval uses the verb «утвердить» and the participle «Утверждено», which leaves this word free for the regex strings. |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### pattern

**Means here:** the regular expression itself, in the field beside an assertion. **This term is the regex sense only** — if English uses "pattern" elsewhere for a shape, a habit or a layout, that is a different word and this row does not cover it.

**Part of speech in UI:** noun.

**Example:** `config:lqa.regexPattern` — "Pattern"

**Not:** template, model, mask, sample, form. Whatever you choose must not be the word you gave **template** — several languages would otherwise use one word for both, and template is already carrying a reservation of its own.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | | |
| fr | | |
| de | | |
| it | | |
| pt-br | | |
| ru | выражение | Neuter; gen. выражения, gen. pl. выражений. `config:lqa.regexPattern` is «Выражение», and the check description names them in full as «регулярные выражения» — the rendering is valid **for the regex sense only**, and does not generalize to any other English "pattern". «Шаблон» is the word Russian reaches for first and is **unavailable**: it belongs to _template_, which holds it specifically so that _template_ never becomes «модель». Taking it here would push that whole chain over. |
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
| ru | переполнение | Neuter; gen. переполнения. «Превышение длины» was the obvious alternative and was rejected on this term's own `Not:` line, which bans _excess_ and _overrun_ — «превышение» is precisely «excess». (It is not rejected for sharing «длины» with _length limit_: the check name is «Переполнение по длине» and shares it too, exactly as English shares _length_ between "Length overflow" and "Entry length limit".) `config:lqa.checks.overflow.name` is «Переполнение по длине», the ratio is «коэффициент переполнения», _overflow only_ is «только переполнение» and _ignore overflow_ is «игнорировать переполнение». «Переполнение» is the neutral technical word here; this app has no buffer for it to be confused with. |
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
| ru | ограничение длины | Neuter head noun «ограничение» (gen. ограничения, pl. ограничения). `config:routing.labelMaxLength` is «Ограничение длины записи». A hard cap set by the game, against the relative «переполнение» — the two share no word. Provider rate limits are «ограничение частоты запросов», so the modifier always says which limit is meant. |
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
| ru | глоссарий | Masculine; gen. глоссария, pl. глоссарии, gen. pl. глоссариев. Syncretism to know about: «глоссарии» is the prepositional singular *and* the nominative/accusative plural, so «в глоссарии» (in the glossary) and «глоссарии» (glossaries) are spelled alike — let the preposition and the verb carry the number. The settled Russian CAT-tool word — «словарь» is a dictionary and is wrong here, and it must not be reused for «память переводов» either. |
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
| ru | термин | Masculine; gen. термина, gen. pl. терминов — `glossary:totalTerms` is «Всего терминов:». Shortened to «термин» alone inside the Glossary tab, exactly as English shortens _glossary term_ to _term_. Never «запись», which is reserved for _entry_, so «Добавить термин» and «{{count}} записей» can never collide. It shares a root with the check name «Терминология», as English does. |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |

#### match

**Means here:** one place where a glossary term was found in an entry's source text. The Glossary tab's Matches panel lists them, counts them, filters them by term, and compares entries with and without a glossary assigned. The same word is also the verb behind search results and routing conditions ("No models match your search", "Must match"); keep the noun and the verb on the same root wherever the language allows it.

**Part of speech in UI:** noun, usually plural ("{{count}} matches", "No matches found."), and a verb in the routing and search strings.

**Example:** `glossary:matchesPanel` — "Matches"

**Not:** hit, result, occurrence, finding, suggestion — and never the word you chose for **glossary term**: a term is what is searched for, a match is where it turned up.

| Locale | Rendering | Notes |
| --- | --- | --- |
| es | coincidencia | Feminine. Plural "coincidencias" throughout the Matches panel ("{{count}} coincidencias", "No se encontraron coincidencias.", "Aplicar coincidencias"). The verb is "coincidir" (`config:models.noMatches` — "Ningún modelo coincide con tu búsqueda"). |
| fr | correspondance | Feminine. Plural "correspondances" throughout the Matches panel ("{{count}} correspondances", "Aucune correspondance trouvée.", "Appliquer les correspondances"). The verb is "correspondre" (`config:models.noMatches` — "Aucun modèle ne correspond à votre recherche"). |
| de | | |
| it | | |
| pt-br | | |
| ru | совпадение | Neuter; gen. совпадения, gen. pl. совпадений, so the Matches panel reads «Совпадения», «Совпадений: {{count}}», «Совпадения не найдены.» The verb is the same root — «совпадать» (`config:models.noMatches` — «Ни одна модель не совпадает с запросом»). Note what that costs: «запрос» is *also* the HTTP request in the module settings panel, so it now carries two senses. Two is the ceiling — it is why _prompt_ takes the loanword «промпт» rather than becoming a third. Never the word chosen for _glossary term_: a «термин» is what is searched for, a «совпадение» is where it turned up. |
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
| ru | память переводов | Feminine head noun «память» (3rd declension, gen. памяти), the established Russian CAT term. `sidebar:translationMemory` is «Память переводов» — sixteen characters, which fits the sidebar beside its neighbours. Never the bare «память», which reads as RAM and is what `logs:vault.credentialsEvicted` genuinely means. |
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
| ru | утвердить | Perfective «утвердить» on buttons, imperfective «утверждать» in prose — the promotion sense, not «подтвердить» (_confirm_), «принять» (_accept_) or «сохранить» (_save_), all three of which live in the same bulk bar, and not «проверить», which is reserved. `strings:bulk.approveSelected` is «Утвердить в память». Count-neutral phrasing keeps the participle out of agreement trouble: «Утверждено переводов: {{count}}». **Use the verb and the participle, never the verbal noun «утверждение»** — that word is taken by _assertion_ below, and «утверждение перевода» would read as a regex assertion in a file that has both. |
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
| ru | категория | Feminine; gen. категории, pl. категории, gen. pl. категорий — counts run «1 категория / 2–4 категории / 5+ категорий», so `category:countLabel_other` and its siblings need all four plural keys. `strings:tabs.category` is the singular «Категория» and the page title is the plural «Категории», as in English. Not «группа» (taken by _rule group_) and not «метка» (taken by _source label_). |
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
| ru | тональность | Feminine, 3rd declension: gen. sg. тональности and nom./acc. pl. тональности are spelled alike, so the surrounding words have to carry the number. **Why «тональность» and not «тон» — it is not a false-friend argument.** «Тон» is fully idiomatic for the tone of a text («вежливый тон», «тон статьи», «задать тон»), and «тональность» is equally the musical key and colour tonality, so neither word is disqualified on its own. The plural decides it: the field is plural (`config:routing.labelTones` is «Тональности»), and «тона» is the colour-sense plural — exactly what this term's `Not:` line bans — while «тональности» cannot be read that way. Second, «тональность бренда» / «тональность коммуникации» is the settled Russian rendering of _tone of voice_ in content writing, which is what these values are. **The cost, which is real:** «анализ тональности» is the entrenched Russian term for _sentiment analysis_, so in an app that also has an AI reviewer a reader can plausibly take «тональность» for sentiment — keep the label beside authoring words («Тональности записи»), never beside review words. Not «стиль» or «голос», which read as the model's writing rather than an authoring instruction. |
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
| ru | сирота | Common gender, 1st declension, gen. сироты, pl. сироты, gen. pl. сирот — «сироты» is both the genitive singular and the nominative plural, so counted strings need all four plural keys rather than a guessed ending. **«Сирота» is strictly animate and human, which limits where it may stand.** The tab title takes it, because it is short and English's own metaphor is equally jarring: `orphans:title` is «Сироты». Everywhere else — action labels, prose and counts — uses the adjective, both because the animate accusative otherwise makes the string read literally (`orphans:relink.title` is «Перепривязать осиротевшую запись», never «Перепривязать сироту») and because English itself switches part of speech there: `config:orphanedCount` is the adjective "{{count}} orphaned", and it ships as **«Осиротевших записей: {{count}}»** — count-neutral, **with the head noun kept**. Two things to take from that. A bare «Осиротевших: 5» is a substantivized adjective left hanging, so count-neutral phrasing in Russian means putting the number after an invariant noun *phrase*, not after an adjective alone. And the key is a single plain key with no `_one`/`_other` siblings: adding a Russian family over it would in fact be legal (the guard allows an added family provided the plain key survives), but this key does not need one — the count-neutral form is grammatical at every count and is what shipped, so do not add one here. The `orphans` namespace's own counts are where families belong. That is one term with two registers, not two terms — do not introduce a third word. |
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
| ru | перепривязать | Perfective «перепривязать», imperfective «перепривязывать»; the noun is «перепривязка». `orphans:relink.title` is «Перепривязать осиротевшую запись» — the adjective, not «сироту», for the reason recorded on _orphan_ above. One verb serves the row button, the dialog title, the confirm step and the import warning — never «переподключить», «восстановить» or «объединить». The stale English _Relink tab_ is this app's Orphans tab, so render it «Сироты». |
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
| ru | резервная копия | Feminine phrase whose adjective agrees: «резервной копии» in the genitive, «Резервные копии» as the tab title. The native register rather than the loanword «бэкап», per the style guide's pick-one rule, and the app stays in that register throughout — `backup:createSection` is «Создать резервную копию» and the verb is never «забэкапить». Distinct from _export_ («экспорт») and from _snapshot_ («снимок»). |
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
| ru | снимок | Masculine, fleeting vowel: gen. снимка, pl. снимки, gen. pl. снимков. «Снимок» is the standard Russian for a state snapshot; expand to «снимок состояния» wherever the bare word could be read as a photograph. `config:importSnapshotNote` ships as: Перед этим импортом был создан страховочный снимок ({{date}}). Его можно восстановить на вкладке «Резервные копии». — the tab name is at the top level of the string, so it takes «ёлочки»; the guillemets elsewhere in this cell are citation marks. English's _restore points_ are «точки восстановления». Shares nothing with «резервная копия», which several strings put in the same sentence. The loose English use flagged in the block above — a saved *configuration*, not a restore point — keeps the same Russian word, exactly as English keeps the same English one: `config:templatesDescription` ships «Многократно используемые снимки конфигурации проекта.» |
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
| ru | шаблон | Masculine; gen. шаблона, pl. шаблоны, gen. pl. шаблонов. Explicitly **not** «модель», which is the word Russian would otherwise reach for and which is taken by _model_. `config:templatesTitle` is «Шаблоны проектов». The reservation runs the other way too: because «шаблон» belongs to _template_, it must stay out of the regex strings, where English's _pattern_ takes «выражение» — see _pattern_ below. |
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
| ru | соредактор | Masculine animate (acc. = gen., «пригласить соредактора»); gen. pl. соредакторов. A second word was required because «участник» is taken by _member_ and the two appear in adjacent strings on the Sharing page. «Соавтор» was rejected — a collaborator translates rather than writes the source — and «соредактор» is not the bare «редактор» the English list warns about. It is a considered stretch rather than a settled term: its default reading is a co-editor of a publication, and Russian has no established word for this role. Kept because the constraint is binding (two adjacent words are required) and because it is transparent on first reading. `collab:join.description` is «Введите код приглашения, чтобы присоединиться к чужому проекту в качестве соредактора.» |
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
| ru | участник | Masculine animate; gen. участника, gen. pl. участников. `collab:sharing.membersTitle` is «Участники». The generic masculine covers everyone, as is standard in Russian UI — do not switch to «участница» for a named person. Wider than «соредактор» (_collaborator_): the owner is a «участник» but not a «соредактор». |
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
| ru | уровень | Masculine with a fleeting vowel: gen. уровня, pl. уровни, gen. pl. уровней. The game-level sense only — «этап» and «стадия» are exactly the process readings this file and the style guide both rule out. `stage-details:title` is «Сведения об уровне». One ambiguity to know about: log severity is also «уровень», but the two never share a surface and the game sense always stands beside stage content. For the LQA sense of _severity_ Russian drops the head noun rather than reaching for «уровень» — see _severity_ below. |
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
| ru | Стилизатор текста | Proper noun, sentence-cased. Seventeen characters against the English eleven, which is the ceiling for a sidebar item; the shorter «Стили текста» was rejected because it names a settings page rather than a tool. Use exactly this wording in the sidebar item, the tab label and the tool's own title (`sidebar:colorText`, `colorText:title`). |
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
| ru | Руководство | Neuter; gen. руководства. Eleven characters against the English five — at 2.2×, the worst ratio in this file on a space-constrained surface, `sidebar:guide` being chrome where `config:routing.labelTones` (a worse ratio) is not. Accepted because the only shorter option is «Справка», and that is _Help_ (see below); measured against the sidebar's real width, eleven characters is well inside it. Not «Справка», which is _Help_ and would also collide with «справочный язык» (_reference language_); not «Документация» or «Инструкция». `sidebar:guide` is «Руководство», and every _read the guide_ link repeats that one word. **A notation warning for the whole `strings:guide.topic*` family:** the guillemets elsewhere in this cell are citation marks around a rendering, not part of it. Topic titles ending in _Tab_ take «вкладка» plus the surface name, and that name is at the **top** level of the shipped string, so it takes «ёлочки», never „лапки“ — `strings:guide.topicGlossary` ships as: Вкладка «Глоссарий». „Лапки“ are correct only inside another pair of «ёлочки». |
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
| ru | История изменений | Feminine head noun «история» (gen. истории). Seventeen characters against the English nine, which is over the style guide's 1.5× guidance for a sidebar item — accepted because it is the established Russian term and is one character longer than «Память переводов» (sixteen), which the same sidebar already fits. `sidebar:changelog` is «История изменений»; version numbers are never translated. |
| tr | | |
| id | | |
| vi | | |
| th | | |
| ja | | |
| ko | | |
| zh-hans | | |
| zh-hant | | |
