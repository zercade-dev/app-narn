# Style guide — German (de)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/de.md`. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**du, not Sie — a house decision, not the German default.** German business software still
mostly addresses the user with _Sie_, and _Sie_ would be defensible for a tool that holds
paid API credentials and spends the user's own provider budget. We chose _du_ anyway,
because modern developer-tool German has largely settled on it — GitHub, Vercel and Linear
all use _du_ in their German UI — and because _du_ matches the English source's
informal-but-professional register instead of lifting it a notch into business formality.
Like every register call it is all-or-nothing: if it is ever reversed, it is reversed
across every string at once, never per string.

**Prefer constructions with no direct address at all.** The _du_ decision does not change
this: German UI convention is the impersonal infinitive for controls and instructions, so
`sidebar:selectProject` ("Select a project") is "Projekt auswählen" — neither "Wähle ein
Projekt aus" nor "Wählen Sie ein Projekt aus". Reserve _du_ for sentences that genuinely
address the user, such as `vault:createDescription` ("…You will need this password to
unlock the vault each session") — "Du benötigst dieses Passwort…".

Button labels are always infinitives: "Speichern", "Löschen", "Abbrechen". _du_ makes this
rule harder to hold, not easier: it hands you a real imperative — "Speichere", "Lösche",
"Wähle" — that _Sie_ never offered, and that form is wrong on anything clickable. If the
string labels a control, it is an infinitive.

Where a full sentence really does instruct the user, the du-imperative is right, and it is
irregular in a way the _Sie_ form never was: strong verbs **with an e→i/ie stem change**
take that changed stem and drop the final -e — _gib_, not "gebe"; _lies_, not "lese";
_nimm_, not "nehme". `account:mfaDisableHint` ("Enter a current code from your
authenticator app…") is "Gib einen aktuellen Code aus deiner Authenticator-App ein…".

That is the only class that shifts. Verbs that umlaut in the present tense do **not** umlaut
here (_fahr_, not "fähr"; _lauf_, not "läuf").

The final **-e is a separate question, and it is not simply dropped.** Four stem shapes
_require_ it, and several of their verbs are everyday words in this UI:

- Stems ending in **-d** or **-t**: _Warte_, _Sende_, _Beende_, _Finde_, _Lade_ — never
  "Wart", "Send", "Beend".
- Stems ending in a **consonant + m or n**, where that consonant is not l, m, n, r or h:
  _Öffne_, _Atme_, _Rechne_, _Zeichne_. The excluded letters are what make _lern_, _komm_
  and _film_ fine without it.
- Stems ending in **-ig**: _Bestätige_, _Benachrichtige_, _Entschuldige_.
- Verbs in **-eln / -ern**, which keep the ending and contract the stem instead: _Sammle_
  (sammeln), _Wechsle_ (wechseln), _Ändere_ (ändern) — not "sammel", "wechsel", "änder".

For every other verb the -e is genuinely optional (_mach_ or _mache_, _sag_ or _sage_,
_geh_ or _gehe_). Drop it there — the short form is the current UI register — and keep it
only where one of the four shapes above forces it.

_du_, _dich_, _dir_ and _dein_ are lowercase — see the casing section. And whatever you do,
never mix _du_ and _Sie_, in any string class: labels, errors, toasts and prose share one
voice, and one slip is visible immediately.

## Control shapes — resolve the control before you translate the string

English writes the same words for a title, a button, a column header and a placeholder.
German does not. `config:models.select` and `config:models.pickTitle` are byte-identical in
English ("Select a model") and are two different controls; they ship as "Modell auswählen"
(the picker's trigger) and "Modellauswahl" (the dialog title). Settled for `de`, from batch 1:

| Control | Shape | Example |
| --- | --- | --- |
| Page title, section heading, tab label | **noun phrase** (a compound where German has one) | `config:importCsv` "CSV-Import", `config:models.pickTitle` "Modellauswahl", `config:reviewProgress` "Prüffortschritt" |
| Button | **bare infinitive**, object first | `config:delete` "Löschen", `config:deleteProject` "Projekt löschen", `config:saveAsTemplate` "Als Vorlage speichern" |
| Confirm-dialog title | **infinitive**, which in German is the same string as the button | `config:confirmDeleteTitle` "Projekt löschen" |
| Select / combobox placeholder | **infinitive phrase**, not a title | `config:enableModulePlaceholder`, `config:routing.simplePlaceholder` |
| Table column header | **bare noun**, and it keeps English's abbreviation where English has one | `config:models.colParameters` "Param.", `config:models.colQuantization` "Quant." |
| Progress / status text | **`wird` + participle**, or a deverbal noun — never an infinitive, which would read as a command | `config:autoSaveSaving` "Wird gespeichert…", `config:duplicating` "Wird dupliziert…", `config:importing` "Import läuft…" |
| Inline fragment inside a summary row | **determiner + noun**, lowercase-initial, no sentence punctuation | `config:routing.anySource` "jede Herkunft", `config:routing.anyLang` "jede Sprache", `config:routing.noModule` "kein Modul" |

**The summary-row shape is a determiner, not an adjective**, and that is the part worth
copying rather than the word. English's *any* invites a German adjective (*beliebig*), which
costs five characters in the densest row in the app for no gain; the determiner *jede* says
the same thing and is what German writes here. It also stays distinct from *alle*, which is
spent on the "All …" select options (`config:routing.allTones`, `config:routing.allCategories`)
— English separates *any* from *all* in exactly the same two places.

**German collapses the title/button distinction that other languages keep.** A dialog title
naming an action and the button that performs it are both "Projekt löschen", because the
German infinitive *is* the deverbal form. That is not drift and must not be "fixed" by
inventing a nominalization for one of them.

**Instructions inside a sentence: prefer the impersonal infinitive over the du-imperative.**
The register section already says this; batch 1 applied it to every instruction that is not
about the reader personally — `config:importSheetDescription` is "Festlegen, wie…",
`config:malformedRowsHelp` ends "…korrigieren und erneut importieren." The du-imperative is
kept where the sentence really is about the reader's own choice
(`config:structuredOutputExperimentalWarning` "Probier sie … aus und behalte, …") — which is
also where the short imperative form reads naturally rather than clipped.

## Surface names — one rendering, repeated verbatim

A surface is named in several namespaces at once, and the namespaces are translated in
different batches. Every key naming the surface takes the **same** rendering, and prose that
mentions it repeats that rendering verbatim. Settled so far:

| Surface | German | Where it is already shipped / where it is owed |
| --- | --- | --- |
| Global Config | **Globale Konfiguration** | `config:globalConfigTitle` (shipped). `sidebar:globalConfig` must be word-for-word identical — 21 chars, inside the 26-char sidebar budget. |
| Workspace Settings | **Workspace-Einstellungen** | `config:workspaceSettingsTitle` (shipped). |
| Translation Memory | **Translation Memory** | `config:tm.policyTitle`, `config:tm.browserTitle` (shipped); `sidebar:translationMemory` owes the same. |
| Backup | **Backup** | `config:importSnapshotNote`, `strings:tabs.backup`, `strings:guide.topicBackup` (all shipped). |
| Translations | **Übersetzungen** | `config:routing.categoriesConfiguredHint`, `strings:tabs.strings`, `strings:guide.topicMultiLanguage` (all shipped). |
| Compare | **Vergleich** | `config:routing.tonesHint`, `strings:tabs.compare`, `strings:guide.topicCompare`, `strings:order.presortHint` (all shipped). |
| Orphans | **Waisen** | `config:fullReplaceOrphanNotice`, `strings:tabs.orphans`, `strings:guide.topicOrphans` (shipped); `orphans:title` owes the same. English calls it the "Relink tab" in the config string — a stale name, not a second tab. |
| Guide | **Guide** | Named in prose by `config:pseudoTestHelpLink` (shipped); `sidebar:guide` owes the same. |
| LQA Checks | **LQA-Prüfungen** | `config:lqa.title` (shipped). |
| Project Templates | **Projektvorlagen** | `config:templatesTitle` (shipped); the singular section title is `config:saveAsTemplateTitle` "Projektvorlage", matching English's own singular/plural split. |
| Config | **Konfiguration** | `strings:tabs.config` (shipped); `strings:guide.topicConfig` repeats it. Distinct from **Globale Konfiguration**, which is the workspace-level page above it. |
| Data | **Daten** | `strings:tabs.data` (shipped). |
| Source AI review | **Quelltext-KI-Review** | `strings:tabs` (review-source-ai) and `strings:tabPlaceholder` (review-source-ai), shipped; batch 3's `review:sourceAi.configTitle` owes the same. The bare **Quelltext-Review** is the *term* in prose and is a different string — see `../terminology/de.md`. |
| Translation AI review | **Übersetzungs-KI-Review** | `strings:tabs` (review-translation-ai), shipped; batch 3's `review:translationAi.title` owes the same. |
| Manual review | **Manuelles Review** | `strings:tabs` (review-manual), shipped. |
| Quality | **Qualität** | `strings:tabs.quality`, `strings:guide.topicQuality` (shipped). |
| Glossary | **Glossar** | `strings:tabs.glossary`, `strings:guide.topicGlossary` (shipped). |
| Category | **Kategorie** | `strings:tabs.category`, `strings:guide.topicCategory` (shipped). Singular on purpose, as in English, even though the page it opens is plural. |
| Routing | **Routing** | `strings:tabs.routing`, `strings:guide.topicRouting` (shipped). |
| Activity | **Aktivität** | `strings:tabs` (runs), `strings:guide.topicActivity` (shipped). The page title `strings:runs.title` deliberately expands to "Übersetzungsaktivität" — expand it, never shorten the page title to match. |
| Stage details | **Level-Details** | `strings:tabs` (stage-details), `strings:runs.typeStageDetailsTranslation` (shipped); batch 6's `stage-details:title` owes the same. |
| Sharing | **Zusammenarbeit** | `strings:tabs.sharing`, `strings:tabPlaceholder.sharing` (shipped); batch 4's `collab:sharing.pageTitle` owes the same. *Freigabe* was rejected — *freigeben* is the **approve** term (into Translation Memory) and the two would read as one feature. |
| Text Styler | **Text-Styler** | `strings:tabs` (color-text) (shipped); `sidebar:colorText` and `colorText:title` owe the same. |
| Review (sidebar group) | **Review** | `strings:guide.groupReview` (shipped); batch 4's `sidebar:groups.review` owes the same. |
| Setup (sidebar group) | **Einrichtung** | `strings:guide.groupSetup` (shipped); batch 4's `sidebar:groups.project` owes the same — note the key is `project` while its English is "Setup". |
| Translate (sidebar group) | **Übersetzen** | `strings:guide.groupTranslate` (shipped); batch 4's `sidebar:groups.translate` owes the same. |
| Terminology (sidebar group) | **Terminologie** | `strings:guide.groupContent` (shipped); batch 4's `sidebar:groups.content` owes the same — again the key name and the English differ. |
| Maintenance (sidebar group) | **Wartung** | `strings:guide.groupMaintenance` (shipped); batch 4's `sidebar:groups.maintenance` owes the same. |
| Translation Memory (guide topic) | **Translation Memory** | `strings:guide.topicTranslationMemory` and `strings:guide.groupTranslationMemory` (shipped), matching the term. |

**How a tab is named inside a sentence: `im Tab <Name>`.** Not "im Backup-Tab" and not
"im Tab „Backup“". The bare, unhyphenated, unquoted name after the word *Tab* is what lets a
later batch grep for the rendering and repeat it: `config:importSnapshotNote` "im Tab Backup",
`config:routing.tonesHint` "im Tab Vergleich", `config:routing.categoriesConfiguredHint`
"im Tab Übersetzungen", `config:fullReplaceOrphanNotice` "im Tab Waisen".

**A guide topic that appends "Tab" takes the same shape, without the preposition.**
English writes "Config Tab", "Translations Tab"; German writes the word first and the bare
surface name after it — `strings:guide.topicConfig` is "Tab Konfiguration",
`strings:guide.topicMultiLanguage` is "Tab Übersetzungen", and the other six follow. Not
"Konfigurations-Tab": the compound buries the surface name inside a word, which is what a
later batch greps for, and it disagrees with the `im Tab <Name>` sentence form for no gain.
`topicActivity` and `topicQuality` have no "Tab" in English and get none in German.

## Decisions this locale has settled that are NOT lexicon terms

`terminology.md` is frozen at 76 terms and `terminology/de.md` may not grow rows, so a
rendering that binds a later batch and has no term row lives **here**. Each row names the keys
that fixed it and the keys that inherit it; a later batch reuses the rendering rather than
re-deciding it.

| Concept | German | Fixed by | Inherited by |
| --- | --- | --- | --- |
| **ignore / ignored** — exclude from AI dispatch | verb *ignorieren*, participle *Ignoriert*, negation *nicht mehr ignorieren* | `strings:row.ignored`, `strings:row.ignoreAction`, `strings:row.unignoreAction`, `strings:bulk.ignoreEntry`, `strings:editor.ignoreOverflow` | `review:sourceAi.ignore` and its toasts (batch 3), `generation:ignoreGlossariesLabel` (batch 5) |
| **revert** — undo a whole run's writes | *Zurücksetzen* / *Zurückgesetzt* | `strings:runs.revert`, `strings:runs.revertedBadge`, `strings:runs.revertSuccess_other` | — |
| **undo** — one edit | *Rückgängig* | `strings:compare.undo`, `strings:editor.undo` | — |
| **verdict** — the judge's per-entry ruling | *Urteil* | `strings:runs.judgeAllFindingsDescription` | batch 5's `logs:judge.done`, whose `{{verdict}}` token this names |
| **assistant** — the chat persona | *Assistent*, weak masculine; linking form *Assistenten-* in a compound | `strings:runs.typeChatGeneric` | batch 6 owes "KI-Assistent" at `colorText:assistant.title` and the same noun at `stage-details:chatAssistant` |

**`revert` and `undo` must not collapse into one word.** English keeps them apart and so does
this locale: *Rückgängig* is the single-edit undo in the compare cell and the editor, while
*Zurücksetzen* reverses everything one run wrote. A fix round that "harmonizes" them destroys a
distinction the UI relies on — both controls can be on screen at once.

**Why *Urteil*, deliberately, and why it does not reach *Befund*.** The two words look
adjacent and are not. A *Befund* is the source review's observation — reported, never
adjudicated, which is why that term row rejected the evaluative candidates. A **verdict** is
the judge's per-entry ruling, and the judge genuinely does adjudicate: it scores, and it
returns pass or fail (`strings:runs.judgeVerdictPass` / `judgeVerdictFail`). *Urteil* is the
ordinary German word for exactly that, English chose "verdict" rather than a softer word, and
the alternatives are all spent — *Bewertung* is the **judge** term itself, *Ergebnis* is an LQA
result, *Befund* is a finding. The lexicon's ban of *richten* / *Richter* for **judge** binds
those two lexemes — the person, and the act of sitting in judgement — and does not reach the
noun *Urteil*, per the rule that a reservation states the part of speech and sense it binds.
**Scope of this reservation:** *Urteil* is the judge's ruling and nothing else. A source-review
output is a *Befund*, an LQA output is a *Beanstandung*.

**Assistent is a weak masculine noun (n-Deklination).** It takes *-en* in every case but the
nominative singular, and its compound linking form is *Assistenten-*, not the bare stem —
"Assistenten-Chat", the way German writes *Studentenausweis* or *Assistentenstelle*. Batch 2
first shipped *Assistenz-*, which is **assistance**, an abstract quality, not the persona the
app means; the review caught it. Do not re-shorten the compound to "Assistent-Chat".

## Casing

German capitalizes **all nouns**. That is orthography, not Title Case, and it applies
regardless of what English does: "Projekt löschen", "Routing-Regeln", "Zeilenumbruchparität"
(all three shipped, at `config:deleteProject`, `config:routing.title` and
`config:lqa.checks.line-break-parity.name`).

The address pronouns are the counter-example: _du_, _dich_, _dir_, _dein_ and their
inflections are **lowercase** in current orthography — never capitalized as an honorific in
a UI, though sentence-initial capitalization applies as normal ("Du benötigst dieses
Passwort…" in the register section is right for that reason). A **mid-sentence** "Du" or
"Dein" is the tell: it is usually a _Sie_-form reflex, since _Sie_ and _Ihr_ are capitalized
in any position, and it reads as a register slip rather than as politeness.

Do **not** mirror English Title Case, and do **not** lowercase German nouns to imitate
English sentence case — both produce wrong German. `english-review-notes.md` records that
the English Title/sentence split is a per-surface design convention with no meaning outside
English.

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "STATUS", which happens to be identical.

Adjectives derived from language names are lowercase ("deutsch"), the language name itself
is a noun and capitalized ("Deutsch").

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quotation marks are **German low-high: `„…“`**, not `“…”` and not `«…»`. Where English
  quotes a value (`category:deleteConfirmBody_one` — `“{{category}}”`), German writes
  `„{{category}}“`.
- Ellipsis is the single character `…` (U+2026), matching `backup:creating` ("Creating
  backup…") — "Sicherung wird erstellt…".
- Use **ß**, not "ss", where the rule calls for it ("Größe", "außer"). This locale is
  standard German; the Swiss variant that drops ß is a different locale.
- Hyphenate mixed compounds rather than running them together: "Routing-Regel",
  "API-Schlüssel", "Token-Limit".
- Em dashes in the source stay em dashes with spaces around them.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. A no-break space before `%` — `config:health.successRate`
is "Erfolg {{rate}} %" and `config:models.gpuPlacement` is "{{pct}} % GPU". **Both spaces
in that sentence are literal U+00A0**, copied from the shipped values — an earlier draft of
this line wrote them as ordinary spaces while claiming otherwise, which is a citation that
teaches the exact mistake it is warning about. Copy the character, do not retype it.

**One exception, and it is not a style call: a number the reader types back into a field
keeps the format that field parses.** `config:overflowRatioDescription` documents the default
overflow ratio as `1.75`, with a point, because the input beside it parses a point; writing
"1,75" would document a value the app rejects. Prose *about* quantities takes the German
convention as normal.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Counting: only `count` selects a plural form

`{{count}}` has a plural family behind it and inflects normally — `config:routing.ruleCount_one`
"{{count}} Regel" / `_other` "{{count}} Regeln". **Every other numeric token has no plural
machinery at all**, so a German noun after it is grammatical for some values and wrong for
the rest, silently. German inflects almost every counted noun, so this bites far harder here
than the English source suggests.

The device, and it is forced rather than preferred: **an invariant noun phrase, then a colon,
then the number.** Batch 1 used it for `{{entryCount}}`, `{{tokens}}`, `{{context}}`,
`{{chars}}`, `{{bytes}}`, `{{maxLength}}`, `{{rules}}`, `{{reviewed}}`/`{{total}}` —
`config:lqa.lengthLimitValue` is "Zeichen: {{chars}} / Bytes: {{bytes}}",
`config:reviewProgressCount` is "Geprüft: {{reviewed}} / {{total}}",
`config:templateMeta` is "Sprachen: {{languages}} · Routing-Regeln: {{rules}}".
A bare ratio with no noun (`{{done}}/{{total}}`) works too.

**A plain English key that interpolates `{{count}}` without a plural family gets the same
treatment** — do not add a German plural family over it, no shipped locale does. English
"{{count}} rows processed" is `config:rowsProcessed` "Verarbeitete Zeilen: {{count}}", and
its four siblings (`new`, `removed`, `changed`, `skipped`) follow the same paradigm.
An invariant participle is the other way out: `config:orphanedCount` "{{count}} verwaist"
and `config:routing.nSelected` "{{count}} ausgewählt" need no rephrasing at all.

**Do not "fix" this by interpolating `{{count}}` instead.** The gate compares the multiset of
tokens against English; swapping a token is two violations, not a clever fix.

`node scripts/i18n-preflight.mjs de` is what proves this held: it reports every
non-skiplisted `{{token}}` followed by a German word. Batch 1 landed at **14 raw, 0 after
the token axis**, so `de` had no word-axis exemption list. Batch 2 hit **8 token-axis
survivors before its `usageTokens` fix and 6 after** (4 distinct words); re-running the
detector over the shipped tree today gives **48 raw / 6 / 0**. Quote whichever figure you
mean *with the state it reproduces in* — "landed at 50/8" reads as the shipped state and is
not. Building the word list is what separated the survivors:

- **One was a real defect and was fixed in the string, not exempted.**
  `strings:runs.usageTokens` first read "{{input}} Eingabe / {{output}} Ausgabe", where both
  nouns sit after a non-`count` number and would have to pluralise. It ships as
  "Tokens — Eingabe: {{input}} / Ausgabe: {{output}}" — the label before the colon, the
  number after it, which is the device this section already prescribes.
- **Four words were exempted**, and `NUMERAL_WORD_AXIS_EXEMPTIONS.de` in
  `scripts/i18n-preflight.mjs` now holds them: *von* (preposition), *entfernen* and
  *kopieren* (infinitives on control labels), *markiert* (invariant predicative participle).
  None can inflect for number.

The list was derived **only** from the eight post-token-axis survivors, never from the 50 raw
matches — deriving it from the raw set would have exempted ordinary counted nouns that are
correct after `{{count}}` and wrong after anything else. Add to it the same way.

## Length discipline

German runs **10–35% longer** than English, and the worst case is not the sentence but the
**single unbreakable compound**: "Schlusszeichensetzung" (21) and "Kontextübereinstimmung"
(22) both shipped in batch 1, at `config:lqa.checks.end-punctuation.name` and inside
`config:tm.policyStrict`. A compound that overflows cannot wrap, so it clips.

This rule has already **decided two terms**, which is the clearest evidence that it is worth
holding: *Anmeldeinformationen* (21) was rejected for **credential** in favour of
"Zugangsdaten", and *Übersetzungsspeicher* (20) was rejected for **translation memory** in
favour of "Translation Memory" — see `terminology/de.md`. Both are correct German and
neither is what this locale ships; do not reintroduce either from an older draft of this
file, which used both as examples.

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

Two rules for those classes:

1. **Budget in absolute characters, per class — never as a multiple of English.** See the
   table below.
2. **No single unbroken token longer than about 20 characters.** If the natural compound
   is longer, split it with a hyphen ("Backup-Datei") or use a two-word form — do not insert
   soft hyphens or any other markup, which would trip the inline-tag checks.

### Why the budget is in characters, and not in multiples of English

**A ratio is the wrong unit, because it scales with the English source rather than with the
container.** It punishes exactly the strings that need the most room: `sidebar:legal` is
"Legal", five characters, so a 1.5× rule grants seven and a half — no correct German
rendering of it can exist. Meanwhile a 44-character English label like
`strings:bulk.approveSelected` clears the same rule with room to spare while sitting on one
of the tightest surfaces in the app. This guide used to carry a "never exceed ~1.5× the
English character count" rule; the Russian pilot audited every constrained-surface key in
all 24 namespaces against it and found **27** breaches, in every batch, **none of which was
a wrong string**. The rule was, so it is gone.

**The five classes are also not equally constrained.** Only the sidebar has a hard, fixed
width: `16rem` (`SIDEBAR_WIDTH` in `components/ui/sidebar.tsx`), with every item label
wrapped in `truncate`, so overflow silently ellipsizes. Tab bars, table columns, filter rows
and the bulk bar scroll, auto-size or wrap — going long there costs elegance, not
correctness.

| Class                                                    | Budget              | Kind                                      |
| -------------------------------------------------------- | ------------------- | ----------------------------------------- |
| Sidebar item (`sidebar:globalConfig`, `sidebar:legal`)   | **26**              | **hard** — fixed 16rem, truncates         |
| Tab label (`strings:tabs.backup`)                        | **26**              | **hard** — the same container; see below  |
| Table column header (`strings:columns.config`)           | **18**              | soft — columns auto-size                  |
| Filter label (`strings:filters.needsReview`)             | **36**              | soft — the filter row wraps               |
| Bulk-bar control (`strings:bulk.approveSelected`)        | **36**              | soft                                      |

The sidebar figure is derived from that fixed container, so it is a property of the UI and
carries over to every language unchanged — treat it as binding from the first string.

**All five are now measured.** None was copied from another language's guide: the numbers in
`style/ru.md` were measured from Russian's own shipped strings and mean nothing here. The
three soft figures are the longest rendering the class actually needed in `config` and
`strings`, rounded up; re-measure and raise them if a later batch needs more, exactly as
batch 2 did for the tab label. A soft budget means "prefer the shorter of two correct
options", never "shorten the agreed rendering in `terminology/de.md` to hit a number".

### The tab label is not a tab bar — it is the sidebar, and it is hard

Batch 1 recorded a **provisional 20** for this class and warned that the main tab bar would
raise it. Batch 2 owns `strings:tabs.*` and measured the container instead of forecasting
it, and the forecast's premise turned out to be wrong in a way that matters more than the
number:

**`strings:tabs.*` has exactly one call site, and it is not a tab bar.** It is
`components/layout/Sidebar.tsx`, which renders every tab label as
`<span className="truncate">` inside a `SidebarMenuButton` — the same 16rem sidebar the
"sidebar item" row above describes. There is no horizontal tab strip in this app; the
runbook's "the main tab bar is a wider, scrolling container" does not describe this UI.
So the class is **hard, not soft**: a label over budget is silently ellipsized, exactly like
a sidebar item.

The arithmetic, from `components/ui/sidebar.tsx`: `SIDEBAR_WIDTH` is `16rem` = 256px, less
the 1px right border, less `SidebarGroup`'s `p-2` (16px), less `SidebarMenuButton`'s `p-2`
(16px), less the leading `size-4` icon (16px) and its `gap-2` (8px) — **199px** for the
truncating label at `text-sm`. That is the same 199px a plain sidebar item gets, since those
carry an icon too, which is why the two rows now share one figure. At ~7.6px average advance
for mixed-case German at 14px, 199px is ~26 characters — independently reproducing the 26
this guide already carried for the sidebar. Nobody has measured rendered pixel widths; if a
future rendering needs to go past 26, look at the running app before deciding.

The longest tab label this batch actually needed is **"Übersetzungs-KI-Review" (22)**, four
characters inside the budget. Batch 1's forecast of a ~27-character rendering
("KI-Review der Übersetzungen") was for a different shape and did not ship: the settled
surface name is the hyphenated compound, which is the ordinary German way to build it and
happens to fit. **This is not a surface name shortened to meet a budget** — the compound was
chosen for parallelism with "Quelltext-KI-Review" and with the *KI-Review* term, and the
budget was measured afterwards.

**What batch 1 (`config`) contributes to that measurement.** `config` holds no sidebar item,
no filter label and no bulk-bar control, so it moves none of those three rows.

It does hold **three tab labels** — the routing editor's own tab bar,
`config:routing.tabRules`, `tabTemplates` and `tabImportExport`, whose longest rendered value
is **15** ("Import / Export"; the other two interpolate a count and render at ~11 and ~13).
That is a genuinely different container from `strings:tabs.*`: an in-panel secondary strip
inside one panel, which does not truncate. It contributed the provisional 20 this row used
to carry; the measured 26 above replaces it, and the two containers are noted here only so
nobody re-derives the smaller figure from `config` again.

It also holds one table-column-header class — the model picker's `config:models.col*` —
whose longest German rendering is **11** characters ("Fähigkeiten"); "Param." and "Quant."
keep English's abbreviation, and `config:models.colConfidence` is "Konfidenz" (9) rather
than the 23-character *Zuverlässigkeit* for that reason. `config:globalConfigTitle` is
"Globale Konfiguration" (21) and is **binding on the sidebar**, since `sidebar:globalConfig`
must be identical: it fits the hard 26 with five characters to spare.

**What batch 2 (`strings`) contributes.** It is the namespace that anchors four of the five
classes, so it moved all four. Tab label: see the section above. Table column header: the
longest of the sixteen `strings` headers is "Bearbeiten von" / "Wiederholungen" (both 14),
against `config`'s longest of 11 — hence **18**. Filter label: the longest of the twenty-five
`strings:filters.*` values is "Nur unübersetzte Einträge anzeigen" (34) — hence **36**.
Bulk-bar control: the longest control label is "Kategorien aus Auswahl generieren" (33), with
"Ins Translation Memory freigeben" (32) just behind it — hence **36** as well. `strings` holds
no sidebar item, so the hard 26 there is unchanged.

Measured expansion against the English source, one ratio per key:

| Batch | Keys | en chars | de chars | Aggregate | Median | 90th pct | Max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 — `config` | 374 | 13,015 | — | 1.23 | 1.22 | 1.50 | 2.83 |
| 2 — `strings` | 452 | 9,900 | 12,643 | 1.28 | 1.23 | 1.80 | 3.75 |

Batch 1's max is `config:batchGroupingCustom` ("Custom" → "Benutzerdefiniert") and batch 2's
is `strings:runs.judgeVerdictFail` ("Fail" → "Nicht bestanden"); both ratios are measuring
English's brevity on a four-to-six-character source, which is exactly why the budgets above
are absolute rather than multiples. The aggregate barely moved between the two batches, but
the **90th percentile went 1.50 → 1.80** — `strings` is chrome-heavy, and chrome is where a
short English label meets a German compound. The tail is the number that threatens layout.
(Both `strings` rows are measured on the post-fix-round file; the pre-fix-round figures were
12,615 chars, aggregate 1.27, p90 1.75.)

**Two unbreakable tokens over the 20-character rule shipped in batch 1**, both on
unconstrained surfaces where the rule does not bite: "Schlusszeichensetzung" (21,
`config:lqa.checks.end-punctuation.name`, an item in a scrolling check list) and
"Kontextübereinstimmung" (22, inside `config:tm.policyStrict`, a select option that wraps).
Every other long compound is hyphenated and therefore breakable. If either term is ever
needed on one of the five constrained surfaces, split it there rather than re-coining it.

**Batch 2 shipped two more of the same kind, on the same terms**: "Übersetzungsaktivität" (21,
`strings:runs.title`, a page title) and "Übersetzungsdurchlauf" (21, inside
`strings:bulk.cancelFailed`, a toast). Neither surface is constrained. Across `config` and
`strings` together that is four unbreakable tokens over 20 characters and **zero** of them on
any of the five constrained classes — the rule is holding where it bites.

Descriptions, toasts and guide prose are not constrained; put the precision there.

The renderings used as examples in this file — here and in the casing section — are
illustrations of German word formation, not decisions about wording. `terminology.md`
defines every domain term, including the surface names and _translation memory_;
`terminology/de.md` holds the rendering. Decide the rendering on first use, write its
row there, and then follow it here.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

The German hazard is **article and case before a token**. You cannot write "das {{module}}"
safely, because the value's gender is unknown, and you cannot decline the token. Put a real
noun in front and let it carry the gender and the case:
the closing clause of `logs:translation.failedModuleDisabled` ("…the {{module}} module is
turned off"; the full string carries three tokens) becomes "Das Modul {{module}} ist
deaktiviert."

Plurals map one to one onto English `_one` / `_other`.

## Locale-specific traps

- **Do not over-Germanize.** German technical registers use English loans naturally —
  "Backup", "Update", "Token", "Prompt". Coining "Sicherungskopie" where practitioners say
  "Backup" makes the UI harder to read, not more German. `terminology/de.md` records the
  choice per term; make it once and keep it.
- **"Gate" must not become "Tor".** The quality gate is a process-control checkpoint;
  "Tor", "Pforte" and "Schranke" all read physically.
- **"Stage" is a game level**, not a phase. German "Phase", "Etappe" and "Stufe" are the
  process readings `terminology.md` warns about; use the gaming term.
- **"Judge"** takes the evaluative sense ("bewerten"), never "richten"/"Richter".
- **Drop the possessive rather than translating it.** English marks possession far more
  often than German does, and dropping it is idiom, not a register choice.
  `vault:unlockDescription` ("Enter your password to decrypt module credentials for this
  session") reads best as "Passwort eingeben, um…" — "dein Passwort" is not wrong, just
  noise. Keep _dein_ where the possession is the point of the sentence, as in the
  `account:mfaDisableHint` example in the register section.
- **Genitive chains get long fast.** "Die Einstellungen der Instanz des Moduls" is correct
  and unreadable; prefer a compound or a hyphenated form.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Do not imitate the parentheses; rephrase so one string
  covers every count. The full device is in the counting section above.
- **Two German words are reserved against each other and it is easy to miss.** *Prüfung* is
  the deterministic LQA **check**; an **AI review** is a *Review*, never a *Prüfung*, because
  one is a rule and the other is a model's opinion. Separately, *Erfolg* is taken by
  `config:health.successRate` (provider request success), so the Quality dashboard's **pass
  rate** must be built on something else. Both are recorded in `terminology/de.md`.
- **`Tab` in `terminology.md`'s keyboard-key section is the key, not the UI tab.** German
  keycaps read *Strg* and *Umschalt* (or a bare ⇧) where English reads Ctrl and Shift, while
  *Tab*, *Enter*, *Esc* and *Alt* are engraved in English on a German layout and stay. Batch 2
  shipped the first four: `strings:compare.contextPlaceholder` and
  `strings:compare.tonePlaceholder` write "Umschalt+Enter" and keep the bare *Enter* and *Esc*,
  and `strings:compare.cellEditTooltip` and `strings:compare.cellEditReviewedTooltip` keep
  *Enter* and *Esc*. The **verb** *enter* translates normally in the same batch —
  `strings:shortcuts.enterEditMode` is "In den Bearbeitungsmodus wechseln", not a keystroke.

### Word order is a correctness check, not a style call

German marks case on articles and determiners, not on most plural nouns, so a clause with
**two plural noun phrases and a transitive verb carries its roles in word order alone**. The
default reading is subject-first. Whenever the English means the *other* way round, the
German must be a **passive** or must otherwise mark the agent — there is no guard anywhere
that can catch this, and the sentence is perfectly grammatical while meaning the reverse.

The batch-1 defect, kept as the worked example: `config:lqa.checks.untranslated.description`
shipped "Einträge, die triviale Matcher abfangen würden" for English's "entries trivial
matchers would catch". Every noun phrase in it is nominative/accusative syncretic and the
verb is plural, so it read *entries that would catch trivial matchers* — agent and patient
swapped. The fix is the passive: "die **von** trivialen Matchern abgefangen würden".

Two habits that make this cheap:

- **Write the relative clause as a passive by default** where the antecedent is the patient.
  `config:tm.browserDescription`, `config:routing.simpleHint` and
  `config:importModeFullReplaceHint` are all passive for this reason.
- **A number mismatch or a marked article is a proof, and it is worth arranging for one.**
  `config:routing.defaultToneHelp` ("Einträge verwendet, die diese Regel übersetzt") is safe
  because the verb is singular and the antecedent plural; `config:lqa.lengthLimitNote`
  ("Limits, die der Spiel-Editor vorgibt") is safe because *der* is unambiguously nominative.
  Both spans are quoted **verbatim and unelided** — an earlier draft dropped the intervening
  "verwendet," from the first one without marking the cut, which made a citation of a string
  that does not exist.

The same sweep also covers **attachment**: a relative pronoun binds the nearest matching
antecedent. `config:lqa.checks.achievement-length-limit.description` first read as
*achievements* that exceed their limits rather than *translations*, because
"Errungenschaften" sat closest to the "die". Restructure so the intended antecedent is
adjacent, rather than trusting the reader to recover it.

### The citation guard cannot see German strong verbs — fix the row, never the string

`scripts/check-lexicon-citations.mjs` attests a lexicon Rendering by longest-common-prefix,
at 70% of the word's length (floor 3). That works for weak verbs and for noun plurals, and it
**fails for exactly the verb class the register section tells you to use**: an e→i/ie stem
change or an umlaut destroys the prefix. The required prefix is `max(3, ceil(0.7 × len))` of
the *candidate*, so — counted, not estimated — *freigeben* against a shipped *freigibst*
shares **5** where 7 is required; *nehmen* against *nimm* shares **1** where 5 is required;
*lesen* against *lies* shares **1** where 4 is required; *geben* against *gib* shares **1**
where 4 is required. The stem change lands on the second or third character, which is inside
every one of those thresholds.

**A failing citation is a defect in the row, not in the copy.** Put the form the string
actually ships in the Rendering cell and the dictionary form in Notes — a quoted span in
Notes is only checked when it sits next to a backtick key, so an un-adjacent dictionary form
costs nothing. Rewording a correct German sentence to satisfy a prefix heuristic is how a
tool ends up authoring the copy, and it degrades every string it touches.

(An earlier draft of this guide recorded the opposite rule — "the cheap fix is usually the
string, not the row". It was wrong, and it scaled badly in the one direction that matters:
the more idiomatic the German, the more likely the guard is to reject it.)

### The six sweeps, instantiated for German

Run these over `packages/frontend/src/locales/de/` before handing a batch to review. All six
ran clean on batch 1.

| Sweep | German instance |
| --- | --- |
| the deferential pronoun the guide bans | `\b(Sie|Ihr|Ihre|Ihnen)\b` used as an address form, and a **mid-sentence** capitalized `Du`/`Dein` (a Sie-reflex) |
| the letter the guide tells you to omit | none — German's equivalent is the opposite rule: **ß must be present** where it belongs, so grep for `ss` after a long vowel or diphthong (`gross`, `heisst`, `aussen`) |
| straight quotes where the guide sets typographic ones | `"` and `'` outside JSON string delimiters, and `“…”` / `«…»` instead of `„…“` |
| doubled spaces | two consecutive U+0020 |
| three-dot ellipses instead of the single character | `...` for `…` |
| hyphens used as dashes | ` - ` for ` — ` |
