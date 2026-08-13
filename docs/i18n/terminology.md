# NARN terminology for translators

Domain vocabulary that must be rendered consistently across every namespace and every
locale. Translating one of these two ways in two namespaces is a bug, not a style choice.

**How to use this file:** before translating a namespace, read it. This file says what each
term *means*, what part of speech it is in the UI, and what it must not be confused with.
Your locale's actual wording lives in one file of your own — `terminology/<locale>.md`, next
to this one. When a string contains a term below, use your file's rendering for it. If no
rendering is recorded yet, you are the first translator to reach that term in your language:
decide it, write the row, and use it consistently from then on. If the agreed rendering does
not fit a particular sentence, change the sentence, not the term.

Every per-locale row starts empty on purpose. Nobody fills a language in advance; you fill
the row for the term you just met, in the same change that introduces the wording — so the
record is always of decisions actually taken, never a prediction. Use the Notes column for
anything the next translator would otherwise have to rediscover: a declension that forced a
different word, a term you deliberately left in English, an acronym you expanded.

## Frozen for the backfill

**The term rows in this file are frozen for the duration of the backfill.** The 87 terms
below, their definitions, their part-of-speech notes and their "Not:" lists do not change
while languages are being translated. Nobody edits this file during a wave — not to reword
a definition, not to add a term, not to fix one that looks wrong.

**What you write instead:** exactly one file, `terminology/<locale>.md` for the language you
are translating. It holds your rendering and notes for each of the 87 terms, in the order
they appear here. Nobody else writes rows in your file, and you write rows in nobody else's,
so eleven languages can run at once without ever touching the same line.

**A term this lexicon lacks goes in the additive queue** at the bottom of
`terminology/README.md`: add the proposed term, the key that made you need it, and the
rendering you used, then carry on with that rendering. Do not add a heading here. The queue
is resolved **between waves, never mid-wave** — a term promoted into this file mid-wave would
change what the other ten translators are reading while they read it. **You are never blocked
by a queued term:** the rendering you used stands for the rest of your wave, and if the
between-waves resolution settles on a different word it reaches your locale as an ordinary
fix round. Who runs that resolution, and the fix-round procedure, are the runbook's —
`backfill-runbook.md`.

**Why it works this way.** The Russian pilot ran this file as a fifth, parallel workstream
and it cost more than any single translation batch: ten rounds, growing from 55 terms to 76,
and six of those rounds were not new terms at all but corrections to rows the shipped strings
had proved wrong — all of it while batches were reading the file. One batch was dispatched
while the previous batch's fix round was still in flight, read the pre-fix version, and cited
two values that had already changed. Separately, three decisions were recorded only in a
batch report, which is not something the next batch reads, and had to be re-litigated. So:
the definitions are settled once and held still, and anything that binds a later translator
goes into a file — this one between waves, or your own locale file during one — in the same
change that decides it.

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
established localized form, and record that decision in the `LQA` row of your locale file.

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

**Settled per-locale renderings.** These are the only key names that occur in the shipped
`en`, `es`, `fr` and `ru` strings today; a translator meeting one of them writes exactly
this rendering, everywhere, and does not make a local decision:

| Key name | es | fr | ru |
| --- | --- | --- | --- |
| `Enter` (key) | **Intro** | **Entrée** | `Enter` (Latin, as engraved) |
| `Esc` | `Esc` (already English on the keycap) | **Échap** | `Esc` (Latin, as engraved) |
| `Shift` | **Mayús** | **Maj** | `Shift` (Latin, as engraved) |
| `Tab` / `Ctrl` / `Alt` | not currently used as a key name in any shipped string | — | — |

Russian keeps the Latin key names **on purpose, not as an untranslated leftover**: a
Russian keycap is printed with the Latin `Enter`/`Shift`/`Esc`, not a Cyrillic word, so
copying the English word is what the rule above ("write it as engraved") actually
requires for this locale. See `terminology/ru.md` for the same note recorded against the
term, so a reviewer scanning for untranslated strings does not re-open it as a defect.

This settles what used to be a known inconsistency: as measured against the shipped files
on 2026-08-09, `es` and `fr` each kept `Enter`/`Esc` in English in the compare-tab tooltips
(`strings:compare.cellEditTooltip`, `strings:compare.cellEditReviewedTooltip`) while
already localizing the same key names in `common:webSearch.hint` and the compare-tab
placeholders (`strings:compare.contextPlaceholder`, `strings:compare.tonePlaceholder`) —
`es` even mixed both readings inside one string (`Enter`/`Esc` kept, `Mayús` localized).
All five keys across `es` and `fr` now use the table above consistently; `ru` needed no
string changes because it was already consistent with its own (Latin-keycap) rendering.

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
| Sharing | `strings:tabs.sharing` · `collab:sharing.pageTitle` |
| Stage details | `strings:tabs` (stage-details) · `stage-details:title` |
| Text Styler | `strings:tabs` (color-text) · `colorText:title` · `sidebar:colorText` |
| Translation AI review | `strings:tabs` (review-translation-ai) · `review:translationAi.title` |
| Source AI review | `strings:tabs` (review-source-ai) · `review:sourceAi.configTitle` |
| Activity | `strings:tabs.runs` · `strings:guide.topicActivity` |
| Quality | `strings:tabs.quality` · `strings:guide.topicQuality` |
| Global Config | `sidebar:globalConfig` · `config:globalConfigTitle` |
| Live log panel | `console:title` · named in prose by `colorText:assistant.verboseHint` and `stage-details:chatVerboseHint` |

(Where a key path contains a hyphen it is given as namespace plus the sub-key in
brackets, so the citation checker does not read it as a truncated key.)

**About that last row.** The live log panel is the surface the frozen **log** term streams
its lines into, and it is named twice: its own title is `console:title` — "CONSOLE",
uppercase for layout in the same way as `strings:columns.config`, so keep the uppercase
where your script has case — while `colorText:assistant.verboseHint` and
`stage-details:chatVerboseHint` both call it "the live log panel". Thirteen locales
rendered the title with a console loanword and one, `vi`, named it with its own log word
instead ("BẢNG NHẬT KÝ"); either reading is defensible, but one locale uses one of them in
all three keys. The lines are the **log** term, the panel is this surface, and neither is
**Activity**. This is where the previous resolution said the `console` ruling belonged —
"a surface name, belongs in the surface table rather than the term list" — and it is
written here now, one resolution late.

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
- **Legal** works the same way: `sidebar:legal` is "Legal" and `legal:title` is "Legal &
  policies". Expand the page title, keep the sidebar item short, and do not invent a third
  name. Note that `sidebar:globalConfig` in the table above is the *opposite* case — there
  the tab and the page title are word-for-word identical, and must stay so.

## Terms

Grouped by area for a first read-through. To look one term up, jump to its heading
or search the file for the word.

### Content and structure

#### project

**Means here:** the top-level container for one game or product's text: its imported entries, its languages, its routing rules, glossaries, backups and runs. Created from the sidebar; almost everything else in the app is scoped to exactly one project.

**Part of speech in UI:** noun. The verb for making one is "create", never "open a new project".

**Example:** `sidebar:createProjectTitle` — "Create project"

**Not:** file, folder, workspace, job, board. "Workspace" is a *wider* scope — see below — so the two must not share a word.

#### workspace

**Means here:** everything above the project level: global module defaults, module instances, the credential vault, translation memory and templates. A setting labelled "workspace" applies to every project at once.

**Part of speech in UI:** noun, usually attributive ("workspace setting", "workspace-wide").

**Example:** `config:workspaceSettingsTitle` — "Workspace Settings"

**Not:** project, account, environment, desktop, dashboard. Never the same word you chose for "project" — several strings contrast the two ("Use workspace setting" vs the project value).

#### entry

**Means here:** one row of imported source content: a key, its source text, its metadata (categories, tone, translator context, source labels) and its translation in each target language. This is the unit the whole app counts.

**Part of speech in UI:** noun. **Canonical term.** The `logs` namespace narrates about the same object using the word "string" (`logs:orphan.detected` — "Found {{count}} strings that are no longer in the source file."); translate that occurrence with your *entry* rendering too, so the UI counts one thing, not two. **One exception, and it is the only one:** `logs:translation.queued` counts *jobs* — one entry for one target language — not entries, so an *entry* rendering there makes the number wrong on any multi-language run. See its row in `english-review-notes.md`. (This row previously used that very key as its illustration, which pointed translators at the single case the rule does not fit; corrected 2026-08-12, without changing the rule itself.)

**Example:** `category:countLabel_other` — "{{count}} entries"

**Not:** string, row, line, record, item, key, cell, field. "Row" in particular reads as a table artefact rather than a piece of content.

#### source text

**Means here:** the original-language text of an entry, exactly as imported. The app never rewrites it during translation; only source review proposes changes to it.

**Part of speech in UI:** noun phrase.

**Example:** `review:sourceText` — "Source text"

**Not:** original, original text, source string, base text, input, raw text. Keep the same word for "source" here as in "source language" and "source label" only if that reads naturally — if not, prefer clarity per string and record what you chose.

#### translation

**Means here:** the target-language text stored on an entry for one language — whether produced by a module, reused from translation memory, or typed by a person. Also the name of the main editing tab.

**Part of speech in UI:** noun. The verb is "translate". "Translations" plural is the tab label.

**Example:** `strings:tabs.strings` — "Translations"

**Not:** target, target text, localization, version, output, result. The tab was formerly labelled "Multi-language Text"; that name is dead in the live UI and must not be revived in any locale. The one place it legitimately survives is the shipped changelog entries that announced those releases (`guides/en/changelog/v1.9.17.md` and four others) — release history is frozen, so leave it exactly as it stands there and do not "correct" it.

#### source label

**Means here:** a tag recorded on an entry saying which imported file or origin it came from. Routing rules can match on it, and the routing UI shortens the column heading to "Sources".

**Part of speech in UI:** noun phrase.

**Example:** `generation:fieldSources` — "Source labels"

**Not:** source language, source text, source file, origin, provenance, tag, label alone. A translator who renders this as "source" full stop makes it indistinguishable from the two entries above it.

#### achievement

**Means here:** a game achievement, whose name and description are two linked entries. They carry their own UTF-8 byte limits and their own LQA check, and routing rules can target them by achievement type.

**Part of speech in UI:** noun, frequently attributive ("achievement name", "achievement description").

**Example:** `strings:achievement.label` — "Achievement"

**Not:** trophy, award, badge, unlock, accomplishment, medal. Use whatever the target locale's game platforms call these, but pick one and keep it across the routing, LQA and string-table strings.

#### inline tag

**Means here:** markup that lives inside the text itself — `{{…}}` placeholders, colour and formatting tags, literal `\n` escapes. It must survive translation unchanged or the string renders wrong in game.

**Part of speech in UI:** noun phrase.

**Example:** `logs:translation.maskMismatch` — "Formatting tags didn't survive translation into {{language}}."

**Not:** label, marker, keyword, hashtag, category, annotation. Distinct from "source label" (metadata *about* an entry) — this is inside the text.

#### placeholder

**Means here:** specifically a `{{…}}`-style token inside the game text, which the translation must carry over unchanged. A **subset of _inline tag_** above, not a rival to it: "inline tag" is the umbrella over placeholders, formatting tags and `\n` escapes, and "placeholder" names only the token kind. The LQA check that compares them is filterable by name.

**Part of speech in UI:** noun, usually plural.

**Example:** `strings:filters.placeholderMismatch` — "Placeholder mismatch"

**Not:** variable, parameter, argument, field, wildcard — and **not** the input-hint sense of the same English word. A `placeholder` attribute on a text box is unrelated UI vocabulary; if your language would use one word for both, use two.

#### translator context

**Means here:** a free-text note a person attaches to an entry explaining how the string is used, sent to the model with the job.

**Five different things are called "context" in English**, and this row is one of them. (It said "three" until the guide-wave resolution counted them against the shipped strings.)

1. **This term** — `strings:compare.addContext`, `editContext`, `contextPlaceholder`, `emptyContextFilter`, and the export column at `config:includeContext`.
2. **The entry metadata bundle** sent with a generation job — `generation:contextLabel` ("Include entry context"), `generation:contextHint`, `generation:fieldContext` ("Context notes").
3. **A model's token budget** — `config:models.colContext`, a bare "Context" column of token counts, and `config:models.confidenceReason.prompt-near-context` / `prompt-exceeds-context`, which spell out "context window".
4. **An already-translated language sent along with the job** — `strings:compare.translateUseReference` / `translateUseReferenceNone`, `generation:languagesLabel`, all phrased "… as context".
5. **The match conditions of a memory policy** — `config:tm.policyStrict`, "Strict (full context match)".

**Part of speech in UI:** noun phrase.

**Example:** `strings:compare.editContext` — "Edit translator context"

**Not:** comment, note, description, background, remark.

**On sharing one root across those five — measured rather than asserted.** Eleven of the fourteen shipped locales use a single word for this term *and* for the model's context window, letting the qualified phrase carry the difference ("translator context", "entry context", "context window", "as context"); `ko`, `vi` and `th` chose separate words. Both are defensible and this row no longer forbids either. The key that is **not** safe by default is `config:models.colContext` — a bare "Context" heading over a column of token counts, which means the window and nothing else: if your single word would read there as an authoring note, that one key needs the qualified form.

### Languages

#### source language

**Means here:** the single language the project's entries are written in. One per project, set in Config.

**Part of speech in UI:** noun phrase.

**Example:** `config:sourceLanguage` — "Source Language"

**Not:** original language, base language, default language, main language, from-language. Whatever you pick has to pair naturally with "target language" — the two appear side by side.

#### target language

**Means here:** a language the project translates into. A project has many, chosen in Config.

**Part of speech in UI:** noun phrase.

**Example:** `config:targetLanguages` — "Target Languages"

**Not:** destination language, output language, to-language, foreign language, locale. "Locale" is wrong: the app tracks languages, not regional formatting.

#### reference language

**Means here:** an already-translated language a person displays beside the one they are editing, and can optionally send to the model as extra context. It is a reading aid, never a second source.

**Part of speech in UI:** noun phrase.

**Example:** `strings:compare.translateUseReferenceNone` — "Use reference language as context"

**Not:** source language, pivot language, secondary language, comparison language, model language. Calling it a pivot implies the app translates *through* it, which it does not.

#### writable language

**Means here:** in a shared project, a language a specific collaborator is permitted to edit. Everything outside their writable languages is read-only for them.

**Part of speech in UI:** adjective + noun.

**Example:** `collab:sharing.columnLanguages` — "Writable languages"

**Not:** editable / assigned / granted / available / permitted used interchangeably. Any one of them may be the right adjective in your language — the bug is alternating between them, because the same permission is named in a table column, in lock messages and in the invite dialog.

#### Pseudo Test

**Means here:** the synthetic language `pseudo-test`: a free offline QA pass that rewrites source text with accents, extra length and ⟦brackets⟧ so hardcoded strings, overflow and truncation show up. Not a real locale and never a real translation target.

**Part of speech in UI:** proper noun (a language entry and a guide topic).

**Example:** `strings:guide.topicPseudoTest` — "Pseudo Test"

**Not:** test mode, dummy language, fake translation, mock, sample, demo. The language code `pseudo-test` itself is never translated, anywhere.

### Runs and engines

#### run

**Means here:** one execution of a background engine — translation, AI review, source review, glossary generation, category generation — with a status, progress, a cost and a row in Activity.

**Part of speech in UI:** noun. It is **never a verb** in this UI: the verbs are "translate", "start", "generate". Where English says "Run" as a standalone label it is still the noun (the run picker in the Compare toolbar).

**Example:** `logs:translation.runQueued` — "Translation run queued — position {{position}}."

**Not:** job, task, execution, process, session, operation, batch. "Batch" especially: a run contains many batches.

#### revert

**Means here:** to roll back every translation one run wrote, restoring the values that were there before it. Offered on a finished run in Activity; the run then carries a "Reverted" badge.

**Part of speech in UI:** verb on the control, participle on the badge and in the toast.

**Example:** `strings:runs.revert` — "Revert"

**Not:** undo, cancel, restore. **Undo is the distinction to protect:** `strings:compare.undo` restores one earlier version of one cell, this reverses everything one run wrote, and both controls can be on screen at once — a locale that renders the two with one word loses a distinction the UI makes. Two languages reserved a separate word for *undo* independently, without seeing each other's files. "Restore" is the **backup** verb and is already spoken for. Both *undo* and *cancel* are now terms of their own — the next two rows.

#### undo

**Means here:** to reverse the last thing *this person* just did, and only that: `strings:compare.undo` opens the previous versions of one translation and puts one back, `strings:editor.undo` and `review:undo` reverse the edit just saved, and `vault:undoRemove` puts back a credential just removed. One person's one action, not a run and not a dialog.

**Part of speech in UI:** verb on a button. English also uses it passively in nine confirm dialogs ("This cannot be undone", `backup:confirmBody`, `config:confirmDeleteDescription` and seven more) — that is the same verb and takes the same root.

**Example:** `strings:compare.undo` — "Undo"

**Not:** revert, cancel, discard, revoke, clear. **This word and *cancel* are the two most reserved-against in the lexicon, and until now the least defined:** three frozen rows name it in their **Not:** lists — *revert* ("undo is the distinction to protect"), *discard* and *revoke* — and none of them defined it. The distinction they were all protecting is **scope**: undo reverses one edit of yours, *revert* reverses everything one run wrote, and both controls can be on screen at once.

**Two facts measured against the shipped locales, so nobody re-derives them.**

- **Undo and cancel collapse into one word in Romance and Slavic languages, and three shipped locales collapsed them.** `fr` renders both `common:cancel` and `strings:compare.undo` as "Annuler"; `ru` renders `strings:runs.cancel` and `strings:compare.undo` both as «Отменить»; `it` escaped it only by adding a noun ("Annulla" against "Annulla modifica"). If your language's first word for *undo* is also its first word for *cancel*, one of the two has to move — decide the pair together, and see the next row.
- **`strings:compare.undoRestore` is not this term, and it is not a defect.** The button inside the previous-versions panel says "Restore", and **all fourteen shipped locales render it with the same word as `backup:restoreButton`**. Do not "fix" that: the reservation of *restore* for backups warns against using it on the *undo* and *revert* controls, not against the word appearing in the panel. Note that the interaction has three English wordings — the control "Undo", the panel "Previous versions" (`strings:compare.undoVersionsTitle`, `undoTooltip`, `cellUndoAria`) and the action "Restore" — so keep all three in step with each other rather than merging them.

#### cancel

**Means here:** two things English spells with one word, and the difference is whether work has already started. **Backing out of a dialog before anything happens** — the ghost button beside Save, Confirm or Delete, in seventeen namespaces — and **stopping something already in flight**: a queued or running run (`batch:cancelRun`, `strings:runs.cancel`), an import (`config:cancelImport`), a generation (`glossary:generateCancelled`). Only the second leaves state behind: whatever finished before the stop is kept, and *Cancelled* is one of the seven run statuses.

**Part of speech in UI:** verb on a button; participle as a run status (`strings:runs.statusCancelled`) and in toasts (`batch:runCancelled`).

**Example:** `common:cancel` — "Cancel"

**Not:** undo, revert, discard, revoke, delete, close, stop-and-lose-everything. Three frozen rows already reserve against this word — *revert*, *discard* and *revoke* — and this row is the thing they were reserving against.

**Three constraints go with it.**

- **The seven run statuses resolve as one set, in one part of speech** — `strings:runs.statusQueued`, `statusPending`, `statusRunning`, `statusPaused`, `statusCompleted`, `statusFailed`, `statusCancelled`, under the `statusColumn` header. Same rule as the four invite statuses under *invite*: a reader compares them down one column.
- **Check your word against *undo* before you settle it**, per the row above. `ko` shows the other shape of the same trap: `batch:cancelRun` composes to 실행 취소, which is also the conventional Korean for *undo*, so the run control reads as the undo control even though `strings:compare.undo` is a different word there. If your word for *cancel* plus your word for *run* composes into your language's undo term, phrase the run control differently rather than accepting it.
- The dialog sense and the in-flight sense **may** share one word — most locales do — but record in your Notes that you checked, because one of the two stops work that is running and the other does nothing at all.

#### Activity

**Means here:** the per-project tab listing every run with its status, progress, cost and per-entry detail. It is a history of runs, not a feed of user actions.

**Part of speech in UI:** proper noun (a tab name and a guide topic).

**Example:** `strings:tabs.runs` — "Activity"

**Not:** history, log, logs, feed, events, timeline, jobs. "Log" is taken by the live server-log panel, which is a different surface — and that surface is now a term of its own, the next row.

#### log

**Means here:** the live server-log panel and the lines it streams — the running narration of what the server is doing, filterable by level, searchable and exportable. It is what the app is saying while it works, not a record the user keeps: nothing in it is stored on an entry, and it is not the history of runs.

**Part of speech in UI:** noun, very often attributive ("log entry", "log stream", "Export logs").

**Example:** `console:statusConnected` — "Connected to server log stream"

**Not:** history, activity, journal, audit, changelog. **Activity is the reservation that makes this row necessary** — that term forbids "log" for the run list while never naming the panel it was reserved against, so a translator arrived at the log strings with a word reserved for a concept the lexicon had not defined. The two must stay apart from this side too. **"Log entry" and "log stream" fold into this term** unless your language needs a separate word for a single line, in which case build it from the same root and say so in your Notes.

#### batch

**Means here:** the group of entries packed into a single request to a model. Batch mode ("by language" / "by entry") and batch size control how many entries share one request.

**Part of speech in UI:** noun.

**Example:** `config:module.batchMode` — "Batch mode"

**Not:** group, chunk, lot, package, set, bulk. Keep it distinct from "bulk operation", which is a user action over selected rows, and from "run", which contains batches.

#### batch grouping

**Means here:** the setting deciding which entries are *allowed* to share a batch — by category, by glossary, by tone, or by category and glossary — so the model sees related entries together.

**Part of speech in UI:** noun phrase.

**Example:** `config:batchGroupingLabel` — "Batch grouping"

**Not:** batch mode (a different setting entirely), sorting, ordering, clustering, classification. If your rendering of "batch grouping" and "batch mode" end up identical, change one.

#### AI review

**Means here:** the umbrella name for the AI quality passes: over finished translations (Translation AI review) and over the source text (Source AI review). Also the badge on a run that has been reviewed.

**Part of speech in UI:** noun phrase.

**Example:** `strings:runs.judgeBadge` — "AI review"

**Not:** AI check, AI control, AI verification, proofreading, correction, revision, audit. Do not render *AI review* with your "check" word: those are deterministic rules, this is a model's opinion. (That is a rule about this **term** — it does not stop you translating a literal English "Checks" as a check, which is what `review:sourceAi.checksLabel` and `strings:runs.aiReviewChecksLabel` are.) The two systems do meet — a judge's issues are filed alongside the LQA results for the same entry — but they are never the same thing to a reader, so they must not share a word.

#### judge

**Means here:** the engine that scores completed translations for accuracy, fluency, terminology and tone, and can propose a corrected translation. It surfaces to the user as "Translation AI review"; "judge" appears mainly as a verb in explanatory copy.

**Part of speech in UI:** verb in prose ("will judge the latest completed translation run"). The *feature* is called "AI review" — do not introduce "the judge" as a noun in a locale where English does not use it.

**Example:** `review:translationAi.description` — "Have an AI judge score completed translations for accuracy, fluency, terminology and tone."

**Not:** referee, arbiter, magistrate, court, sentence, condemn. Many languages' first-choice word for "judge" is the legal one; pick the evaluative sense.

#### source review

**Means here:** the AI pass that inspects the **source text** for problems in five independently toggleable categories: typo, grammar, terminology, clarity and unsafe wording. Report-only: it never writes a translation, and applying its suggestion edits the source.

**Part of speech in UI:** noun phrase (also the tab "Source AI review").

**Example:** `review:sourceAi.configTitle` — "Source AI review"

**Not:** proofreading, revision, source correction, source check, editing. It must not be confusable with the *translation* review — the two tabs sit next to each other.

#### finding

**Means here:** one issue the source review reports against one entry, carrying a type — typo, grammar, terminology, clarity or unsafe — and a description of what is wrong. An entry can carry several findings; the corrected source text is **not** attached to each one. There is at most ONE suggestion per entry, a single unified rewrite of the whole source that addresses all of its findings together.

**Part of speech in UI:** noun, usually plural. The five type labels live at `review:sourceAi.findingTypo`, `findingGrammar`, `findingTerminology`, `findingClarity` and `review:sourceAi.findingUnsafe` — translate all five, and keep them distinct from the LQA check names.

**Example:** `review:sourceAi.findingsTitle` — "Findings"

**Not:** error, bug, result, discovery, observation, remark — and not the word you use for an LQA "issue", which is a machine verdict rather than an AI opinion.

#### suggestion

**Means here:** a proposed change the user reviews and then applies or discards: a judge's rewritten translation, a source review's corrected source text, a generated glossary term, a proposed category assignment.

**Part of speech in UI:** noun. The action on it is "apply" (or "discard"), not "accept" or "save".

**Example:** `category:reviewTitle` — "Review suggestions"

**Not:** proposal, recommendation, advice, hint, tip, idea. Keep one word across the judge panel, the glossary generator and the category generator — they are the same interaction.

**A known English copy bug, and the one place it must not be mirrored.** The action on a suggestion is *apply* — `strings:runs.judgeApply` is "Apply suggestion" — but `strings:runs.judgeApproveAll` says "**Approve** all suggestions" for the very same action on all of them. That is stale English copy awaiting a fix, not a second action. Render **both** with your *apply* word, and do not reach for your *approve* word: this file reserves that for storing a translation into translation memory, which is a different operation that appears in the same UI. Following the English here would invent a distinction the app does not have.

#### discard

**Means here:** two different actions that English spells with one word. **Discarding unsaved edits** — the ghost button beside Save that puts a field back the way it was (`strings:editor.discard`, `config:discard`, `vault:discard`) — and **discarding a proposal or a produced result**: rejecting a judge's suggestion or a generated glossary (`strings:runs.judgeDiscard`, `glossary:generateDiscard`, `colorText:assistant.discard`).

**Part of speech in UI:** verb, on buttons.

**Not:** cancel, delete, undo, clear. **The two senses need two words in most languages**, because the first destroys nothing the user made and the second refuses something offered. Check the call site: if a Save button is beside it, it is the first sense.

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
- **Counter-precedent to know about:** `vault:statusLocked` ships as "Bloqueada", agreeing with an invisible "bóveda". That is a standalone status word that *does* agree, so the rule is not "status words never inflect" — it is that a value quoted as a token elsewhere in the UI stays in its citation form. If your language has no such citation form, agree with *translation* everywhere and say so in your locale file's Notes.

"Needs review" itself sidesteps all of this in es/fr: it is a verb phrase, not an adjective, so it carries no gender.

#### flag

**Means here:** to set a translation aside in the review queue to come back to later. It is a **disposition, not an alarm** — the handler sets the record's status to flagged *and clears its needs-review flag*, so it is the opposite move to marking something for review.

**Part of speech in UI:** verb on the row button ("Flag"), and "flagged" as the filter chip and the toast.

**Example:** `review:flag` — "Flag"

**Not:** mark, report, denounce, bookmark, star — and above all **not the verb you chose for "mark as needs review"**, because this action *clears* that flag. Using one word for both would make the same verb set and unset the same state.

**English uses "flag" for five different things and this row is only the first of them.** Five locales collapsed two of the five before the list existed, so it is written out here rather than left to each locale to work out again:

1. **This term** — the review disposition: `review:flag`, `review:filterFlagged`, `review:flaggedToast`, `review:emptyFlaggedTitle` / `emptyFlaggedHint`.
2. **What an LQA check does to a translation.** Eleven check descriptions begin "Flags …" (`config:lqa.checks.*.description`), and `config:lqa.lengthLimitNote` says translations "are flagged". That is a machine filing an **issue**, not a person setting work aside — ordinary prose, not this term.
3. **A glossary term missing a language** — `glossary:flaggedTitle` ("{{count}} flagged (incomplete)"), and the wording inside the *glossary term* row above. Ordinary prose again.
4. **A count of entries an AI review scored badly** — `review:sourceAi.runSummary`, `strings:runs.judgeSummary`, `strings:runs.judgeAllFindingsDescription`. Nothing was set aside for a person here; the review scored and moved on.
5. **A stored boolean marker, as a noun** — "Clear new flags" (`strings:filters.clearNewFlags`, `strings:bulk.clearNewFlag`, `strings:row.newTooltip`) and 'Clear "needs review" flag' (`strings:contextMenu.clearNeedsReview`). And `config:lqa.regexFlags` ("Flags") is not this English word at all: it is the regular-expression flag letters, and belongs beside *pattern*.

**Measured against the shipped files:** nine locales keep sense 1 apart from sense 4, while `es`, `fr`, `it`, `pt-br` and `vi` render `review:sourceAi.runSummary` with their disposition word — which tells the reader the source review *set aside* entries it merely scored. `de` worked the same split out unaided and recorded it in its own locale file; a decision recorded in one locale file binds nobody else, which is why it is here now.

#### ignore / ignored

**Means here:** to mark an entry so that every AI dispatch skips it, while it stays in the project, stays visible in the table and keeps the translations it already has. It is both an action and a state, on the same object, and it is reversible from the same row.

**Part of speech in UI:** verb for the action ("Ignore entry"), participle for the state badge ("Ignored").

**Example:** `strings:row.ignored` — "Ignored"

**Not:** skip, discard, disable (which is what happens to a module or a feature, and is now a term of its own), hide, exclude. **The gloss on *skip* here was wrong and is corrected:** this row used to define it as "a per-run routing outcome, decided by the engine rather than by a person", and no shipped string means that. In the live UI *skip* is an import outcome count (`config:skipped`, `glossary:importSkipped`) and a generation setting a person configures (`generation:skipCategoriesLabel`, whose hint says the entries are "left out of the request entirely"). It stayed out of the lexicon in the guide-wave resolution; render each occurrence as ordinary prose and do not reach for this term for any of them. **Nobody has an idiomatic verb for "unignore":** two languages met the negation independently and both built it out of the affirmative rather than coining a word for it (`strings:row.unignoreAction` is "Unignore entry" in English). Build it; do not invent a verb, and do not let the built form drift into a second term.

#### Review (the sidebar group)

**Means here:** the sidebar section grouping four tabs — Source AI review, Translation AI review, **Manual review** and **Quality**. It is an umbrella over three different systems: a model's opinion, a person reading, and deterministic rules.

**Part of speech in UI:** a navigational group heading, not a feature name.

**Example:** `sidebar:groups.review` — "Review" (and `strings:guide.groupReview`, the same word for the same grouping in the guide)

**Not:** a word derived from whichever member you translated first. English gets away with "Review" because it is vague in English too; most languages have **separate** words for AI review, human review and machine checking, so the umbrella has to be chosen deliberately or it will silently claim the group for one of its four members.

#### review queue

**Means here:** the Manual review surface: the list of translations awaiting a person, with its filters, its per-language scoping and its empty states.

**Part of speech in UI:** noun phrase (a page title, an empty-state title, a filter label).

**Example:** `review:title` — "Review queue"

**Not:** a second name for **needs review**, which is the *state* an item is in. The queue is where those items are listed. Build the two from one root if your language allows it, so a reader sees one feature rather than two.

#### back-translation

**Means here:** the machine re-translation of a target-language string back into the source language, shown read-only beside the translation as a reading aid for someone who does not speak the target language. It is never edited, never stored on the entry and never sent anywhere.

**Part of speech in UI:** noun phrase (a panel heading).

**Example:** `review:backTranslationTitle` — "Back-translation (reference only)"

**Not:** reverse translation as an action, round trip, retranslation, source text, reference language. It is a **term of art** in this industry: use your locale's established one if it has it. A literal compound of "back" and "translation" tends to name an action — translating something back — which is not what this is; the product offers no such action.

### Modules, providers, credentials

#### module

**Means here:** one translation backend the app can call — `openai`, `deepl`, `pseudo` and the rest. It is what every "choose what to translate with" picker selects and what a routing rule points at. In practice a rule stores a *named instance* of a module (see below) for the modules that support instances, and the bare module id only for `deepl` and `pseudo`, which cannot have instances. The user-facing word for all of it is still **module**.

**Part of speech in UI:** noun. **Canonical term** for the thing you pick before an AI call.

**Example:** `config:routing.labelModule` — "Module"

**Not:** plugin, extension, engine, connector, driver, add-on, service. The app has no plugin system — "plugin" would promise something that does not exist. See "provider" for the three English strings that call this same control something else.

#### module instance

**Means here:** a named configuration of a base module, identified as `<base>:<slug>` (for example `openai:default`), with its own credentials, model and settings. One base module can have several. A picker offers named instances, plus modules that cannot have instances at all (`deepl`, `pseudo`), plus a base module that is still instance-less; what it does not offer is a base module that already has instances, because its configuration has moved into them.

**Part of speech in UI:** noun phrase; often shortened to "instance" once "module" is established in the sentence.

**Example:** `config:instances.formTitle` — "New instance of {{base}}"

**Not:** copy, clone, profile, account, connection, occurrence, configuration. The instance id itself (`generic-ai:my-ollama`) is a literal identifier and is never translated. English shows the user the word "slug" in exactly one string, `config:instances.slugReserved` — there it names the second half of that identifier, not a UI concept, so translate it as the identifier fragment it is (the field itself is labelled "Instance id").

#### provider

**Means here:** the outside company or service behind a module — OpenAI, Anthropic, DeepL, Google. Correct in strings about API keys, pricing, rate limits and per-request caps.

**Part of speech in UI:** noun.

**Example:** `config:enableModuleHelp` — "Add an AI or translation provider to use across your projects."

**Not:** a synonym for "module". Three English strings label a *module-instance* picker "Provider" — `colorText:assistant.instanceLabel`, `stage-details:chatInstanceLabel` and `config:routing.simplePlaceholder`. That is a known English inconsistency awaiting a copy fix. Translate those three as written ("provider"), and do not let them drag your rendering of *module* toward *provider* anywhere else.

#### model

**Means here:** the specific AI model a module instance calls (`gpt-5-mini`, `claude-sonnet-4`, a local Ollama tag). Chosen under the module, overridable per routing rule, and priced per million tokens.

**Part of speech in UI:** noun.

**Example:** `config:routing.labelModelOverride` — "Model override"

**Not:** module, provider, engine, mode, version, template. In several languages the natural word for "template" is also "model" — if that is yours, choose a different word for **template**, not for this. Model ids themselves are never translated.

#### prompt

**Means here:** the instruction text the app composes and sends to a model with a job. A routing rule exposes prompt options and carries a badge when it overrides them. It is the app's own composed instruction, never something the user types into a chat.

**Part of speech in UI:** noun, frequently attributive ("prompt options", "prompt override").

**Example:** `config:routing.labelPromptOptions` — "Prompt Options"

**Not:** request, query, question, command, instruction on its own. Keep it distinct from an HTTP **request** — the same settings panel carries requests-per-second and request-timeout labels — and from the **search query** behind "No models match your search".

#### reasoning effort

**Means here:** a provider parameter on a model — low, medium or high — controlling how much the model deliberates before answering. Set on a module instance and overridable per routing rule.

**Part of speech in UI:** noun phrase.

**Example:** `config:module.reasoningEffort` — "Reasoning effort"

**Not:** a NARN concept at all — it is the provider's own parameter, so prefer whatever your locale's AI tooling already calls it. Not "effort" in the sense of work done, and never confusable with a run's cost.

#### routing rule

**Means here:** one ordered condition-to-module mapping. The first rule that matches (in ascending priority order) decides which module translates a given entry into a given language; if none matches, the job fails.

**Part of speech in UI:** noun phrase.

**Example:** `config:routing.title` — "Routing Rules"

**Not:** filter, condition, mapping, policy, redirect, forwarding, route. Avoid any word that suggests *network* routing — this is content routing.

#### rule group

**Means here:** a named, switchable set of routing rules. Exactly one group is active per project, and it cannot be switched while translations are running.

**Part of speech in UI:** noun phrase.

**Example:** `config:routing.groupSelectLabel` — "Rule group"

**Not:** ruleset, folder, category, profile, collection, preset — used interchangeably. Any of these may be the best word in your language; alternating between two of them is the failure. Do not reuse the word you chose for "category" or for "batch grouping".

#### credential vault

**Means here:** the password-encrypted store holding the API keys modules use. It is locked until the user types the password each session; while locked, every AI action fails and offers an unlock prompt.

**Part of speech in UI:** noun phrase; shortened to "vault" where the context is unambiguous ("Vault locked", "Unlock vault").

**Example:** `vault:statusLabel` — "Credential vault"

**Not:** safe, keychain, keystore, password manager, wallet, locker, storage. One word has to carry "credential vault", "vault locked", "unlock vault" and "vault password" — check all four read well before deciding.

#### credential

**Means here:** one secret a module needs — an API key, token or endpoint — stored in the vault under a fixed key name.

**Part of speech in UI:** noun, usually plural ("Credentials missing").

**Example:** `config:credentialsMissingChip` — "Credentials missing"

**Not:** password, login, account, access data, identity, authorization. The vault *key names* themselves (`OPENAI_API_KEY`, `GENERIC_API_KEY__MY-OLLAMA`) are literal identifiers and are never translated.

#### disable / disabled

**Means here:** to turn a module, a glossary, a check or a setting off so the app stops using it, while it stays configured and can be turned back on. A module moves between the "Enabled ({{count}})" and "Disabled ({{count}})" sections of the same page; a disabled glossary keeps every term it has and shows an "Off" badge.

**Part of speech in UI:** verb on the control (`config:disableModule`, `glossary:disable`), participle for the state and the section heading (`config:modulesDisabledSection`, `glossary:disabledBanner`, `config:routing.moduleDisabledWarning`), and a bare badge (`glossary:disabled` — "Off"). **The enable/disable pair is one lexeme:** `config:enableModuleSelectLabel`, `glossary:enable` and `config:modulesEnabledSection` take the affirmative of whatever you choose here.

**Example:** `config:disableModule` — "Disable"

**Not:** ignore, skip, remove, delete, hide, cancel, omit. *Ignore* is the near one and the `ignore` row reserves against this term from its side: ignoring is done to an **entry**, by a person, and is undone from the same row; disabling is done to a **module or a feature** and changes what the app is able to do at all.

**English writes this one state three ways, and they are one state.** "Disabled" (`config:modulesDisabledSection`, `config:tm.policyDisabled`, `config:module.reasoningEffortDisabled`), "Off" (`glossary:disabled`) and "turned off" (`logs:translation.failedModuleDisabled`). Render them with **one** state word, the way *recording* handles English's audit/record/track — unless your locale's platform convention has a settled on/off pair for switch badges, in which case the badge may take that pair and everything else takes the participle. Either way `config:tm.policyDisabled` is the same state as `config:modulesDisabledSection` and must not become a third word.

**Two shipped locales drifted here before this row existed, which is the reason it is one.** `es` alternates two roots for one action — *Deshabilitar* at `glossary:disable` against *Desactivar* at `config:disableModule`, and *Desactivada* against *Deshabilitados* for the state. `ko` ships three forms of the state: 비활성화됨 for the section heading, 꺼짐 for the badge and 사용 안 함 for the memory policy. Nothing in the UI distinguishes those cases; the drift is invisible from inside any one namespace, which is why the row names all of them.

### Quality

#### LQA

**Means here:** Linguistic Quality Assurance: the deterministic check suite that runs on every translation. It is a separate system from the AI review — rules, not a model judgement — though the judge does file its issues into the same per-entry LQA results, always at warning severity, so an AI opinion can never fail the gate.

**Part of speech in UI:** acronym, used attributively — "LQA checks", "LQA gate", "LQA results", "LQA retries".

**Example:** `config:lqa.title` — "LQA Checks"

**Not:** QA, QC, quality control, linguistic testing. Keep it as `LQA` unless your language has an *established* localized form in the localization industry; if you do localize it, record the expansion in your row and use the same acronym in every LQA string, including the filter chip.

#### quality gate

**Means here:** the point where LQA verdicts are applied: an issue at blocking severity fails the gate and can trigger one automatic retry, while warnings are reported only.

**Part of speech in UI:** noun phrase; English also uses bare "the gate" once "quality checks" has been said.

**Example:** `config:lqa.description` — "Quality checks run on every translation. Blocking issues fail the gate and can trigger an automatic retry; warnings are reported only."

**Not:** door, gateway, portal, barrier, firewall, filter. Physical-door readings are the common trap; pick the process-control sense.

#### check

**Means here:** one named LQA rule — inline tag equality, length overflow, glossary adherence, number parity and so on — each configurable to blocking or warning severity.

**Part of speech in UI:** noun. The severity words are "blocking" and "warning"; keep both distinct from "error".

**Example:** `quality:checkLabels.overflow` — "Length overflow"

**Not:** test, control, verification, validation, inspection, rule. Use the same word in "quality check", "LQA checks" and each individual check name.

#### issue

**Means here:** one verdict an LQA check files against one translation, at blocking or warning severity. The judge's opinions are filed into the same per-entry list, always as warnings, so an issue is what the *results* contain regardless of who put it there.

**Part of speech in UI:** noun, usually counted ("{{count}} LQA issues").

**Example:** `strings:row.lqaIssues_other` — "{{count}} LQA issues"

**Not:** error, problem in the sense of a crash, defect, bug, violation — and **not** the word you chose for a source review's **finding**, which is an AI opinion about the source rather than a machine verdict about a translation. The two are listed on the same entry.

#### severity

**Means here:** how hard an LQA check fails — blocking or warning. Set per check; the value decides whether the gate fails and an automatic retry is triggered.

**Part of speech in UI:** noun.

**Example:** `config:lqa.checks.glossary-adherence.description` — "At warning severity the issue is informational only; set severity to blocking to trigger the automatic retry."

**Not:** level, priority, urgency, criticality, error. The two **values** are not this term — "blocking" and "warning" are fixed by *check* above and must not drift here.

#### notification severity

**Means here:** the three levels an account notification carries — info, warning, critical. A separate value set from the LQA *severity* above: these grade a message to the user, not how hard a check fails.

**Part of speech in UI:** a set of three value labels.

**Example:** `account:notificationsSeverity.critical` — "Critical"

**Not:** alarm, danger, error, priority. **"Warning" is not free to re-decide** — it is fixed by *check* above and must render identically here, or one product ships two words for one severity word.

#### assertion

**Means here:** one user-written regular expression the regex LQA check applies to a translation — which must match it, or must not. A check can carry several.

**Part of speech in UI:** noun.

**Example:** `config:lqa.regexAddAssertion` — "Add assertion"

**Not:** condition, check, rule, test, claim, statement. The first three are all taken — "condition" by routing conditions, "check" by the LQA checks themselves, "rule" by routing rules — so a fourth word is genuinely required rather than merely nice.

#### pattern

**Means here:** the regular expression itself, in the field beside an assertion. **This term is the regex sense only** — if English uses "pattern" elsewhere for a shape, a habit or a layout, that is a different word and this row does not cover it.

**Part of speech in UI:** noun.

**Example:** `config:lqa.regexPattern` — "Pattern"

**Not:** template, model, mask, sample, form. Whatever you choose must not be the word you gave **template** — several languages would otherwise use one word for both, and template is already carrying a reservation of its own.

#### overflow

**Means here:** a translation longer than the entry's allowed ratio of the source length — it would not fit the space available in game. Configured as an "overflow ratio" (default 1.75) and checked at the gate.

**Part of speech in UI:** noun; also attributive ("overflow ratio", "overflow only", "ignore overflow").

**Example:** `config:lqa.checks.overflow.name` — "Length overflow"

**Not:** excess, surplus, spill, flood, overrun, simply "too long". Keep it clearly different from **length limit** below — one is a ratio, the other a hard cap, and both appear in the same checks list.

#### length limit

**Means here:** a hard per-language character or UTF-8 byte cap imposed by the game editor; a translation exceeding either bound is flagged. The same phrase also names the routing-rule condition on source length.

**Part of speech in UI:** noun phrase.

**Example:** `config:routing.labelMaxLength` — "Entry length limit"

**Not:** max size, character count, quota, restriction, boundary, limitation. Do not reuse your **overflow** word: a length limit is absolute and set by the game, an overflow is relative to the source.

#### pass rate

**Means here:** the share of LQA results that passed, shown as a percentage on the Quality dashboard — as an overall figure, as a per-language and per-module column, and as three banded tiers in the legend.

**Part of speech in UI:** noun phrase; the table column header abbreviates it.

**Example:** `quality:columns.passRate` — "Pass rate"

**Not:** success rate, score, quality score, health. **"Success rate" is the trap**: `config:health.successRate` is a *different* metric in the same product (provider request success), so the two must not share a word.

### Terminology assets

#### glossary

**Means here:** a named list of terms with an approved translation per language, attached to a project and sent to the model as binding terminology. Can also be pushed to DeepL.

**Part of speech in UI:** noun.

**Example:** `strings:tabs.glossary` — "Glossary"

**Not:** dictionary, vocabulary, lexicon, word list, index, terminology base. If your locale's CAT tools have a settled word for this, use it — but use it for **glossary** only, not also for "translation memory".

#### glossary term

**Means here:** one row of a glossary: a source word or phrase plus its approved translation in each active language. A term missing any active language is flagged and excluded from matching and assignment.

**Part of speech in UI:** noun; shortened to "term" inside the Glossary tab.

**Example:** `glossary:totalTerms` — "Total terms:"

**Not:** word, expression, keyword, concept, item — and never **entry**, which is reserved for string entries. "Add a term" and "{{count}} entries" must not collide.

#### constant

**Means here:** a flag on a glossary term meaning the term is masked before the model sees it and restored verbatim in the translation — the model never translates it at all. A column in the Glossary table, a bulk action, and a badge in the review panels.

**Part of speech in UI:** noun used as a column header and a state badge; the badge is lowercase where the surrounding chips are.

**Example:** `glossary:colConstant` — "Constant"

**Not:** permanent, unchangeable, read-only, fixed, do-not-translate. **"Read-only" is the near-miss to avoid**: it is a different flag two columns away in the same table, and it means the row cannot be edited, not that the text is never translated.

#### match

**Means here:** one place where a glossary term was found in an entry's source text. The Glossary tab's Matches panel lists them, counts them, filters them by term, and compares entries with and without a glossary assigned. The same word is also the verb behind search results and routing conditions ("No models match your search", "Must match"); keep the noun and the verb on the same root wherever the language allows it.

**Part of speech in UI:** noun, usually plural ("{{count}} matches", "No matches found."), and a verb in the routing and search strings.

**Example:** `glossary:matchesPanel` — "Matches"

**Not:** hit, result, occurrence, finding, suggestion — and never the word you chose for **glossary term**: a term is what is searched for, a match is where it turned up.

#### translation memory

**Means here:** the store of approved translations, reused automatically for identical source text across every project. Approving is the only way a translation gets in — nothing a run produces is stored here until a person approves it (`config:tm.browserEmpty` states this to the user). Whether a stored translation is then reused, and how exact the match must be, is the project's memory policy. An industry concept (TM), with its own workspace page.

**Part of speech in UI:** noun phrase.

**Example:** `sidebar:translationMemory` — "Translation Memory"

**Not:** cache, history, archive, database, saved translations — and not bare "memory", which reads as RAM (`logs:vault.credentialsEvicted` genuinely means RAM). Use your locale's established CAT-tool term if one exists.

#### approve

**Means here:** to store a translation into translation memory so it can be reused later, and mark it reviewed at the same time. It is a promotion, not an edit — the text does not change. This is the only route into translation memory, which is why the word matters: if your rendering reads as "confirm" or "save", the user has no way to tell this action from the three around it.

**Part of speech in UI:** verb ("Approve to memory", "Approved {{count}} translations to memory").

**Example:** `strings:bulk.approveSelected` — "Approve to memory"

**Not:** accept, validate, confirm, authorize, publish, mark as done. Keep it distinct from "apply" (accept a suggestion), "mark as reviewed" (clear a flag) and "save" (persist an edit) — all four exist in the same bulk bar.

#### category

**Means here:** a content label assigned to entries, grouping them by kind of text. Used to filter, to match routing rules, and to keep related entries in one batch. Generated by AI or assigned by hand.

**Part of speech in UI:** noun. The tab label is singular ("Category"); the page title is plural ("Categories") — that is deliberate.

**Example:** `strings:tabs.category` — "Category"

**Not:** tag, group, type, class, genre, section, folder. Do not reuse your word for "rule group" or for "source label".

#### tone

**Means here:** a per-entry note on register or voice ("formal", "playful"), set in the Compare tab, matchable by routing rules and passed to the model. One value per entry.

**Part of speech in UI:** noun.

**Example:** `config:routing.labelTones` — "Tones"

**Not:** sound, pitch, tonality, mood, colour — the acoustic and visual senses are the trap. "Style" and "voice" are also wrong here, because they read as the model's writing style rather than an authoring instruction. If your language has no word separate from "register", use "register" consistently.

### Maintenance

#### orphan

**Means here:** an entry that a **full-replace** CSV import found missing from the imported file. It keeps its translations, is excluded from every AI run, is hidden from the strings list, and waits in the Orphans tab to be relinked or deleted. Only a full-replace import orphans anything — a merge import never does — and an entry stops being an orphan automatically if a later import (in either mode) carries it again.

**Part of speech in UI:** noun; also "orphaned" as an adjective ("{{count}} orphaned", "an orphaned string").

**Example:** `orphans:title` — "Orphans"

**Not:** obsolete, deleted, missing, unused, abandoned, lost, stray, dangling. If a literal "orphan" reads oddly in your language, choose one figurative noun and then use it for the tab title, the count chip, the confirm dialog and the log lines alike — do not describe the state differently in each place.

#### relink

**Means here:** to move an orphan's translations onto a different, existing entry, optionally followed by an AI pass that updates them to the new source text.

**Part of speech in UI:** verb; also used as a surface name ("resolve them later in the Relink tab").

**Example:** `orphans:relink.title` — "Relink orphan"

**Not:** reconnect, reattach, re-associate, remap, restore, merge, migrate — used interchangeably. One verb has to serve a row button, a dialog title, a confirm step and an import warning.

#### backup

**Means here:** a verifiable `.zip` of one project (its config, entries and glossary) stored on the server and restorable from the Backup tab.

**Part of speech in UI:** noun. The verb is "create a backup", never "to backup".

**Example:** `backup:createSection` — "Create backup"

**Not:** copy, save, archive, export, dump. Keep it separate from **export** (which downloads a JSON of everything) and from **snapshot** below.

#### snapshot

**Means here:** an automatic backup taken immediately before a risky operation — a CSV import, a re-translation, accepting AI suggestions — so the operation can be undone. English also calls these "restore points".

**Part of speech in UI:** noun.

**Example:** `config:importSnapshotNote` — "A safety snapshot was taken just before this import ({{date}}). You can restore it from the Backup tab."

**Not:** photo, screenshot, image, capture, instant. It must stay distinguishable from **backup**, because several strings use both in one sentence. (`config:templatesDescription` also uses "snapshots" loosely to describe templates — there it means a saved configuration, not a restore point.)

#### template

**Means here:** a saved, reusable project configuration — languages, routing rules, module settings and glossary selections — offered when creating a new project. There is also a routing-rule template. It is never a *text* template.

**Part of speech in UI:** noun.

**Example:** `config:templatesTitle` — "Project Templates"

**Not:** model, pattern, blueprint, preset, sample, form, boilerplate. **"Model" is the dangerous one**: in several Romance and Slavic languages it is the obvious word for template, and it is already taken by the AI model. Pick something else.

#### omit (from an export)

**Means here:** to leave rows out of an artifact the app generates — the export checkbox that drops entries not needing translation from the CSV the app writes. Nothing is deleted, nothing is refused: the entries stay exactly as they are, and only the generated file is smaller.

**Part of speech in UI:** verb, on a checkbox label.

**Example:** `config:discardUntranslatable` — "Discard entries that don't need translation"

**Not:** discard, delete, remove, skip, ignore. **English writes "discard" here and it is a third sense of that word**, distinct from both senses the *discard* term covers: it destroys nothing the user made and it refuses nothing the app offered. Most languages need a third verb for it, and every locale meets it early, in the config namespace. Four locales reached an omit/exclude verb for it independently, none having seen the others' files — the strongest evidence any term in this file carries.

### Collaboration

#### collaborator

**Means here:** a person invited into someone else's project. They may edit only their writable languages, and their runs use their own credentials and routing rules rather than the owner's.

**Part of speech in UI:** noun.

**Example:** `collab:join.description` — "Enter an invite code to join someone else's project as a collaborator."

**Not:** contributor, participant, partner, guest, editor, colleague, user. Not interchangeable with **member** — see below.

#### member

**Means here:** anyone with access to a project, the owner included. It is the row type of the Members table in the Sharing tab. Every collaborator is a member; the owner is a member but not a collaborator.

**Part of speech in UI:** noun.

**Example:** `collab:sharing.membersTitle` — "Members"

**Not:** collaborator (narrower), user, participant, account, person, team member. Two distinct words are required, because "Members" and "collaborators" appear in adjacent strings on the same page.

#### nickname

**Means here:** the public handle a person picks once, by which collaborators recognize them across shared projects. Set-once and never editable afterwards. Its format is Latin lowercase letters, digits and hyphens, 3–30 characters.

**Part of speech in UI:** noun.

**Example:** `collab:nickname.title` — "Nickname"

**Not:** username, alias, pen name, display name, account name. **"Username" is the one to avoid**: the app already has an account identity, and giving both the same name recreates exactly the confusion the *collaborator* / *member* pair exists to prevent.

#### claim

**Means here:** to take a nickname for yourself, permanently. One action, but the UI needs the whole family: a button, a progressive status while it runs, a success toast, and an immutability hint about what has already been claimed.

**Part of speech in UI:** verb, with a verbal noun and a participle.

**Example:** `collab:nickname.claimButton` — "Claim nickname"

**Not:** reserve, register, take, occupy, request. Whatever you pick must yield all four forms **and** stay distinguishable from "that name is **reserved**", which is a different, adjacent message.

#### invite

**Means here:** a one-time code the project owner generates so someone can join the project as a collaborator. It carries a status — pending, redeemed, revoked or expired — and an expiry date, and the code itself is shown exactly once.

**Part of speech in UI:** noun; the four statuses are a value set on one field.

**Example:** `collab:invites.title` — "Invites"

**Not:** invitation link, request, token, membership, access code used interchangeably. **Translate the four statuses as a set, in one part of speech** — they sit in one column and a reader compares them down the page.

#### revoke

**Means here:** to cancel an invitation that has been sent and not yet accepted. The row stays in the table and its status becomes *Revoked*; nothing is deleted, and nobody who already joined loses anything.

**Part of speech in UI:** verb on the button, participle as one of the four invite statuses.

**Example:** `collab:invites.revoke` — "Revoke"

**Not:** delete, remove, cancel, undo — each of which collides with something else in this product. Two constraints bind this row, and both were found at the call site rather than argued from the word. **The four invite statuses resolve as one set, in one part of speech** — see *invite*. And **the status cell and the revoke button are adjacent columns of one table**, so English's *Revoked* / *Revoke* pair is on screen at once: a language whose participle and infinitive coincide collapses the distinction in exactly the place a reader compares them, and needs a different verb rather than a different sentence.

#### recording

**Means here:** the manual-edit audit capturing who changed which translation by hand, kept for seven days and switched off when a project has no active collaborators. "Recording" names the capture being on or off; it is a process, not the captured rows.

**Part of speech in UI:** noun (a status), and the participle "recorded" for what it produced.

**Example:** `strings:runs.manualRecordingPaused` — "Recording paused — no active collaborators"

**Not:** log, history, tracking, audio or video recording, and above all **not the word you chose for _entry_**. Several languages' first word for "a record" is the same one they use for a content entry, and this app counts entries constantly — if the two collide, "Recording paused" reads as "Entry paused". Not the live server **log** either — that is a term of its own, and this is not it.

**English calls this same feature "audit", and there is no second term for it.** The Sharing tab's toggle is `collab:sharing.auditToggleLabel` — "Manual-edit audit" — and it switches on exactly the capture defined above; `collab:sharing.auditToggleCheckboxLabel` says "Record manual edits" and `auditToggleHelp` says "Track manual text edits…", so one feature is named three ways in three adjacent strings. **Render all of them with your _recording_ term.** Do not coin an audit word, and above all do not reach for the word you spent on the LQA **checks** — a translator meeting "audit" first will reach for it, which is why this paragraph is here rather than in a row of its own. The English inconsistency is filed in `english-review-notes.md`; the vocabulary is settled here.

### Product surfaces

#### stage

**Means here:** a playable level in the game. "Stage details" is the tab for a stage's name, gameplay details and description. It is game content — never a phase of a process or a step in a workflow.

**Part of speech in UI:** noun.

**Example:** `stage-details:title` — "Stage details"

**Not:** phase, step, stage of a process, progress level, platform, scene, theatre stage. This is the single most likely mistranslation in the whole app: almost every language's default reading of "stage" is the process one.

#### Text Styler

**Means here:** the workspace tool for applying colour and formatting tags to game text, with an AI assistant that can style a selection for you.

**Part of speech in UI:** proper noun (a product surface name).

**Example:** `sidebar:colorText` — "Text Styler"

**Not:** text editor, formatter, colour tool, rich text editor, style editor — used interchangeably. Translate the name once and use exactly that in the sidebar item, the tab label and the tool's own title.

#### element

**Means here:** one of the seven elemental colours in the Text Styler palette — Hydro, Pyro, Anemo, Electro, Dendro, Cryo, Geo — grouped under the "Elements" heading beside the plain-colour and quality swatch groups.

**Part of speech in UI:** proper nouns (swatch labels) plus a group heading.

**Example:** `colorText:groupElements` — "Elements"

**Not:** invented or literal translations of the Greek roots. These are **game content**: use the names the game itself ships in your language, and if it ships them untranslated, leave them.

#### assistant

**Means here:** the product's AI chat persona. The Text Styler's assistant, the Stage details chat and the generic chat are all the same one, and the run list labels their conversations. It names a **role**, not an act of assistance.

**Part of speech in UI:** noun, and a compound element ("Assistant chat (Text Styler)", "AI assistant").

**Example:** `colorText:assistant.title` — "AI assistant"

**Not:** assistance (the abstract noun — the near-miss a locale ships first and a review catches), helper, bot, agent, support. **Decide it the first time you meet it, not the second.** It appears first as a run-type label (`strings:runs.typeChatGeneric` and its two siblings) and only later on the chat surfaces themselves, so a locale that waits until it reaches the surfaces has already shipped a different word for the same persona. Where your language inflects a noun in compounds, record the linking form in your Notes — the compound is where the drift starts.

#### theme

**Means here:** one of the four visual styles the app ships — Classic, Pixel, Techno, Minimal — chosen in Settings and again in the first-run welcome flow.

**Part of speech in UI:** proper nouns (the four names) plus the noun "theme".

**Example:** `settings:themes.techno.name` — "Techno"

**Not:** skin, style, appearance, mode — and **each name must be byte-identical in both places it appears**: `settings:themes.*.name` and `welcome:themeChooser.names.*`. This is the highest-risk duplication in the app for a locale to get wrong, because the two are never on screen together; es currently ships "Tecno" in one and "Techno" in the other.

#### guide

**Means here:** the built-in documentation section, organised into topic pages grouped by task.

**Part of speech in UI:** noun (a sidebar item, and the target of every "read the guide" link).

**Example:** `sidebar:guide` — "Guide"

**Not:** help, manual, documentation, tutorial, handbook, FAQ — used interchangeably. Any of them may be the right word; using two of them is the bug.

#### release

**Means here:** one published version of the app, and by extension its changelog entry — the thing the Changelog page lists and the "Show older releases" control counts.

**Part of speech in UI:** noun.

**Example:** `common:changelogShowOlder` — "Show older releases ({{count}})"

**Not:** version (that is the number, `v1.56.0`), update, build, entry. **Not "entry"**: that word is reserved for a content entry, and this app counts those constantly.

#### changelog

**Means here:** the page listing what changed in each released version of the app.

**Part of speech in UI:** noun.

**Example:** `sidebar:changelog` — "Changelog"

**Not:** history, news, updates, release notes, versions, log, journal. Version numbers (`v1.56.0`) are never translated.

#### dismiss

**Means here:** two different consequences English spells with one word, and the difference is destructive. `account:notificationsDismiss` **deletes**: the notification store issues a DELETE and the item does not come back. `system:restarted.dismiss` closes a banner against a stored flag and destroys nothing.

**Part of speech in UI:** verb, on a button.

**Example:** `account:notificationsDismiss` — "Dismiss"

**Not:** close, hide — for the first of those two, where reading *dismiss* as "put it away" ships a false statement about an action that destroys data. You may use one word for both **only after checking which consequence the key in front of you has**; the two keys are far apart in the UI, which is exactly why the check has to be deliberate.
