# English source review — 2026-08-09

Applied before any translation work. Every change here is a change
translators do not have to redo later.

Scope: all 1,915 English strings across the 24 namespaces were read. A string was
changed only when it matched one of the five review criteria (terminology drift,
wrong register for the control, inconsistent casing, typo/grammar, mistranslation
risk). Nothing was rewritten for style preference, no key was renamed, added or
removed, and the `pseudo-test` language and the NARN brand name were left untouched.

**Criteria hit counts (English strings changed): 31**

| Criterion                            | Changed                     |
| ------------------------------------ | --------------------------- |
| 1 — terminology drift                | 7                           |
| 2 — wrong register for the control   | 0                           |
| 3 — inconsistent casing / typography | 21                          |
| 4 — typos and grammatical errors     | 3                           |
| 5 — ambiguity that will mistranslate | 0 (flagged only, by design) |

Spanish and French were updated for the 6 semantic changes only (13 values); the
casing-only changes were **not** mirrored, because es and fr already use sentence
case for controls and the English casing carries no meaning into them.

## Changes applied

| Key                                                     | Before                                              | After                                | Reason                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config:routing.labelMaxLength`                         | `Entry lenght limit`                                | `Entry length limit`                 | 4 — misspelling of "length".                                                                                                                                                                                                                              |
| `config:models.confidenceReason.batch-exceeds-reliable` | `{{entryCount}} entries exceeds the ~{{reliable}}…` | `…entries exceed the ~{{reliable}}…` | 4 — plural subject takes a plural verb.                                                                                                                                                                                                                   |
| `backup:toastRestoreSuccess`                            | `Backup restored correctly`                         | `Backup restored.`                   | 4/3 — "correctly" adds nothing, and the three sibling toasts (`toastBackupCreated`, `toastDeleteSuccess`, …) are terse and end with a period.                                                                                                             |
| `category:deleteConfirmBody_one`                        | `…removes «{{category}}» from…`                     | `…removes “{{category}}” from…`      | 3 — guillemets are a French/Spanish convention; the other two English strings that quote a value (`config:instances.slugReserved`, `strings:achievement.dialogSubtitle`) use curly double quotes. Left as `« »` in es/fr, where they are correct.         |
| `category:deleteConfirmBody_other`                      | same                                                | same                                 | same                                                                                                                                                                                                                                                      |
| `category:subtitle`                                     | `…from the Multi-language text tab.`                | `…from the Translations tab.`        | 1 — the tab is labelled **Translations** (`strings:tabs.strings`); "Multi-language text" is a stale name for it.                                                                                                                                          |
| `category:empty`                                        | `…from the Multi-language text tab.`                | `…from the Translations tab.`        | 1 — same.                                                                                                                                                                                                                                                 |
| `category:noEntriesInCategory`                          | `…from the Multi-language text tab.`                | `…from the Translations tab.`        | 1 — same.                                                                                                                                                                                                                                                 |
| `config:routing.categoriesConfiguredHint`               | `…in the Multi-Language Text tab.`                  | `…in the Translations tab.`          | 1 — same stale name, and cased differently again from the three above.                                                                                                                                                                                    |
| `settings:themes.default.name`                          | `Default`                                           | `Classic`                            | 1 — the same theme is called **Classic** in the first-run theme chooser (`welcome:themeChooser.names.default`), and calling it "Default" is now actively wrong: Techno is the default theme (`welcome:themeChooser.taglines.techno` — "The new default"). |
| `category:selectNoneEntries`                            | `Select none`                                       | `Deselect all`                       | 1 — the same control is `Deselect all` in config, generation, glossary and the run AI-review dialog.                                                                                                                                                      |
| `review:sourceAi.findingPrev`                           | `Prev`                                              | `Previous`                           | 1/3 — the sibling finding/entry navigators use `Previous` (`review:prev`, `review:translationAi.prev`). It is also the button's `aria-label`, where the abbreviation reads badly. es/fr already say "Anterior"/"Précédent", so no mirror was needed.      |
| `backup:createButton`                                   | `Create Backup`                                     | `Create backup`                      | 3 — its own section header is `Create backup`, and its sibling buttons are `Restore`, `Delete`, `Download`.                                                                                                                                               |
| `backup:deleteConfirmTitle`                             | `Delete Backup`                                     | `Delete backup`                      | 3 — sibling confirm titles are sentence case (`backup:confirmTitle`, `category:deleteConfirmTitle`, `orphans:confirmDelete.title`).                                                                                                                       |
| `batch:translateSelected`                               | `Translate Selected`                                | `Translate selected`                 | 3 — sibling run controls are sentence case (`strings:runs.startNow`, `strings:runs.moveUp`, …).                                                                                                                                                           |
| `batch:cancelRun`                                       | `Cancel Run`                                        | `Cancel run`                         | 3 — same control class.                                                                                                                                                                                                                                   |
| `config:chooseCsv`                                      | `Choose CSV File`                                   | `Choose CSV file`                    | 3 — sibling `config:downloadTemplate` is `Download template`; the CSV acronym stays capitalised.                                                                                                                                                          |
| `config:continueImport`                                 | `Continue Import`                                   | `Continue import`                    | 3 — same dialog as `config:importWarningsTitle` ("Review before importing"), sentence case.                                                                                                                                                               |
| `config:duplicateProject`                               | `Duplicate Project`                                 | `Duplicate project`                  | 3 — sibling `config:delete` is `Delete`; `sidebar:createProjectTitle` is `Create project`.                                                                                                                                                                |
| `config:deleteProject`                                  | `Delete Project`                                    | `Delete project`                     | 3 — same.                                                                                                                                                                                                                                                 |
| `config:confirmDeleteTitle`                             | `Delete Project`                                    | `Delete project`                     | 3 — same, its confirm dialog.                                                                                                                                                                                                                             |
| `config:routing.addRule`                                | `Add Rule`                                          | `Add rule`                           | 3 — the buttons beside it are `Add group`, `Remove group`, `Use template`, `Refresh models`.                                                                                                                                                              |
| `config:templateImport`                                 | `Import Template`                                   | `Import template`                    | 3 — its row siblings are `Export` and `Delete`.                                                                                                                                                                                                           |
| `config:saveAsTemplate`                                 | `Save as Template`                                  | `Save as template`                   | 3 — same template control group.                                                                                                                                                                                                                          |
| `config:unknownHeadersTitle`                            | `Unrecognized Headers`                              | `Unrecognized headers`               | 3 — the adjacent warning heading in the same dialog is `Raw line breaks`.                                                                                                                                                                                 |
| `strings:bulk.bulkOperation`                            | `Bulk Operation`                                    | `Bulk operation`                     | 3 — every item inside the popover it opens is sentence case (`Add category`, `Approve to memory`, `Clear selection`).                                                                                                                                     |
| `strings:bulk.aiGeneration`                             | `AI Generation`                                     | `AI generation`                      | 3 — same bulk bar.                                                                                                                                                                                                                                        |
| `strings:bulk.generateGlossaryFromSelection`            | `Generate Glossary from Selection`                  | `Generate glossary from selection`   | 3 — same popover.                                                                                                                                                                                                                                         |
| `strings:bulk.generateCategoriesFromSelection`          | `Generate Categories from Selection`                | `Generate categories from selection` | 3 — same popover.                                                                                                                                                                                                                                         |
| `strings:contextMenu.editCategories`                    | `Edit Categories`                                   | `Edit categories`                    | 3 — its own menu sibling is `Remove category {{category}}`.                                                                                                                                                                                               |
| `strings:contextMenu.enabledGlossaries`                 | `Enabled Glossaries`                                | `Enabled glossaries`                 | 3 — same context menu.                                                                                                                                                                                                                                    |

### Mirrored into es / fr

Only the six semantic changes were mirrored; casing was not (see above).

| Key                                                                   | es                                | fr                              |
| --------------------------------------------------------------------- | --------------------------------- | ------------------------------- |
| `backup:toastRestoreSuccess`                                          | `Copia de seguridad restaurada.`  | `Sauvegarde restaurée.`         |
| `category:subtitle`, `category:empty`, `category:noEntriesInCategory` | `…desde la pestaña Traducciones.` | `…depuis l'onglet Traductions.` |
| `config:routing.categoriesConfiguredHint`                             | `…en la pestaña Traducciones.`    | `…dans l'onglet Traductions.`   |
| `settings:themes.default.name`                                        | `Clásico`                         | `Classique`                     |
| `category:selectNoneEntries`                                          | `Deseleccionar todo`              | (already `Tout désélectionner`) |
| `review:sourceAi.findingPrev`                                         | (already `Anterior`)              | (already `Précédent`)           |

Deliberately **not** mirrored:

- All casing-only changes — es and fr already use their own sentence-case
  convention for controls, so the English casing carries no information into them.
- `category:deleteConfirmBody_*` — `« »` is correct typography in Spanish and
  French; only the English copy was moved to `“ ”`.

## Ambiguities flagged for translators (no English change)

| Key                                                                                                                                                                                                                                                                            | Ambiguity                                             | Intended reading                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config:importBtn`, `glossary:importBtn`, `config:routing.importBtn`                                                                                                                                                                                                           | noun or verb                                          | **verb** — each labels a button that starts an import.                                                                                                                                                                                                                                             |
| `config:routing.exportBtn`, `config:templateExport`, `glossary:exportCsv`, `glossary:exportTbx`                                                                                                                                                                                | noun or verb                                          | **verb** — button labels.                                                                                                                                                                                                                                                                          |
| `strings:compare.run` (`Run`)                                                                                                                                                                                                                                                  | verb ("run this") or noun ("a translation run")       | **noun** — it labels the run-picker filter in the Compare toolbar (`Run: [select]`), i.e. _which translation run_.                                                                                                                                                                                 |
| `strings:runs.judgeViewRaw` / `judgeViewDiff` (`Raw`, `Diff`)                                                                                                                                                                                                                  | adjective or noun                                     | **noun** — the two view modes of the suggestion panel.                                                                                                                                                                                                                                             |
| `glossary:disabled` (`Off`)                                                                                                                                                                                                                                                    | verb or state                                         | **state** — the badge shown on a disabled glossary.                                                                                                                                                                                                                                                |
| `strings:filters.matchAll` / `matchAny` (`AND`, `OR`)                                                                                                                                                                                                                          | boolean operators                                     | keep as the locale's usual boolean-filter wording; they are not sentence words.                                                                                                                                                                                                                    |
| `config:routing.anySource`, `config:routing.anyLang`, `config:module.batchByLanguage`, `config:module.batchByEntry`                                                                                                                                                            | look like sentences but are fragments                 | **fragments** rendered inline after a label or inside a rule summary; they must not be capitalised as sentences.                                                                                                                                                                                   |
| `strings:columns.config` (`STATUS`)                                                                                                                                                                                                                                            | why is it shouting?                                   | **intentional.** It sits in the string-table header row beside language names that the component uppercases in code (`getLangName(...).toUpperCase()`), so the literal uppercase keeps the row consistent. Translate it uppercase in the target language, or leave it if the language has no case. |
| `account:reportBugsPrefix` (`Found a bug? Report it to`), `strings:viewNotFoundContact` (`…please report it to`)                                                                                                                                                               | sentence fragments                                    | each is concatenated with a mailto link that follows it. Word order is fixed by the layout — languages that need the link earlier in the sentence cannot express it here.                                                                                                                          |
| `review:sourceAi.emptyHint` (`Run review checks every source entry…`), `review:translationAi.emptyHintRun` (`Review last run will judge…`)                                                                                                                                     | reads as broken grammar                               | the sentence **starts with an unquoted button label** (`Run review`, `Review last run`). Translate the button label identically to `review:sourceAi.runReview` / `review:translationAi.runReview`, then the verb.                                                                                  |
| `quality:overview` (`entry/entries`), `quality:overallStat.*`, `review:allItemsCount` / `approveAllSuccess` / `approveUnchangedPassingSuccess`, `review:sourceAi.allFindingsCount` (`entr(ies)`) / `lqaHint`, `strings:compare.flagAllNeedsReviewDone` / `markAllReviewedDone` | English "(s)" and "x/xes" pseudo-plurals              | these keys have **no** `_one`/`_other` forms, so a single string must cover every count. Use a count-neutral phrasing in the target language rather than imitating the parentheses. (A proper fix means adding plural keys — out of scope for this review, which does not add keys.)               |
| `colorText:swatches.*` (`Hydro`, `Pyro`, `Anemo`, `Electro`, `Dendro`, `Cryo`, `Geo`, `Key 1`, `Key 2`)                                                                                                                                                                        | game-domain colour names                              | these name in-game text colours. Use the target locale's established game terminology, or leave them in English if none exists.                                                                                                                                                                    |
| `stage-details:*` (`Stage`, `Gameplay details`)                                                                                                                                                                                                                                | "stage" = level, not a phase of a process             | game-domain term for a playable level.                                                                                                                                                                                                                                                             |
| `settings:appearanceDescription`, `collab:nickname.claimOnDesktop`, `strings:mobile.desktopOnlyBody`, `welcome:title`, `sidebar:aboutNarn`, `settings:themes.default.description`, `welcome:themeChooser.taglines.default`                                                     | the product name appears as `narn`, `Narn` and `NARN` | **never translate or re-case the brand.** The three spellings are inconsistent in English too (see "Observed, not changed"), but a translator must copy whatever the source string contains.                                                                                                       |

## Observed, not changed

Real findings this review deliberately left alone, with the reason:

1. **Product-name casing (`narn` / `Narn` / `NARN`).** Three spellings across
   seven strings. Fixing it is a brand decision, not a copy fix, and this task was
   scoped to leave the brand untouched. Worth settling before the backfill, since
   whatever is chosen gets copied into fourteen locales.
2. **Page and section titles are Title Case in some tabs and sentence case in
   others** (`Backup and Restore`, `Quality Dashboard`, `Translation Activity`,
   `Danger Zone`, `Workspace Settings`, `Routing Rules`, `LQA Checks` vs `Review
queue`, `Stage details`, `Categories`). Left alone on purpose: within the Global
   Config page the section headers are _consistently_ Title Case, so this is a
   design convention that differs by surface, not an arbitrary slip. Normalising it
   is a design decision — this review only fixed casing on **controls** (buttons,
   menu items, confirm-dialog titles), where sentence case is unambiguously the
   house style.
3. **"string" vs "entry" for the same object.** The `logs` namespace narrates in
   "strings" ("Queued {{total}} strings for translation", "Found {{count}} strings
   that are no longer in the source file"), while the rest of the UI counts
   "entries" everywhere. `logs` is internally consistent and deliberately written
   in a plain narrative register, so aligning it means rewriting ~12 sentences —
   more churn than this review's conservative bar allows. **Recommended canonical
   term for the terminology lexicon: "entry".** Worth a follow-up pass on `logs:*`.
4. **"Module" vs "Provider" for the thing you pick before an AI call.** The two
   assistant panels (`colorText:assistant.instanceLabel`, `stage-details:chatInstanceLabel`)
   and simple routing (`config:routing.simplePlaceholder`) say _Provider_; every
   other picker says _Module_ (`category:module`, `glossary:generateModule`,
   `review:sourceAi.module`, `strings:runs.aiReviewModule`, `orphans:relink.aiModuleLabel`).
   They may genuinely be different objects (a module vs a configured instance of
   one), so picking one is a product call, not a copy fix. The terminology lexicon
   work should decide and record it.
5. **`strings:tabs.category` is `Category` (singular) while the page it opens is
   titled `Categories`.** Left alone — tab labels are deliberately short.
6. **Quotation style is split three ways in English**: escaped straight quotes
   (`\"Review last run\"`, `\"Clear new flags\"`, `\"needs review\"`), curly quotes
   (`“{{slug}}”`, `“{{text}}”`) and — before this review — guillemets. Only the
   guillemets were fixed, because they are wrong for English; straight-vs-curly is
   a style call affecting ~10 strings.

## Bugs found while reviewing (not fixed here — they need key changes)

1. **Three plural forms never render.** `config:glossariesSkipped_plural`,
   `config:malformedRows_plural` and `config:exportRoundtripWarning_plural` use the
   legacy i18next v3 `_plural` suffix. The app runs i18next 26 with JSON v4 and no
   `compatibilityJSON` override, so only `_one`/`_other` are resolved: the three
   `_plural` keys are dead and the singular string renders for every count
   ("2 glossary disabled"). Fixing this renames keys, which this task must not do —
   it belongs with the backfill work that touches key shape.
2. **`strings:columns.source` (`SOURCE`) has no call site.** The string table
   renders the source _language name_ in that header instead
   (`StringTableGrid.tsx`), and the only `columns.source` lookup in the frontend is
   the `orphans` namespace's. Probably dead; deleting keys is out of scope here, so
   it will be translated into fourteen locales unless it is removed first.

## Identified but not applied — blocked by exact-match test assertions

Each of the following is a legitimate criterion 1/3 fix, but the English string is
asserted verbatim by a test outside this repository, which is versioned separately.
Applying the copy change without the matching test edit would turn that suite red.
They are listed here so the change can be made as one coordinated cross-repo commit
later. Note that each is a _pair or family_ — applying only the unblocked half would
create a new inconsistency, so the whole family was held back. The exact blocking
assertions (file and line) are tracked outside this repository, not reproduced here.

| Key(s)                                                                                                                                                                                  | Proposed change                                                                                                                                                                                                                                              | Blocker                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `glossary:assignGlossary`, `glossary:unassignGlossary`                                                                                                                                  | `Assign Glossary` / `Unassign Glossary` → sentence case                                                                                                                                                                                                      | Held back — an outside test asserts the current wording verbatim; needs a coordinated commit that lands with the matching test update.   |
| `glossary:confirmDeleteGlossaryTitle`, `glossary:confirmDeleteTitle`                                                                                                                    | `Delete Glossary` / `Delete Term` → sentence case                                                                                                                                                                                                            | Held back — an outside test asserts the current wording verbatim; needs a coordinated commit that lands with the matching test update.   |
| `collab:sharing.unselectAllLanguages`                                                                                                                                                   | `Unselect all` → `Deselect all` (the app-wide wording)                                                                                                                                                                                                       | Held back — an outside test asserts the current wording verbatim; needs a coordinated commit that lands with the matching test update.   |
| `orphans:relink.aiRetranslateLabel`, `orphans:relink.aiNoModules`, `orphans:toast.aiRetranslateStarted`, `orphans:toast.aiRetranslateUnavailable`, `strings:runs.typeRelinkRetranslate` | unify on the hyphenated form used everywhere else (`review:retranslate` "Re-translate", `backup:triggerPreRetranslate` "before re-translation", `strings:compare.translateModeRetranslate`): `retranslate`/`retranslation` → `re-translate`/`re-translation` | Held back — two outside tests assert the current wording verbatim; needs a coordinated commit that lands with the matching test updates. |

Playwright role/text selectors elsewhere (`getByRole('menuitem', { name: 'Edit Categories' })`,
`'Enabled Glossaries'`) are case-insensitive by default, so the casing changes that
_were_ applied do not affect them.
