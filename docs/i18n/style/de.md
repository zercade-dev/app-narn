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
| Inline fragment inside a summary row | lowercase-initial adjective + noun, no sentence punctuation | `config:routing.anySource` "beliebige Herkunft", `config:routing.noModule` "kein Modul" |

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
| Backup | **Backup** | Named in prose by `config:importSnapshotNote` (shipped); `strings:tabs.backup` owes the same. |
| Translations | **Übersetzungen** | Named in prose by `config:routing.categoriesConfiguredHint` (shipped); `strings:tabs.strings` owes the same. |
| Compare | **Vergleich** | Named in prose by `config:routing.tonesHint` (shipped); `strings:tabs.compare` owes the same. |
| Orphans | **Waisen** | Named in prose by `config:fullReplaceOrphanNotice` (shipped); `orphans:title` and `strings:tabs.orphans` owe the same. English calls it the "Relink tab" there — a stale name, not a second tab. |
| Guide | **Guide** | Named in prose by `config:pseudoTestHelpLink` (shipped); `sidebar:guide` owes the same. |
| LQA Checks | **LQA-Prüfungen** | `config:lqa.title` (shipped). |
| Project Templates | **Projektvorlagen** | `config:templatesTitle` (shipped); the singular section title is `config:saveAsTemplateTitle` "Projektvorlage", matching English's own singular/plural split. |

**How a tab is named inside a sentence: `im Tab <Name>`.** Not "im Backup-Tab" and not
"im Tab „Backup“". The bare, unhyphenated, unquoted name after the word *Tab* is what lets a
later batch grep for the rendering and repeat it: `config:importSnapshotNote` "im Tab Backup",
`config:routing.tonesHint` "im Tab Vergleich", `config:routing.categoriesConfiguredHint`
"im Tab Übersetzungen", `config:fullReplaceOrphanNotice` "im Tab Waisen".

## Casing

German capitalizes **all nouns**. That is orthography, not Title Case, and it applies
regardless of what English does: "Projekt löschen", "Routing-Regeln", "Übersetzungsspeicher".

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
is "Erfolg {{rate}} %" and `config:models.gpuPlacement` is "{{pct}} % GPU", both with U+00A0.

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
the token axis** — so `de` has no word-axis exemption list and needs none yet.

## Length discipline

German runs **10–35% longer** than English, and the worst case is not the sentence but the
**single unbreakable compound**: "Anmeldeinformationen", "Übersetzungsspeicher",
"Qualitätssicherungsprüfungen". A compound that overflows cannot wrap, so it clips.

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
| Tab label (`strings:tabs.backup`)                        | _to be measured_    | soft — the tab bar scrolls                |
| Table column header (`strings:columns.config`)           | _to be measured_    | soft — columns auto-size                  |
| Filter label (`strings:filters.needsReview`)             | _to be measured_    | soft — the filter row wraps               |
| Bulk-bar control (`strings:bulk.approveSelected`)        | _to be measured_    | soft                                      |

The sidebar figure is derived from that fixed container, so it is a property of the UI and
carries over to every language unchanged — treat it as binding from the first string.

The four soft budgets are deliberately **not** filled in, and must not be copied from
another language's guide: the numbers in `style/ru.md` were measured from Russian's own
shipped strings and mean nothing here. Measure them the same way once German ships — the
longest rendering each class actually needed, rounded up — and write them into this table
then. Until they exist, the instruction for a soft class is "as short as the term allows,
and never at the cost of the agreed rendering in `terminology/de.md`".

**What batch 1 (`config`) contributes to that measurement.** `config` holds no sidebar item,
no tab label, no filter label and no bulk-bar control, so it moves none of those four rows.
It does hold one table-column-header class — the model picker's `config:models.col*` — whose
longest German rendering is **11** characters ("Fähigkeiten"); "Param." and "Quant." keep
English's abbreviation, and `config:models.colConfidence` is "Konfidenz" (9) rather than the
23-character *Zuverlässigkeit* for that reason. `config:globalConfigTitle` is
"Globale Konfiguration" (21) and is **binding on the sidebar**, since `sidebar:globalConfig`
must be identical: it fits the hard 26 with five characters to spare.

Measured expansion over `config`'s 374 keys against the English source: **aggregate 1.23,
median 1.22, 90th percentile 1.50, max 2.83**. The max is `config:batchGroupingCustom`
("Custom" → "Benutzerdefiniert"), a six-character English source — the ratio is measuring
English's brevity, which is exactly why the budgets above are absolute rather than
multiples.

**Two unbreakable tokens over the 20-character rule shipped in batch 1**, both on
unconstrained surfaces where the rule does not bite: "Schlusszeichensetzung" (21,
`config:lqa.checks.end-punctuation.name`, an item in a scrolling check list) and
"Kontextübereinstimmung" (22, inside `config:tm.policyStrict`, a select option that wraps).
Every other long compound is hyphenated and therefore breakable. If either term is ever
needed on one of the five constrained surfaces, split it there rather than re-coining it.

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
  *Tab*, *Enter*, *Esc* and *Alt* are engraved in English on a German layout and stay. Nothing
  in `config` names a key, so no key name has shipped yet.

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
