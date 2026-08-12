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

**A corrective error message takes the impersonal infinitive, not the du-imperative.** The
rule above ("where a full sentence really does instruct the user") licenses both, which is
exactly why the split has to be written down: rounds 1-4 shipped every corrective the
infinitive way — `vault:errorInvalidPassword`, `account:errorInvalidConfirmation`,
`collab:errors.nickname_reserved`, `collab:invites.errorNicknameRequired` — and round 4 shipped
one outlier at `collab:invites.errorTooManyPendingInvites`, which the review caught and which
now reads "Erst eine bestehende zurückziehen, dann eine neue erstellen."

The du-imperative is kept for the narrower case: a **direct invitation to act**, which is
usually an instruction carried out on the screen in front of the reader and occasionally one
carried out elsewhere. **Nine** instances exist across the shipped locale as of round 5, derived
**without a verb list** — read the method note below before you quote the number, because every
previous move of this count was the method rather than a new string:

- **In a field, on this screen** — `account:deleteTokenSent`, `account:mfaDisableHint`.
- **On another device** — `collab:nickname.claimOnDesktop`, which reuses batch 2's
  `strings:mobile.desktopOnlyBody` frame verbatim. Both are instances in their own right; the
  second is not merely a frame the first copies.
- **Off-screen entirely** — `account:reportBugsPrefix` and `strings:viewNotFoundContact`, which
  each ask the reader to send an email and are each concatenated with a mailto link. They are
  du-imperatives and they are **not** field-or-device instructions, so they are named here rather
  than left to contradict the sentence above.
- **About the reader's own choice** — `config:structuredOutputExperimentalWarning` (which carries
  **two**, *Probier* and *behalte*), `config:structuredOutputLunaWarning` and
  `config:ignoreBatchSizeLimitDescription` ("… — lass die Option aus, sofern du nicht weißt …").
  All three are advice about a setting the reader is choosing, licensed by the register section's
  own clause; none is a corrective error. The first two are siblings one paragraph apart in the
  same panel and carry the same verb.

None of the nine is a corrective error, so the rule above holds without exception. **Batch 5
owns `errors`**, so it inherits the split rather than re-deciding it.

**Batch 5 applied it, and the count of du-imperatives across the whole locale is unchanged by
it — batch 5 adds none.**
All six `errors:http.*` keys ship with **no** imperative: the corrective half of each is an
impersonal infinitive — `errors:http.vaultLocked` "Der Tresor ist gesperrt. Entsperren und erneut
versuchen." (the shape `config:credentialsVaultLocked` already ships), `errors:http.offline`
"Der Server ist nicht erreichbar. Verbindung prüfen." and `errors:http.rateLimited`. Two of the
six use *du* and neither is an imperative: English writes them as **statements about the reader**
(*You need to sign in again*, *You don't have permission to do that*), which is the shape
`collab:errors.already_member` and `collab:errors.cannot_join_own_project` already ship, so
`errors:http.unauthorized` is "Du musst dich erneut anmelden." and `errors:http.forbidden`
follows it. The rule splits **imperative against infinitive**; a du-statement is neither, and
turning one into an infinitive would drop the direct address English chose.

**Do not use a verb list. Enumerate and read.** This count has moved four times — three → six →
eight → nine — and **every** move was the method, never a new string. Two failure modes produced
them, and a method has to defeat both:

- **Where the verb sits.** A German du-imperative is verb-first **in its clause**, not in its
  sentence, and a clause can open after far more than a full stop. `strings:viewNotFoundContact`
  puts *melde* after a *Wenn …* comma, `config:structuredOutputExperimentalWarning` puts *behalte*
  after a bare *und*, and `config:ignoreBatchSizeLimitDescription` puts *lass* after an **em
  dash**. A sentence-split scan misses all three; a comma-only clause split still misses the last
  two.
- **Which verbs you thought of.** A list can only ever confirm that nothing hides *among the forms
  already in it*. The `lass` miss is exactly this: the list that produced the eight contained
  *versuch* and not *lass*, so its own clean second pass — four occurrences, every one the noun
  *Versuch(e)* — proved nothing about `lassen` at all. **A negative result from a list is not
  evidence of absence.**

**The method that produced the nine, which needs no verb list and can therefore find a form
nobody thought of:**

1. Split every `de/*.json` value at **every** clause boundary — start of value, sentence
   punctuation, comma, semicolon, colon, em/en dash, bracket, bullet, slash, **and** the
   coordinating conjunctions *und / oder / aber / sondern / denn*. Placeholders are blanked first.
2. Collect the **distinct clause-initial tokens** and read the whole set. It is a few hundred
   (~800 at the round-5 tree, and it grows with every batch — re-enumerate, never reuse a
   number). Reading it is minutes, and it surfaces a form you have never seen because you are
   reading the corpus rather than querying your own assumptions.
3. Close the one shape step 2 cannot see — a **fronted adverbial before the verb** — by collecting
   the distinct clause-**second** tokens and reading those too (~500 at the round-5 tree). Every
   verb form in that set today is an infinitive, a participle, or a 2sg with an explicit *du*
   subject, so the hole is empty and the 46-odd values opening *Zuerst / Jetzt / Bitte / Erst* are
   all infinitives.

Re-run both passes over the **whole corpus**, not over your own batch, and re-run them after your
last string edit. If a later round ever does fall back to a verb list, say so in this paragraph
and name what closes it — an unstated list is what has cost this enumeration four rounds.

> **Corrected twice on 2026-08-12, both left visible.** At the round-5 **review** this paragraph
> claimed six, "derived by scanning every `de/*.json` value for a sentence-initial imperative";
> the count was wrong and the stated method was why. The repair diagnosed that correctly — *verb-
> first in its clause, not its sentence* — and then **wrote a method that did not implement its
> own diagnosis**, narrowing "anywhere in the value" back to "after sentence punctuation or a
> comma" three lines later, and deleting the list caveat as "the wrong risk" when the next
> survivor, `config:ignoreBatchSizeLimitDescription`, was precisely that risk. The round-5
> **re-review** found it: nine. **A repaired reason is a new claim and inherits none of the old
> one's checking** — the runbook says so, and this paragraph is the worked example. No string has
> ever moved for this finding across all four rounds; the rule was never in doubt.

> **Corrected 2026-08-12 (round-4 re-review, R2), left visible.** This paragraph first said
> "three shipped instances, all of that kind" and omitted `account:reportBugsPrefix` — a
> du-imperative **this batch shipped and the same fix round edited two paragraphs below**. The
> count came from the review that requested the paragraph and was copied rather than re-derived.
> The rule never depended on it; the list did, and batch 5 is the batch that would have read it.

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
| Navigation button **whose English is a verb phrase** (*Go to …*, *Set up …*, *Open …*) | **bare infinitive too** — never the bare directional phrase. An item named after its *destination* is a surface name (see Surface names), not this row | `vault:goToVault` "Zur Tresor-Seite wechseln", `vault:setupRedirect` "Dieses Gerät einrichten" |
| Confirm-dialog title | **infinitive**, which in German is the same string as the button | `config:confirmDeleteTitle` "Projekt löschen" |
| Step button in a multi-step flow (*Continue* / *Back*, moving between steps and doing nothing else) | **the bare adverb** — *Weiter* / *Zurück*, not an infinitive | `orphans:relink.submit` "Weiter", `orphans:actions.back` "Zurück" (the same pair, one sheet apart), after batch 2's `strings:bulk.back` |
| Select / combobox placeholder | **infinitive phrase**, not a title | `config:enableModulePlaceholder`, `config:routing.simplePlaceholder` |
| Table column header | **bare noun**, and it keeps English's abbreviation where English has one | `config:models.colParameters` "Param.", `config:models.colQuantization` "Quant." |
| Progress / status text | **`wird` + participle**, or a deverbal noun — never an infinitive, which would read as a command | `config:autoSaveSaving` "Wird gespeichert…", `config:duplicating` "Wird dupliziert…", `config:importing` "Import läuft…", batch 6's `backup:creating`, `restoring`, `deleting` and `stage-details:runProgress` |
| Progress text for an **on-screen agent** doing the work | **3rd-person finite verb** — the one departure from the row above, and only where the agent is visible | `common:thinking` "Denkt nach… {{seconds}} s", rendered inside the assistant's own chat bubble. `wird` + participle demotes an agent English keeps ("Thinking…" is the assistant's), and the impersonal "Wird nachgedacht…" reads bureaucratic. Nothing else in the locale is this shape |
| Inline fragment inside a summary row | **determiner + noun**, lowercase-initial, no sentence punctuation | `config:routing.anySource` "jede Herkunft", `config:routing.anyLang` "jede Sprache", `config:routing.noModule` "kein Modul" |

**Why the step button is an adverb and not an infinitive, since the button row says otherwise.**
*Fortfahren* is the rule-conformant rendering of a bare English *Continue* and it is not what
this ships, on a meaning argument rather than a preference: *fortfahren* carries "proceed
anyway, despite something", and `orphans:relink.submit` proceeds despite nothing — it moves
from the candidate picker to the confirmation step and submits no work. Its own cancel-side
twin `orphans:actions.back` is the `ConfirmSheet`'s cancel label on that second step, i.e. the
control that walks back, and batch 2 already shipped the bare adverb for exactly that at
`strings:bulk.back`. So this row records a pair German UIs write as *Weiter* / *Zurück*, and it
reaches no button that performs an action — `orphans:relink.confirmSubmit`, the one that does,
is the infinitive "Neu verknüpfen".

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

**A navigation button is still a button, and the bare directional phrase is banned even
though it is good German.** German UIs write *Zur Startseite* on a link constantly, and round
4 first shipped `vault:goToVault` in that shape. The round-4 review found the defect that
makes it the wrong call here: `VaultUnlockDialog.tsx:213-215` is **one** `<Button>` whose
label is `hasVault ? t('goToVault') : t('setupRedirect')`, and `setupRedirect` is an
infinitive — so a single control changed shape with the vault's state. It now reads
"Zur Tresor-Seite wechseln", which keeps English's directional sense and matches its own
other state.

**The same handler backs a third label, and that is what the rule is really protecting.**
`welcome:setupVaultButton` — English *Set up vault* — calls `goToVaultSetup` too
(`WelcomeView.tsx`), the identical function and the identical destination as both states of the
button above. Batch 6 shipped that third label as "Tresor einrichten": a bare infinitive, the
same shape as `vault:setupRedirect`, and short *Tresor* because its own English shortens too
(see the **credential vault** lexicon row, which owns that split). All three labels on this one
navigation target are now infinitives, which is what the rule was protecting.

The rule is stated as *never the bare PP* rather than as *unless it is navigational* on
purpose: the second form would make every later batch classify each button as navigational or
not, and that judgement drifts. Stating it absolutely costs nothing, because **nothing shipped
violates it**: every `Zur…`/`Zum…`/`Ins…`-initial value in the German corpus is either prose or
already a prepositional phrase **plus** a verb — `settings:switchToLight` is
"Zum hellen Modus wechseln" and `settings:switchToDark` its twin. The absolute form describes
what four rounds already do.

> **Corrected 2026-08-12 (round-4 re-review, R1), left visible.** This paragraph first argued
> that rounds 5 and 6 "meet more Go to …-shaped labels in `common`, `legal` and `welcome`".
> That is **false**, and re-checking it takes one command: `grep -in "go to"` over all 24
> English namespaces returns exactly one line, `vault:goToVault` itself. `common` has no
> navigational label at all; `legal` is eight noun-phrase document titles, which the narrowed
> row above deliberately does not govern; `welcome`'s two are already verb phrases (*Browse
> guides*, *Set up vault*). The claim arrived in the fix round's dispatch and was copied into
> this file without being checked — the relay this programme keeps paying for. The **rule** was
> never in doubt; only its forward-looking evidence was, and the shared-handler fact above is
> both true and stronger.

**Instructions inside a sentence: prefer the impersonal infinitive over the du-imperative.**
The register section already says this; batch 1 applied it to every instruction that is not
about the reader personally — `config:importSheetDescription` is "Festlegen, wie…",
`config:malformedRowsHelp` ends "…korrigieren und erneut importieren." The du-imperative is
kept where the sentence really is about the reader's own choice
(`config:structuredOutputExperimentalWarning` "Probier sie … aus und behalte, …") — which is
also where the short imperative form reads naturally rather than clipped.

**A passive statement is not the infinitive instruction, and swapping one in changes what the
string does.** Round 3 shipped English's "Assign categories to entries from the Translations
tab" as "Kategorien werden im Tab Übersetzungen zugewiesen" in two keys and as an infinitive in
a third; the passive turns an instruction into a description, and in `category:subtitle` it flips
mood halfway through a string whose first sentence is three impersonal infinitives. All three
now read "Kategorien im Tab Übersetzungen … zuweisen" (`category:subtitle`, `category:empty`,
`category:noEntriesInCategory`). The passive stays right where the *antecedent* is the patient
and nobody is being instructed — that is the word-order rule below, a different situation.

## Surface names — one rendering, repeated verbatim

A surface is named in several namespaces at once, and the namespaces are translated in
different batches. Every key naming the surface takes the **same** rendering, and prose that
mentions it repeats that rendering verbatim. Settled so far:

| Surface | German | Where it is already shipped / where it is owed |
| --- | --- | --- |
| Global Config | **Globale Konfiguration** | `config:globalConfigTitle` and `sidebar:globalConfig` (both shipped, word-for-word identical as English requires) — 21 chars, inside the 26-char sidebar budget. |
| Workspace Settings | **Workspace-Einstellungen** | `config:workspaceSettingsTitle` (shipped). |
| Translation Memory | **Translation Memory** | `config:tm.policyTitle`, `config:tm.browserTitle`, `sidebar:translationMemory` (all shipped). |
| Backup | **Backup** | `config:importSnapshotNote`, `strings:tabs.backup`, `strings:guide.topicBackup` (all shipped). |
| Translations | **Übersetzungen** | `config:routing.categoriesConfiguredHint`, `strings:tabs.strings`, `strings:guide.topicMultiLanguage` (all shipped). |
| Compare | **Vergleich** | `config:routing.tonesHint`, `strings:tabs.compare`, `strings:guide.topicCompare`, `strings:order.presortHint` (all shipped). |
| Orphans | **Waisen** | `config:fullReplaceOrphanNotice`, `strings:tabs.orphans`, `strings:guide.topicOrphans` and batch 6's `orphans:title` (all shipped). English calls it the *Relink tab* in the config string — a stale name, not a second tab. |
| Guide | **Guide** | `sidebar:guide` (shipped); named in prose by `config:pseudoTestHelpLink`. |
| LQA Checks | **LQA-Prüfungen** | `config:lqa.title` (shipped). |
| Project Templates | **Projektvorlagen** | `config:templatesTitle` (shipped); the singular section title is `config:saveAsTemplateTitle` "Projektvorlage", matching English's own singular/plural split. |
| Config | **Konfiguration** | `strings:tabs.config` (shipped); `strings:guide.topicConfig` repeats it. Distinct from **Globale Konfiguration**, which is the workspace-level page above it. |
| Data | **Daten** | `strings:tabs.data` (shipped). |
| Source AI review | **Quelltext-KI-Review** | `strings:tabs` (review-source-ai), `strings:tabPlaceholder` (review-source-ai) and `review:sourceAi.configTitle` (all shipped). The bare **Quelltext-Review** is the *term* in prose and is a different string — see `../terminology/de.md`. |
| Translation AI review | **Übersetzungs-KI-Review** | `strings:tabs` (review-translation-ai) and `review:translationAi.title` (both shipped). |
| Manual review | **Manuelles Review** | `strings:tabs` (review-manual), shipped. Its **page title is a different string**, `review:title` "Prüfwarteschlange" — English splits the same way ("Manual review" / "Review queue"), like Activity and Legal. Do not harmonize them. |
| Quality | **Qualität** | `strings:tabs.quality`, `strings:guide.topicQuality` (shipped). The **page title expands**, exactly as Activity's does: `quality:title` is "Qualitäts-Dashboard" for English's "Quality Dashboard" — the rendering `strings:tabPlaceholder.quality` already shipped in prose. Do not copy the tab label into it. Batch 5's `logs:action.openQuality` repeats the **page title**, not the tab label, because it opens the page — see the note below the table. |
| Glossary | **Glossar** | `strings:tabs.glossary`, `strings:guide.topicGlossary` (shipped). |
| Category | **Kategorie** | `strings:tabs.category`, `strings:guide.topicCategory` (shipped). Singular on purpose, as in English, even though the page it opens is plural. |
| Routing | **Routing** | `strings:tabs.routing`, `strings:guide.topicRouting` (shipped). |
| Activity | **Aktivität** | `strings:tabs` (runs), `strings:guide.topicActivity` (shipped). The page title `strings:runs.title` deliberately expands to "Übersetzungsaktivität" — expand it, never shorten the page title to match. |
| Stage details | **Level-Details** | `strings:tabs` (stage-details), `strings:runs.typeStageDetailsTranslation` and batch 6's `stage-details:title` (all shipped). Batch 6 also compounds on it — `stage-details:chatToggle` "Level-Details-Chat umschalten" and `fields.stageDescription.label` "Level-Beschreibung" — which is the term split at the point of use, not a second name. |
| Sharing | **Zusammenarbeit** | `strings:tabs.sharing`, `strings:tabPlaceholder.sharing`, `collab:sharing.pageTitle` (all shipped). *Freigabe* was rejected — *freigeben* is the **approve** term (into Translation Memory) and the two would read as one feature. |
| Text Styler | **Text-Styler** | `strings:tabs` (color-text), `sidebar:colorText` and batch 6's `colorText:title` (all shipped). |
| Review (sidebar group) | **Review** | `strings:guide.groupReview` and `sidebar:groups.review` (both shipped). |
| Setup (sidebar group) | **Einrichtung** | `strings:guide.groupSetup` and `sidebar:groups.project` (both shipped) — note the key is `project` while its English is *Setup*. |
| Translate (sidebar group) | **Übersetzen** | `strings:guide.groupTranslate` and `sidebar:groups.translate` (both shipped). Distinct from *Übersetzungen*, the first tab nested under it — the pair the runbook warns about, and this locale keeps them apart. |
| Terminology (sidebar group) | **Terminologie** | `strings:guide.groupContent` and `sidebar:groups.content` (both shipped) — again the key name and the English differ. |
| Maintenance (sidebar group) | **Wartung** | `strings:guide.groupMaintenance` and `sidebar:groups.maintenance` (both shipped). |
| Translation Memory (guide topic) | **Translation Memory** | `strings:guide.topicTranslationMemory` and `strings:guide.groupTranslationMemory` (shipped), matching the term. |
| Page (sidebar group) | **Seiten** | `sidebar:groups.page` (shipped). The one group heading with no guide twin, and the one that is **not** singular in German where English is: it stands over four sibling page links (Einstellungen, Changelog, Rechtliches, Über Narn), and a bare singular heading over a list reads as an error in German where English's type-label "Page" does not. The five activity-named groups above are unaffected — they name a task, not a countable item. |
| Settings | **Einstellungen** | `sidebar:settings` and `settings:title` (both shipped). Byte-identical in English, so identical in German — the same relationship `sidebar:globalConfig` has, and the opposite of Legal's. |
| Legal | **Rechtliches** | `sidebar:legal` (shipped). Batch 6's `legal:title` — English *Legal & policies* — **expands**, exactly as Activity's page title does, and ships as "Rechtliches & Richtlinien". Do not shorten the page title to match and do not invent a third name. |
| Changelog | **Changelog** | `sidebar:changelog` (shipped); batch 6's `common:changelogShowOlder` names the same page. *Änderungsprotokoll* was rejected because *Protokoll* reads as a transcript or a network protocol, so the compound names a running record of changes rather than release notes — the lexicon row carries the full argument, **re-grounded in round 5** after its original one cited a reservation the Activity row had retracted. |
| About Narn | **Über Narn** | `sidebar:aboutNarn` (shipped). The brand keeps the source string's own casing — `Narn` here, `narn` in `settings:appearanceDescription` — and is never translated or re-cased. |
| Account | **Konto** | `sidebar:account` (shipped). Not *Benutzerkonto* (longer, and the possessor is obvious) and never *Zugang*, which would drag toward *Zugangsdaten*. |
| Credential vault | **Zugangsdaten-Tresor** | `vault:statusLabel` (shipped), with the short *Tresor* wherever English shortens — see the lexicon row, which owns the split. |
| Join project | **Projekt beitreten** | `sidebar:joinProject` (the tab in the New Project sheet) and `collab:join.joinButton` (the submit button inside that very tab) — byte-identical in English, rendered on screen **at the same time**, so they take one rendering. `collab:join.title` ("Join a project") is the standalone view's heading and expands to "Einem Projekt beitreten", following its own English. |

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
| **verdict** — the judge's per-entry ruling | *Urteil* | `strings:runs.judgeAllFindingsDescription` | shipped in batch 5 at `logs:judge.done`, which labels the token: "Review ergab Punktzahl {{score}} — Urteil: {{verdict}}." |
| **assistant** — the chat persona | *Assistent*, weak masculine; linking form *Assistenten-* in a compound | `strings:runs.typeChatGeneric` | shipped in batch 6: `colorText:assistant.title` "KI-Assistent" (English *AI assistant*) and `stage-details:chatAssistant` "Assistent" (English *Assistant*) — each faithful to its own key's English. The linking form carries the batch's four compounds: `colorText:assistant.settings` / `stage-details:chatSettings` "Assistenten-Einstellungen", `assistant.noCredentials` and `assistant.vaultLocked` "Der Assistenten-Anbieter …" |
| **review, as a verb with an object** — the Translation-AI controls | *bewerten* | `review:translationAi.runReview`, `reviewAll`, `reReview`, and the two empty-state hints that quote those labels | any later key that tells a user to review *translations* with an AI |
| **review, as a verb** — what the **source review** does to an entry | *untersuchen* | `review:sourceAi.scopeNeverReviewed`, `scopeNoneHint` and `configHint`'s **second** sentence (all three render English *review*). `emptyHint` renders English *checks* with the same verb, because *prüfen* is withheld from the AI source review — that is this row extending to one *check*, not a claim that every *check* takes it | batch 5's `logs:sourceReview.*` |
| **browse / look something over** — reading rather than analysing | *durchsehen* | `category:subtitle` and `strings:mobile.desktopOnlyBody` (English *browse*), `review:sourceAi.configHint`'s **first** sentence (English *Check the source text itself*) | any later batch rendering English *browse* |
| **issues**, where English means "problems in the text" rather than the LQA verdict | *Auffälligkeiten* | `review:sourceAi.configHint`, `review:sourceAi.noFindings` | any later prose about what a review looks for |
| **approve**, on a source-review finding (persists the approval **twice** — on the run's finding record and mirrored onto the entry's own `sourceReview`, when that stored review came from the same run; never reaches Translation Memory and never edits the source text) | *Bestätigen* / *Bestätigt* | `review:sourceAi.approve`, `approvedToast`, `approvedBadge`, `approveFailed`, `keyboardHint` | — |
| **previous**, of a stored translation version — **on the review surfaces only** | *vorherig* | `review:diffTitle`, `previousVersionMeta`, `noPreviousVersion`, and the pager `review:prev` | later batches naming an earlier version **inside `review:`** |
| **push**, to DeepL | *übertragen* / *Übertragung* | `glossary:pushToDeepL`, `confirmPushReplace*`, `toastPushError`, `repushRequired`, `toastRepushRequired` | — |
| **remove / forget / dismiss** — take a row out of a list for good | *Entfernen* | `collab:sharing.remove`, `collab:sharing.removeConfirm`, `vault:remove`, `account:deviceForgetButton`, `account:notificationsDismiss` | any later batch removing a row from a list |
| **share**, a project with a person | *teilen* | `collab:sharedWithYou`, `collab:sharing.auditToggleUnsharedHint`, `collab:routing.scopeNote` | — |
| **owner**, of a project | *Projektinhaber* | `collab:join.nicknameFirst`, `collab:locks.glossaryEditScoped` | any later batch naming the person a project belongs to |
| **log / logs** — the live server-log surface and its own chrome | loan *Log*, pl. *Logs*; the unit is a hyphenated *Log-Eintrag* | `console:searchPlaceholder`, `console:exportLogs`, `console:clear`, `console:empty`, `console:statusConnected` | any later batch naming the log panel or a log line |
| **close**, a one-off banner | *Schließen* | `system:restarted.dismiss`, `system:cancelled.dismiss` | any later batch closing a banner or dialog rather than removing a list row |
| **score**, the judge's number | *Punktzahl* | `strings:runs.judgeScoreLabel`, `strings:runs.aiReviewed`; batch 5's `logs:judge.done` repeats it | any later batch naming what the judge returns alongside its verdict |
| **quality check**, the LQA gate seen from a log line | *Qualitätsprüfung* | `logs:lqa.passed`, `logs:lqa.failed`, `logs:translation.tmRejected`, `logs:translation.lqaRetry` | — |
| **restore**, a backup | verb *wiederherstellen*, deverbal *Wiederherstellung* | `backup:restoreButton`, `restoring`, `restoreSection`, `toastRestoreSuccess`, `toastRestoreFailed`, `confirmConfirm`; the batch-2 precedent is `strings:compare.undoRestore` | — |
| **clipboard**, the copy confirmation and its failure | "In die Zwischenablage kopiert" / "Kopieren in die Zwischenablage fehlgeschlagen" | `colorText:copied`, `stage-details:copied`, `stage-details:copyFailed` — the third repeats batch 3's `review:sourceAi.copyFailed`, whose English is identical | — |
| **save failure** — two English wordings, one German string, **licensed** | "Speichern fehlgeschlagen: {{message}}" | `config:autoSaveError` (*Failed to save: {{message}}*, batch 1) and `stage-details:saveFailed` (*Could not save: {{message}}*, batch 6) ship the identical German. This is the same-rendering/different-English direction and it is deliberate: German has no meaning distinction to carry between *failed to* and *could not*, both keys report one event — a save that did not happen — and this locale already renders both English shapes with *fehlgeschlagen* elsewhere (`review:sourceAi.copyFailed` is a *Could not*, `config:autoSaveError` a *Failed to*). `ru` collapses the identical pair; `es` and `fr` keep it apart, and either is defensible. **Recorded so the collision sweep does not reopen it** — the danger of this class is that the file looks *more* consistent, not less | — |
| **why**, the model's stated reason for a proposal | *Begründung:* | `colorText:assistant.proposalWhy`, `stage-details:chatProposalWhy`. English's terse *Why:* is idiomatic English labelling; a German "Warum:" in front of a free-text sentence reads as a question nobody asked, so the label names the thing instead | — |
| **stop**, a streaming AI response mid-flight | *Stoppen* | `colorText:assistant.stop`, `stage-details:chatStop` (both `aria-label`s). Distinct from *Abbrechen*, which cancels a **run** (`stage-details:cancel`, `batch:cancelRun`) — one ends a stream, the other kills queued work | — |
| **ask**, of the assistant | *bitten* where English asks it **to do** something, *fragen* where English asks it **about** something | `colorText:assistant.placeholder` (*Ask the assistant to style your text…*) is "Den Assistenten bitten, …"; `stage-details:chatInputPlaceholder` (*Ask the assistant…*) and `chatEmpty` (*Ask about wording…*) are *fragen*. Two English senses of one verb, two German verbs — do not collapse them | — |
| **look**, the first-run theme-plus-mode choice | *Look* | `welcome:themeChooser.title` "Dein Look" — a picker-dialog title, so a noun phrase like `config:models.pickTitle`, not an infinitive. The loan is already in the corpus at `settings:themes.default.description` "Der klassische narn-Look."; *Darstellung* is spent on `settings:appearance` and *Design* was rejected with **theme** | — |

**Why *bewerten* on the three Translation-AI controls — the argument is the engine, not a
shortage of German verbs.** "Review last run", "Review all translations" and "Re-review" need a
**verb with an object**, and the verb they take is the judge's because **that is literally what
they start**: `TranslationAiReviewTab.tsx` sets `reviewTargetRun`/`reviewingAll`, which reach
`stores/run-store.ts`, whose call is `POST /projects/:id/runs/:runId/judge` (and the
project-wide `/judge`) — M25 JudgeEngine. The lexicon's *judge* row already fixes that verb as
*bewerten*, so these three keys inherit it. **This does not touch the noun**: the feature is
still "Übersetzungs-KI-Review" at `review:translationAi.title`, and `strings:runs.aiReviewStart`
"Review starten" — English "Start review", a noun — stays as it is.

> **Corrected 2026-08-11 (round-3 review, I1), left visible rather than rewritten away.** The
> first version of this paragraph argued instead that German "has none" for *review*. That is
> **false**: it eliminated only *reviewen*, *prüfen* and *Prüfung* and never considered
> *begutachten*, *überprüfen*, *durchsehen*, *sichten* or *beurteilen*. The conclusion survived
> the correction — the buttons really do call `/judge`, re-verified in the store — but a false
> absolute is exactly the kind of reason that outlives whoever wrote it, so the argument now
> rests on the call site alone. No shipped string changed.

**The verb rule is three-way, not two-way**, and the third case is the commonest:

> English noun → ***Review***, **unless a lexicon row fixes the term** — *review queue* is
> Prüfwarteschlange and *needs review* is zu prüfen, and a term row always wins.
> English verb → ***prüfen*** where a **person** reviews (the default), ***bewerten*** where the
> **judge** does (the judge routes, `review:translationAi.*`), ***untersuchen*** where the **source
> review** does (`review:sourceAi.*`).

The default branch is not hypothetical: batch 3 ships it seven times, all correctly —
`category:reviewTitle` (byte-identical to `strings:runs.reviewSuggestions`), `category:aiHint`,
`category:genBackgroundHint`, `glossary:generateRunningHint`, `glossary:importPreviewDescription`,
`review:languageLabel` and `review:allItemsTitle`. An earlier draft of this rule stated only the
*bewerten* and *untersuchen* branches; a later batch applying it literally to `logs:*` or
`stage-details:*` would have written a machine's word for a person's action. The reservation on
*Prüfung* binds the **noun** naming the deterministic LQA check; the **verb** *prüfen* is the
ordinary German for a person checking something and is free.

**What the source-review *Bestätigen* decision actually rests on.** Two negatives, both
verified in `packages/server/src/routes/runs.ts`: the action **never reaches Translation Memory**
(that is a different route, the one the review queue posts to) and **never edits the source
text**. It is not a write-free action — the route writes the run's finding record *and* mirrors
the approval onto the entry's own `sourceReview` — but neither write is the one that would make
*freigeben* the right word.

> **Corrected 2026-08-11 (round-3 review M1, then re-review M1), left visible.** The row above
> first justified *Bestätigen* by saying the action "writes nothing"; that was false. The repair
> named one write and missed the second. Two wrong reasons in a row under a conclusion that was
> never in doubt — which is the argument for stating the negatives, which are what the split
> depends on, rather than an inventory of what it writes.

**Two words for "previous version", and both are right — do not harmonize them.**
*vorherig* is fixed above for the **review surfaces**, where `review:diffTitle` renders as the
heading directly over `review:previousVersionMeta`'s caption and a split would be visible in one
glance. The Compare tab's version-history panel is a different surface and settled the other way
in batch 2: `strings:compare.undoVersionsTitle`, `undoRestored`, `undoTooltip` and `cellUndoAria`
all render English "Previous version(s)" as **"Frühere Version(en)"**, and they ship, reviewed.
(`undoVersionsHint` renders English's own "an **earlier** version" and is *eine frühere Version*
— not a counterexample.) The two surfaces never co-render, so there is no defect and **no string
change is owed** in either direction.

> **Corrected 2026-08-11 (round-3 re-review, I4), left visible.** The row above first read
> "*vorherig* — **never** *früher*", an unbounded ban derived from four `review:` keys, which
> told batches 4-6 that those four shipped batch-2 strings were wrong. Scoping the row, rather
> than widening the ban, is the same repair the *flag* row already carries for *markiert*: a rule
> derived from one surface is stated for that surface.

**`review:sourceAi.ignore` inherits *ignorieren*, and its two toasts do not.** The row at the
top of this table binds the button: `ignore` is "Ignorieren". `ignoredToast` and `ignoreFailed`
are named there too, but their **own English does not say "ignored"** — it is "Review entry
removed" and "Could not remove the review entry" — so they ship as "Review-Eintrag entfernt"
and "Der Review-Eintrag konnte nicht entfernt werden". Matching a sibling means matching its
English, not another key's rendering; writing "Ignoriert" there would invent wording English
does not have. The inheritance is real and it lands on the control, which is the string that
names the action.

**`revert` and `undo` must not collapse into one word.** English keeps them apart and so does
this locale: *Rückgängig* is the single-edit undo in the compare cell and the editor, while
*Zurücksetzen* reverses everything one run wrote. A fix round that "harmonizes" them destroys a
distinction the UI relies on — both controls can be on screen at once.

**The label on `logs:judge.done`'s verdict token is deliberate, and it is there because of what the token holds.** English writes *Review scored {{score}} — {{verdict}}* with the value bare, and `{{verdict}}` interpolates the raw enum `M25-judge-engine.ts` logs: the literal ASCII *pass* or *fail*, never a translated string (`strings:runs.judgeVerdictPass` and `judgeVerdictFail` exist and are not used here). A bare untranslated token after a dash reads as a broken sentence in German; naming it — Urteil: — makes it parse as data, and it is the one place this locale adds a word English does not have. **That is a defect in the product, not in the English copy**, and it is escalated rather than absorbed: if the log line is ever fixed to interpolate the translated verdict, drop the label with it.

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

**Three English verbs collapse onto *Entfernen*, and the collapse is licensed by render
condition, not by taste.** English writes *Remove* (a member, a vault row), *Forget* (a
device) and *Dismiss* (a notification) for what is, in each case, the same user-visible
operation: this row leaves this list and does not come back. No two of them can be painted
together — `account:deviceForgetButton` and `account:notificationsDismiss` sit in two
mutually exclusive `TabsContent` panes of the Account view (Security and Notifications), and
`collab:sharing.remove` is a project tab, which the shell never renders beside the workspace
Account view. `vault:remove` has no call site in the frontend at all. The alternatives were
worse in the direction that matters most on these surfaces: *Vergessen* is not a German
button label, and *Ausblenden* would **understate** a deletion — dismissing a notification is
a `DELETE`, verified in `stores/notification-store.ts`, not a hide.

**Role nouns: prefer one that is already neutral, and take the generic masculine only when
there is none.** *Mitwirkende* and *Mitglieder* are neutral in the plural and carry almost
every collaboration string, so batch 4 goes plural or drops the noun rather than choosing a
gender — `collab:sharing.auditToggleUnsharedHint` says "mit Mitwirkenden" for English's *a
collaborator*, and `collab:join.description` carries *as a collaborator* on the verb
*mitwirken* instead. Where English names the project's **owner** there is no neutral German
noun and no plural to hide in, so the generic masculine stands: `collab:join.nicknameFirst`
writes "der Projektinhaber". No gender-star, colon or interior-capital forms anywhere — the
locale has none today, and introducing one in a single string would be the inconsistency,
not the fix.

**A reservation is scoped to the term that proved it, and *Hinweis* is this round's
instance.** The **finding** row rejects *Hinweis* and *Anmerkung*, but it rejects them as
renderings of *finding* — not as German words. `account:notificationsDescription` renders
English's own *Alerts* (a word the source deliberately varies from *Notifications* in the
heading above it) and ships as "Hinweise zu deinem Konto und zu Aktivitäten auf der
Plattform." That is the rule the lexicon already states for *entry* and for *flag*, applied
once more; a banned-lexeme grep will hit it, and this paragraph is the licence.

**The live server log is *Log*, not *Protokoll*, and batch 2 decided that before batch 5 met
it.** `strings:runs.judgeLogsTitle` renders English *Verbose logs* as "Ausführliche Logs
({{count}})" and `strings:runs.aiReviewVerbose` renders *Verbose logging* as
"Ausführliches Logging (Prompt, Parameter & Rohantwort)", both shipped and reviewed. `console`
and `logs` follow that precedent rather than opening it again: the loan sits in the family this
locale already keeps (*Backup*, *Prompt*, *Routing*, *Workspace*, *Review*, *Guide*,
*Changelog*, *Theme*), and *Protokoll* is ambiguous in German between a transcript and a network
protocol. The counted unit takes the hyphenated mixed compound — `console:empty` is
"Noch keine Log-Einträge." — which is *entry* with a disambiguating head in front of it, exactly
the narrow scope the lexicon's *entry* reservation allows.

> **Corrected 2026-08-12 (round 5), left visible.** `terminology/de.md`'s **Activity** row said
> *Protokoll* is the live server log, and its **recording** row rejected *Protokollierung* on the
> same premise. Neither was true of anything this locale ships — *Protokoll* has never appeared
> in a German value, in any batch — and batch 5 is the batch that would have inherited it. Both
> conclusions survive: *Protokoll* is still wrong for **Activity** (it reads as a record of what
> happened, not a list of runs) and *Protokollierung* is still wrong for **recording**, now on
> the stronger ground that it would be a second word for the *Logging* this locale already
> ships. Only the evidence was wrong, and both rows now say so.

**How a log line narrates: seven shapes, chosen by the subject and by what kind of thing is being
reported — not by the event.** `logs` is the only namespace in the product whose text is narration
of things that already happened. Batch 5 settled the system below over the whole namespace; batch
6's `backup`, `orphans` and `stage-details` narrate the same events, so it binds them. **Count
shapes, not lines** — the plural siblings and the unreachable bare keys make any line count
misleading, which is exactly the error the first version of this section made.

| Shape | When | Example |
| --- | --- | --- |
| **Bare headline participle**, no auxiliary and no article | a completed event whose subject needs no article — a proper noun, a mass term, a bare deverbal noun | `logs:vault.unlocked` "Tresor entsperrt.", `logs:tm.cleared` "Translation Memory geleert.", `logs:lqa.passed` "Qualitätsprüfung bestanden.", `logs:categoryGen.failed` |
| **`wurde` / `wurden` + participle** | a completed event whose subject **does** take an article, so the bare headline would read as a fragment | `logs:module.loaded` "Das Modul {{module}} wurde geladen.", `logs:orphan.deleted`, `logs:tm.variantDeleted` |
| **`wird` / `werden` + participle** | in flight, not finished — the control-shape table's progress row, applied to narration | `logs:translation.start`, `logs:translation.retry` "Eine fehlgeschlagene Übersetzung wird wiederholt." |
| **`konnte(n) nicht` + passive infinitive** | a failure the app attempted and could not complete | `logs:translation.queueStartFailed`, `logs:backup.pruneFailed`, all six `failed*` plural forms |
| **`ergab` + object** (Präteritum, bare subject) | a completed **evaluation** reporting what it produced, where a participle would have to invent a verb English does not have | `logs:judge.done` "Review ergab Punktzahl {{score}} — Urteil: {{verdict}}.", `logs:judge.suggestNoChange` |
| **Nominal `… in der Warteschlange`** | queued — a *state* the item is now in, not an event that happened to it; German has no idiomatic participle for it, and `strings:runs.statusQueued` "In Warteschlange" already ships the nominal | `logs:translation.runQueued`, `logs:translation.retryQueued`, `logs:categoryGen.queued`, `logs:stageDetails.queued` |
| **Label-colon-value tail** | any line reporting a **number** that is not `count` — forced by the counting section rather than chosen, and it attaches to whichever shape above the line already has | `logs:sourceReview.done` "Quelltext-Review — Befunde: {{findings}}.", `logs:stageDetails.done`, `logs:translation.queued`, `logs:orphan.detected` |

**Three licensed departures, named so a later batch does not "harmonize" them.** A *state* is not
an event and stays copular — `logs:lqa.overflow` is "Die Übersetzung ist zu lang für den
verfügbaren Platz.", following its own English. An **unaccusative** verb takes `sein` + participle
rather than a passive, because there is no agent to demote: `logs:translation.batchFailed` "Ein
Batch ist fehlgeschlagen" and `logs:translation.maskMismatch`. And the one **active Perfekt** in
the namespace, `logs:translation.tmRejected`, is licensed by its own English — active with a full
subject and object — and by the idiom *die Prüfung bestehen*, which has no natural passive here.

**What batch 6 owed that table, and where it correctly did not follow it.** The three narrating
namespaces named above turned out to narrate almost nothing: `backup`'s six toasts take the
**bare headline participle** ("Backup erstellt.", "Backup wiederhergestellt." — the latter
byte-identical to `logs:backup.restored`, whose English is identical too) and its two failures
take the label-colon tail English gives them ("Löschen fehlgeschlagen: {{message}}").
`orphans`'s failure toasts take **`konnte(n) nicht` + passive infinitive** ("Waise konnte nicht
gelöscht werden"). The one line that looks like the **queue-state nominal** and is not is
`stage-details:translateQueued`: the table's `… in der Warteschlange` was chosen for a `logs`
line reporting the *state* an item is now in, but this key is a **toast** fired at the moment of
enqueueing, and batch 3 already shipped that event shape at `review:retranslateQueued`
("Neuübersetzung in die Warteschlange gestellt") whose English — *Re-translation queued* — is the
same shape. It follows the toast sibling: "Übersetzung der Level-Details in die Warteschlange
gestellt". The table binds narration, not every key whose English ends in *queued*.

> **Added 2026-08-12 (round-5 review, I3).** The convention was in the file and written down
> nowhere, which is the runbook's non-negotiable rule that anything binding a later batch goes into the lexicon or the style file in the same change: a decision that binds a later batch belongs in
> this file, not in a batch report. The one line that broke it was `logs:judge.suggestNoChange`,
> shipped as an article-plus-Perfekt active clause — the only one in the namespace — directly
> against its own sibling `logs:judge.done`, which the same engine emits into the same stream with
> a bare subject and a Präteritum. It now reads "Review ergab keinen Änderungsbedarf."
>
> **Corrected at the round-5 re-review, left visible.** The first version of this section claimed
> **four** shapes covering "all 59 lines", and that overstated it: three further shapes were in the
> file unrecorded — the Präteritum headline the finding itself was about, licensed only inside this
> blockquote and not in the table that binds; the queue-state nominal; and the label-colon-value
> tail, which the same fix round rewrote `logs:orphan.detected` *into*. A table that binds a later
> batch has to carry every shape that batch will meet, and a note inside a correction does not
> bind. Re-derived by classifying all 65 shipped values mechanically rather than by re-reading the
> table.

**Three English verbs collapse onto *Entfernen*; a fourth English word deliberately does not.**
`system:restarted.dismiss` and `system:cancelled.dismiss` are English *Dismiss*, the same word
`account:notificationsDismiss` renders as "Entfernen" — and they ship as "Schließen" instead.
The *Entfernen* row is scoped to taking a **row out of a list**, and dismissing a notification is
a `DELETE` (`stores/notification-store.ts`). These two are the ✕ on a one-off restart banner, and
`RestartBanners.tsx` handles them by writing a `localStorage` flag — nothing leaves a list and
nothing is deleted. The two also **co-render**: the banners mount in the app shell, above
whatever view is open, including the Account view that owns `notificationsDismiss`. One word for
both would put a delete verb on a button that hides a notice.

**An English label that names a surface the app does not have takes the real surface name.**
`logs:action.openQuality` is *Open quality settings*, and the button's handler is
`openTab('quality', …)` at `lib/log-presentation/registry.ts:124`, under `'lqa:overflow'` —
`actions.ts` only defines the `openTab` factory and binds no label. The Quality tab is a
read-only dashboard with no settings on it at all. That is the shape the runbook already records
for `config:fullReplaceOrphanNotice`'s stale *Relink tab*, so the German names the page it opens:
"Qualitäts-Dashboard öffnen", repeating the page title `quality:title` already ships. Its four
siblings need no such judgement — `logs:action.openGlossary` is "Glossar öffnen" and
`logs:action.unlockVault` is "Tresor entsperren", byte-identical to
`config:credentialsUnlockButton`, whose English is identical too.

**Batch 6 met that rule twice more, and split them — the test is whether the English names a
thing that exists.** `orphans:relink.aiNoModules` sends the reader to *the global settings*.
There is no such surface: the page is Global Config, and it is where the module-enable control
in that sentence actually lives (`config:enableModuleSelectLabel`, on `GlobalConfigView`). So
the German repeats the settled surface name — "eines in der Globalen Konfiguration aktivieren"
— which is the `logs:action.openQuality` treatment and also what the surface-name rule asks of
any prose naming a surface. `colorText:assistant.openSettings` and
`stage-details:chatOpenSettings` (*Open settings*) look like the same case and are **not**: the
handler is `setSettingsOpen(true)`, which opens the assistant's own settings block inside the
very panel the button sits in — a thing that exists and is unambiguous in place. Naming it
"Assistenten-Einstellungen öffnen" would import a word this key's English does not have, which
is the sibling-English rule; both ship the plain "Einstellungen öffnen".

**One English instruction was false about the product, and the German does not reproduce it.**
`backup:backupsListDescription` ends with the English sentence *Click a file to download it.* In
`BackupTab.tsx` the file
label is a plain `<span>` inside the row and nothing on that row is clickable except the
Download link and the two buttons beside it, so a reader following the sentence clicks a label
that does nothing. The German states the capability without the false gesture — "Jede Datei
lässt sich herunterladen." — rather than naming the control, which would invent layout copy
English does not have. **Escalated to the controller as an English defect**, not fixed here:
`english-review-notes.md` is frozen and this locale may not edit it.

**The destructive namespaces were translated against the code, not against the English.** This
locale's standing failure is a meaning error no guard can see, so every claim in `orphans` and
`backup` about what an action does was checked at its call site first. Four are worth recording
because the English is loose and a plausible German could have overstated or understated:

- `orphans:confirmDelete.body` — `deleteOrphan` calls `ss.deleteEntry`, so the whole entry goes
  and its translations with it. "Dadurch werden der verwaiste Eintrag und seine Übersetzungen
  dauerhaft gelöscht." is exact, and passive with the patient fronted, so no role can invert.
- `orphans:relink.overrideEmptyOnly` / `overrideAll` — `relinkOrphan` folds the orphan's
  translations onto the target under `overrideMode`: `'empty-only'` writes only where the target
  slot is empty, `'all'` overwrites for every language **the orphan has**. English's "Override
  all translations with the orphan's" is the looser of the two claims; German keeps English's
  scope rather than narrowing it in one locale only, and uses one lexeme — *überschreiben* — for
  the mode label and the option, so the pair reads as one setting.
- `orphans:relink.aiRetranslateHint` — the route captures the orphan's OLD source text and both
  entries' pre-merge translations, then enqueues a background run
  (`relinkRetranslateEngine.enqueue`). It really is a **run**, so the German is "ein
  KI-Durchlauf" per the **run** row's compound head, and `toast.aiRetranslateStarted` really can
  say "siehe Tab Aktivität".
- `backup:confirmBody` and `restoreDescription` — restore verifies **all** checksums before
  anything is applied (`restoreBackup`: "Validate ALL checksums before any write") and then
  applies a Postgres snapshot in one transaction. Nothing is written to disk: `filesRestored` is
  0 for every current archive, and a legacy archive's residual files are deliberately not
  materialized. English says "before any **file** is written" and "config, entries, and glossary
  **files**"; the German drops the noun in both — "bevor etwas geschrieben wird", "Konfiguration,
  Einträge und Glossar des Projekts" — because it names objects this product no longer has,
  while the *effect* the English has on its reader (nothing is touched until integrity is proven;
  your project data is replaced) is reproduced exactly.

**Two German words are forced by their domain even though their root is reserved elsewhere, and
neither is a collision.** *Prüfsumme* (`backup:restoreDescription`) is the only German word for
a checksum; the reservation binds the noun *Prüfung* naming the deterministic LQA check, not the
*prüf-* stem, exactly as `config:reviewProgress` "Prüffortschritt" already ships it. And
`chatQuickPrompts.proofread` writes "Grammatik- und Rechtschreibfehler" where the **issue** row
reserves *Fehler* for **error**: a `-fehler` compound naming a spelling mistake is not the LQA
verdict noun, and batch 2 already shipped the same shape at `strings:runs.aiReviewCheckTypo`
"Tippfehler" and `strings:runs.judgeIssueMistranslation` "Fehlübersetzung". Where the *bare*
loose noun was needed, the **issues** row above still governs.

**Two batch-6 renderings repeat a sidebar tab label verbatim, and both are English's own
identity rather than a German collapse.** `colorText:groupQuality` (a swatch group of
item-quality tiers) is "Qualität" and `stage-details:translationsHeading` is "Übersetzungen",
and each is painted at the same time as the sidebar tab of that name — the shell renders the
16rem rail beside whichever pane is open, so the app shell is the common container and the
co-render test does not clear them. It clears them anyway, because English writes the identical
pair (`strings:tabs.quality` / `colorText:groupQuality`, `strings:tabs.strings` /
`stage-details:translationsHeading`): German is not collapsing two English words into one, it is
carrying one English word across, which is what the surface-name rule asks for. Coining a
different word — *Seltenheit* for the rarity swatches — would assert a distinction English
declined to make. Do not "fix" either.

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

**A noun keeps its capital as the first element of a hyphenated compound adjective**, where the
lowercase form is easy to slip into because the whole word is doing an adjective's job:
"KI-fähiges Modul" (`glossary:generateNoModules`, `category:noModules`) and "Review-fähiges
Modul" (`review:sourceAi.noModules`) — the last of which shipped as "review-fähiges" in round 3
and was corrected; it was the only lowercase `-fähig` compound in the whole locale, against two
capitalized siblings in the same batch.

Adjectives derived from language names are lowercase ("deutsch"), the language name itself
is a noun and capitalized ("Deutsch").

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quotation marks are **German low-high: `„…“`**, not `“…”` and not `«…»`. Where English
  quotes a value (`category:deleteConfirmBody_one` — `“{{category}}”`), German writes
  `„{{category}}“`.
- Ellipsis is the single character `…` (U+2026). `backup:creating` (English *Creating
  backup…*) ships it: "Backup wird erstellt…".

  > **Corrected 2026-08-12 (round 6), left visible.** This bullet was written in round 1 as a
  > **prescription** — `backup` had no German file, so nothing could check it — and it
  > prescribed "Sicherung wird erstellt…", which contradicts the **backup** row of
  > `../terminology/de.md`: this locale ships the loan *Backup* and rejects *Sicherungskopie*
  > by name. Batch 6 created the namespace, which turned the prescription into a citation the
  > guard checks, and it would have failed — correctly, because it named a string this locale
  > must never ship. It also carried its English gloss in **quotes immediately beside the
  > key**, the adjacency the guard reads as a German citation; the gloss is in italics now.
  > The **rule** (one ellipsis character, never three dots) was never in doubt; only the
  > example was, and it had been wrong for five rounds with nothing able to say so.
- Use **ß**, not "ss", where the rule calls for it ("Größe", "außer"). This locale is
  standard German; the Swiss variant that drops ß is a different locale.
- Hyphenate mixed compounds rather than running them together: "Routing-Regel",
  "API-Schlüssel", "Token-Limit".
- Em dashes in the source stay em dashes with spaces around them.
- **`z. B.` is written with an ordinary space, not a no-break space.** Duden wants the two
  parts separated; a no-break space would be typographically nicer and is deliberately not
  used, because it is an invisible character in exactly two strings
  (`vault:namePlaceholder`, `collab:nickname.placeholder`) and the doubled-space sweep
  cannot see it. The one place U+00A0 IS mandatory is before `%` — see the numbers section,
  where it is load-bearing for the rendered value rather than for line breaking.

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

**A key with NO number at all still has to be count-neutral if one of its call sites is a bulk
path — and German exposes that where English hides it.** `orphans:toast.deleteError` is the
worked example and it shipped wrong in round 6. Its English is *Failed to delete orphan*, and it
fires from **two** handlers in `OrphansTab.tsx`: the single-row delete (`handleDelete`) and the
bulk-delete route's catch (`handleBulkDelete`), which runs after a whole selection was rolled
back. English's bare noun is at least ambiguous between one and many; a German noun is not, so
"Waise konnte nicht gelöscht werden" says *one* orphan on a path where N failed — a **worse**
sentence than the source, which is the runbook's rider that faithfulness to an English defect is
not a licence to ship one the English does not have. It now reads **"Löschen fehlgeschlagen"**,
count-neutral and true on both paths, reusing the lexeme `backup:toastDeleteFailed` already
ships. The plural is not the fix — it is the opposite half-truth, false on the single-row path.

**The sibling asymmetry that follows is correct and must not be "harmonized".** Three toasts in
that namespace disagree about number on purpose, because their call sites do: `toast.deleted`
"Waise gelöscht" is singular (only `handleDelete` fires it — the bulk success is the separate
`toast.bulkDeleted`), `toast.loadError` "Waisen konnten nicht geladen werden" is plural (it
reports the whole list failing to load), and `toast.deleteError` is neither. **The question is
rubric item 6's — how many call sites, not what does this control do** — and it has to be asked
of a key that carries no token, which is the case that looks like it needs no counting thought
at all.

**The twelve `bare + _other` families need a German `_one`, and batch 4 is the first batch to
meet any of them.** English spells those twelve with no `_one` at all; German has a `one`
category, so leaving it out would render the **English** string at count 1 unless the bare
sibling happens to rescue it — and `LOCALE_PARITY_STRICT=de` does not accept that rescue.
`vault` holds four of the twelve, and this locale therefore ships **65** keys in a namespace
English spells with 61: `keysCount`, `remainingAttemptsHint`, `retrySuccess` and `retryFailed`
each gained a `_one`. Two mechanics that are not visible from the locale file:

- **The token comes from English's `_other`, not from its bare key.** A German `_one` has no
  English counterpart, so the placeholder guard resolves it against `_other`. `retrySuccess`
  is the only token-asymmetric family in the app — bare has no `{{count}}`, `_other` does — so
  its `_one` MUST carry `{{count}}` while its bare key must NOT. `retryFailed` is the mirror:
  neither English form carries a token, so no German form may add a number.
- **The bare key stays count-neutral.** Once `_one` and `_other` exist it is unreachable; its
  only remaining job is to be grammatical if something ever reaches it.

`vault:keysCount` ships the same string in all three forms, and that is **not** the
count-neutral shortcut the runbook warns about: *Schlüssel* is invariant for number in German,
so singular and plural are the same word and there is nothing to inflect. The other three
families do differ per category.

**Batch 5 shipped the remaining eight** — two in `console` and six in `logs`, so this locale now
supplies `_one` for all twelve and the plural-coverage NOTE printed by `pnpm check:locales` no
longer names `de` at all. **Batch 6 adds none: it contains no plural family at all**, in any of
its seven namespaces, so the language closes at **1,920** keys — English's 1,908 plus exactly
those twelve. Its three `{{count}}` keys (`common:changelogShowOlder`,
`orphans:actions.bulkDelete`, `orphans:toast.bulkDeleted`) are plain English keys with no family,
so they take the count-neutral treatment this section prescribes rather than gaining a German
family: the first two keep English's own trailing "({{count}})", and the third becomes
"Gelöschte Waisen: {{count}}", the `config:rowsProcessed` shape. They are listed in the pre-flight's own section 3, so run
`node scripts/i18n-preflight.mjs de` and read that list rather than rediscovering it.

**Six of the eight inflect normally; two cannot, and the reason is not laziness.**
`console:unreadErrors`, `console:membersNotShown`, `logs:translation.failedNoRoute`,
`failedModuleDisabled`, `failedModuleNotFound` and `logs:orphan.detected` all select on
`{{count}}`, so their `_one` and `_other` differ as ordinary German singular and plural.
`logs:translation.queued` and `logs:sourceReview.done` ship **the same string in all three
forms**, because the number they *display* is `{{total}}` / `{{findings}}` while the number they
*select* on is `count` — two different tokens. `lib/log-presentation/registry.ts` happens to set
both members of each pair from one value, so inflecting after the displayed token would be
correct today; the runbook forbids depending on it, because that guarantee lives in a file no
guard ties to the string. Both are therefore count-neutral — "Zur Übersetzung eingereihte
Einträge: {{total}}." and "Quelltext-Review — Befunde: {{findings}}." — and they lose a
singular/plural distinction English has. **Do not "restore" it** without re-reading that
registry and deciding to depend on it.

**The bare key of each family carries English's own token set and is written count-neutral.**
The three `logs:translation.failed*` bare keys therefore look unlike their own `_one`/`_other`:
they put `{{count}}` behind a label — the closing "Einträge: {{count}}." — instead of in front
of a counted noun. They are unreachable once both categories exist; their only job is to be grammatical if
something ever reaches them.

`node scripts/i18n-preflight.mjs de` is what proves this held: it reports every
non-skiplisted `{{token}}` followed by a German word. Batch 1 landed at **14 raw, 0 after
the token axis**, so `de` had no word-axis exemption list. Batch 2 hit **8 token-axis
survivors before its `usageTokens` fix and 6 after** (4 distinct words); re-running the
detector over the tree as `strings` shipped gave **48 raw / 6 / 0**. Over the tree with
batch 3 landed it gives **80 raw / 13 after the token axis / 0 after the word axis** — every
one of the 13 is cleared by the same four-word list below, so batch 3 added **no** new
exemption and did not touch that file. Quote whichever figure you mean *with the state it reproduces in* —
"landed at 50/8" reads as the shipped state and is not. Building the word list is what
separated the survivors:

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

**Batch 6 produced this locale's first survivor that is neither a defect nor covered by the four
words, and it is escalated rather than absorbed.** Over the complete 24-namespace tree the
detector gives **137 raw / 16 after the token axis / 1 after the word axis**, and the one is
`common:thinking` — "Denkt nach… {{seconds}} s", an elapsed-seconds counter in the chat bubble.
`s` is the SI symbol for *second*, which is invariant for number by definition (never "5 ss"), so
it is the same class as the four words above and belongs in
`NUMERAL_WORD_AXIS_EXEMPTIONS.de` as a fifth entry. **This batch may not edit `scripts/`, so the
entry is the controller's to add**, with that reason. What is deliberately **not** done is the
cheap alternative: writing the token closed-up as `{{seconds}}s` the way English does would clear
the narrow rule (which requires whitespace after `}}`) while shipping a number welded to its unit,
which Duden and the SI both forbid. That is writing around the check, and the runbook's rule about
a guard that rejects copy you believe is correct applies whole: escalate, do not distort. There is
no rendering that keeps the unit and avoids the match — every German unit word or abbreviation
sits in the same position — so the string is not the thing to change.

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
container.** It punishes exactly the strings that need the most room: `sidebar:legal`
("Legal") has a five-character English source, so a 1.5× rule grants seven and a half — no
correct German rendering of it can exist, and batch 4 shipped "Rechtliches" (11) against it.
Meanwhile a 44-character English label like
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
| Table column header (`strings:columns.config`)           | **22**              | soft — columns auto-size                  |
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
| 3 — `glossary` `review` `category` `quality` | 377 | 10,744 | 13,502 | 1.26 | 1.25 | 1.71 | 3.33 |
| 4 — `collab` `account` `vault` `settings` `sidebar` | 300 | 7,851 | 10,003 | 1.27 | 1.26 | 1.71 | 3.20 |
| 5 — `logs` `console` `system` `errors` `generation` `batch` | 123 | 4,567 | 5,780 | 1.27 | 1.25 | 1.57 | 2.07 |
| 6 — `stage-details` `colorText` `orphans` `backup` `welcome` `common` `legal` | 282 | 6,514 | 8,167 | 1.25 | 1.20 | 1.67 | 3.33 |
| **whole language** | **1,908** | **52,591** | **66,146** | **1.26** | **1.24** | **1.67** | **3.75** |

**Every row is over the keys the batch SHARES with English.** It is the same population for
batches 1-3, which added no keys of their own. Batch 4 is the first that differs: it ships
**304** keys against English's 300, because `vault` gains four German `_one` forms (see the
counting section), and those four are excluded from the row above rather than measured
against an English string they have no counterpart in. Batch 5 ships **131** against English's
123 — the remaining eight `_one` forms, likewise excluded. (Batch 5's row is re-derived after its
fix round, which moved four values and removed 32 German characters; the aggregate and the tail
are unchanged to two decimals, the median fell 1.26 → 1.25.)

(Re-derived after the round-4 fix round, which moved four values and added 31 German
characters. The aggregate, median, tail and max are unchanged to two decimals.)

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

**What batch 3 (`glossary`, `review`, `category`, `quality`) contributes.** It holds no sidebar
item and no tab label, so both hard rows are unchanged. It moves neither of the two soft rows it
touches, and both figures are re-measured rather than assumed:

- **Table column header** — the five it adds are `glossary:colSource` "Quellbegriff" (12),
  `colNotes` (7), `colConstant` (8), `colActions` (8) and `quality:columns.passRate`
  "Bestehensquote" (14). The longest ties `strings`' own 14, so **18** still holds.
- **Filter label** — `review:filterNeedsReview` "Zu prüfen" (9) and `review:filterFlagged`
  "Zurückgestellt" (14), both far inside **36**.
- **Bulk-bar control** — the longest is `review:approveUnchangedPassing` "Unveränderte &
  bestandene freigeben" (35), one character inside **36**, and the two glossary bulk actions
  render at 27 and 34 with a two-digit count ("Als konstant markieren (12)",
  "Konstant-Markierung entfernen (12)"). The budget is not raised: 35 fits.

Batch 3's max ratio, `review:flag` "Flag" → "Zurückstellen" (3.25), and `glossary:add` (3.33)
are both measuring a four-character English source; the length gate ignores any English shorter
than 12 characters, and neither string is on a constrained surface. Its **90th percentile fell
back to 1.71** from `strings`' 1.80 — this batch is panel prose and dialogs rather than chrome,
which is the same thing the `config`/`strings` gap said from the other side.

**Two unbreakable tokens over 20 characters shipped in batch 3**, both on unconstrained
surfaces and both terms this locale already ships: "Übersetzungsdurchlauf" (21, in the four
`review:translationAi.*` sentences and in `quality:empty` — five sites after the fix round) and
"Schlusszeichensetzung" (21, `quality:checkLabels.end-punctuation`, an item in the issue-type
list, which wraps). The second
is the batch-1 term repeated verbatim, per the rule that a settled term is split at the point of
use rather than re-coined.

**Batch 2 shipped two more of the same kind, on the same terms**: "Übersetzungsaktivität" (21,
`strings:runs.title`, a page title) and "Übersetzungsdurchlauf" (21, inside
`strings:bulk.cancelFailed`, a toast). Neither surface is constrained. Across `config` and
`strings` together that is four unbreakable tokens over 20 characters and **zero** of them on
any of the five constrained classes — the rule is holding where it bites.

**What batch 4 (`collab`, `account`, `vault`, `settings`, `sidebar`) contributes.** It is the
batch that finally fills the **sidebar-item** row — `sidebar` owns every item in the rail — and
it moves the table-column row by four characters.

- **Sidebar item — the hard 26 holds, with five characters to spare.** Enumerated from the
  `truncate` spans in `Sidebar.tsx`, not from the namespace: **nine** `sidebar:*` labels render
  in the 16rem rail — `sidebar:globalConfig` 21, `sidebar:translationMemory` 18,
  `sidebar:selectProject` 17 (the project-selector trigger in the header), `sidebar:settings`
  13, `sidebar:legal` 11, `sidebar:aboutNarn` 9, `sidebar:changelog` 9, `sidebar:guide` 5 and
  `sidebar:account` 5 — plus the six group headings, of which the longest is
  `sidebar:groups.content` at 12. **The headings are the one part of that list the `truncate`
  sweep does not find**: `SidebarGroupLabel` (`components/ui/sidebar.tsx`) carries no `truncate`
  class, so a heading overflows rather than ellipsizing. They render in the same 16rem rail and
  are held to the same budget; at 12 characters maximum it constrains nothing either way. `sidebar:newProject` 14 truncates in the project-selector
  popover, a `w-64` container of the same width. **Nothing in this batch needed to be shortened
  to fit, and nothing was**: the binding item, "Globale Konfiguration", was fixed in batch 1 by
  the Global Config surface name and simply fits.

  **`sidebar:colorText` is not in that list, and the first version of this paragraph wrongly
  put it there.** The key has **no call site**: `useTranslation('sidebar')` appears once
  (`Sidebar.tsx`), and the Text Styler entry in the rail is `strings:tabs` (color-text), a
  `NAV_GROUPS` tab. The rendering stays "Text-Styler" — byte-identical to its tab twin, as the
  surface-name rule requires — and the budget verdict is unchanged, but the reason was false.
  `vault:remove` is the same shape: correct rendering, no call site. Both are dead-key
  candidates for the between-waves sweep, not defects in this batch.
- **Table column header — raised from 18 to 22**, on the measurement rather than on a
  preference. `collab:sharing.columnLanguages` is "Bearbeitbare Sprachen" (21), the longest
  header this locale ships; the previous 18 was `strings`' own longest plus rounding. The term
  is fixed by the **writable language** lexicon row and is not shortenable — raising a soft
  budget to the measured value is what the soft/hard split is for. Its siblings are far
  shorter: `collab:activity.triggeredBy` 13, `collab:sharing.columnJoined` 11,
  `collab:invites.columnExpires` 10.
- **Tab label, filter label and bulk-bar control are unmoved** — this batch holds none of any
  of the three. `account:tabSecurity`, `tabData` and `tabNotifications` look like tab labels
  and are **not** in that class: they are `TabsTrigger`s inside the Account page's own pane,
  an in-panel bar that wraps, not the 16rem rail. The longest is 18.

**Three unbreakable tokens over 20 characters shipped in batch 4**, all on unconstrained
surfaces: "Sicherheitseinstellungen" (24, `account:mfaLoading`, a status line that wraps),
"Kontowiederherstellung" (22, inside `account:mfaDescription`, a card description) and
"Begriffsübersetzungen" (21, inside `collab:locks.glossaryEditScoped`, an inline hint above the
glossary table). All three are ordinary native compounds that German does not hyphenate; the
20-character rule is scoped to the five constrained classes, and none of these is on one.

Batch 4's max ratio is `collab:routing.retry` ("Retry" → "Erneut versuchen", 3.20) and its
next three are all four-to-six-character English sources as well; the length gate ignores any
English shorter than 12 characters, so none of them is visible to it and none is on a
constrained surface. The **90th percentile is 1.71**, identical to batch 3's — this batch is
half chrome and half dialog prose, and the two halves average out to the same tail the
panel-prose batch had.

**What batch 5 (`logs`, `console`, `system`, `errors`, `generation`, `batch`) contributes: it
moves nothing, and the interesting part is which surface it does *not* belong to.** It holds no
sidebar item, no `strings:tabs.*` label, no table column header, no filter label and no bulk-bar
control, so all five rows stand at their batch-4 values.

**The console's level-filter strip looks like the tab-label class and is not it.** `filter_all`
… `filter_notifications` are `TabsTrigger`s inside `ConsolePanel.tsx`'s own header — a
full-width bottom panel, `text-[10px] font-mono` with a CSS `uppercase`, each trigger `flex-none`
and auto-sized — not the 16rem rail. Two things follow. The labels render **uppercase**, so
`console:filter_notifications` "Benachrichtigungen" is 18 characters of capitals against
English's 13, and nothing truncates. And `console:title` "KONSOLE" is uppercase in the **source**
rather than by CSS, exactly like `strings:columns.config`: preserve it, per the casing section.

The one thing worth measuring here is the floating jump button. `console:jumpToLatest` is
"Zum neuesten Eintrag springen" (29) against a 14-character English source — the batch's
**maximum ratio at 2.07**, well inside the guard's 2.5 cap, on an auto-sized `absolute` button
that overlays the log list and constrains nothing. The bare directional "Zum neuesten Eintrag"
is banned by the navigation-button row above, which is why the verb is there.

**One unbreakable token over 20 characters shipped in batch 5**, on an unconstrained surface and
on a term this locale already ships: "Übersetzungsdurchlauf" (21, `logs:translation.runQueued`
and `logs:translation.queueStartFailed`, two lines in a scrolling log). "Kategoriegenerierung"
(20) and "Glossargenerierung" (18) sit under the rule. This is the batch-1 term repeated
verbatim, per the rule that a settled term is split at the point of use rather than re-coined.

Batch 5's tail is the **lowest of the five at 1.57**, and the reason is structural rather than
lucky: this batch is 123 keys of narration and prose with almost no chrome, and chrome is where a
short English label meets a German compound. The aggregate is unchanged at 1.27, which is the
same thing the `config`/`strings` gap said from the other side.

**What batch 6 (`stage-details`, `colorText`, `orphans`, `backup`, `welcome`, `common`, `legal`)
contributes: it moves nothing, and it is the batch that closes the language.** It holds no
sidebar item, no `strings:tabs.*` label, no filter label and no bulk-bar control, so four of the
five rows stand at their batch-4 values. It does hold **one** table-column-header set — the four
`orphans:columns.*` — whose longest is "Übersetzungen" (13) against the measured **22**, so that
row is unmoved too. `orphans:actions.bulkDelete` looks like a bulk-bar control and is not: it is
one of two buttons in the Orphans card's own toolbar row, not in `strings:bulk.*`'s bar, and it
renders at 20 characters with a two-digit count. (**Corrected 2026-08-12, round-6 review M2:**
this sentence also said the row "wraps". `OrphansTab.tsx:304` is a bare
`flex items-center gap-2` with no `flex-wrap`, so it would shrink or overflow instead. The two
checkable numbers and the conclusion were right and the invented fact was load-bearing for
nothing — which is exactly why it survived being written.)

**One unbreakable token over 20 characters shipped in batch 6**, on an unconstrained surface:
"Unterauftragsverarbeiter" (24, `legal:subprocessors`, a link row in a full-width list). It is
the German data-protection term of art for a GDPR sub-processor and is a native compound German
does not hyphenate, so the 20-character rule — which is scoped to the five constrained classes,
none of which this is on — does not reach it. No shorter defensible form exists; *Subunternehmer*
is a subcontractor in general, not a processor under Art. 28.

Batch 6's max ratio is 3.33, at `colorText:addColorConfirm` — English *Add*, German
"Hinzufügen" — and it measures a three-character English source, which the length gate ignores
(it skips any English shorter than 12 characters). Its **90th percentile is 1.67** — between batch 5's 1.57 and batches 3/4's 1.71,
which is what a batch that is half chrome and half toast prose should look like.

**Batch 6's row was re-derived after its fix round and it moved, which is why that rule exists.**
The round-6 review's Critical replaced `orphans:toast.deleteError` with a count-neutral frame —
11 German characters shorter — and its M1 swapped a preposition at equal length. Eleven
characters in 8,179 moved the **batch** aggregate 1.2556 → 1.2538 and the median 1.2093 →
1.2047, i.e. **1.26 → 1.25 and 1.21 → 1.20 at the two decimals this table prints**, while the
tail and the max did not move at all. The whole-language row absorbed the same eleven characters
and still prints the same two decimals (1.2580 → 1.2577; 1.2417 → 1.2414). A fix round of **two
strings** was therefore enough to falsify two published digits — which is what the runbook means
by re-deriving after the *last* string edit rather than after the translation.

**The whole-language row, and which population it is over.** The bold row above is over the
**1,908 keys `de` shares with English**, one ratio per shared key — the population the runbook's
own comparison table uses (ru 1.19, es 1.22, fr 1.26), so `de` at **1.26** sits with French. Over
the **full 1,920-key German set** instead, measuring each of the twelve extra `_one` forms against
the English form it resolves to, the figures are aggregate **1.2567**, median **1.2405**, 90th
percentile **1.6667** — a difference of one unit in the third decimal, because twelve extra keys
in nineteen hundred cannot move an aggregate. That gap is much smaller than Russian's, and the
reason is the same one that fixes the key count: German adds twelve keys where Russian adds 94.
The tail is identical to two decimals on both populations. The whole-language **max** is
`strings:runs.judgeVerdictFail` ("Fail" → "Nicht bestanden", 3.75), unchanged from batch 2.

**"Sits with French" is doing real work and was re-derived over the identical population rather
than taken from the runbook's rounded table:** ru **1.1862**, es **1.2187**, fr **1.2576**, de
**1.2577**, each over the same 1,908 shared keys. German is the longest of the four, by one ten-
thousandth over French — so the honest statement is that de and fr are indistinguishable and both
run about 6% longer than Spanish, not that German is "comfortably mid-range". The fix round moved
de from 1.2580 to 1.2577 and did not change that ordering.

All figures on this line and in the table above are re-derived after the **fix round's** last
string edit, not the batch's.

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
noun in front and let it carry the gender and the case. Batch 5 shipped the worked example at
`logs:translation.failedModuleDisabled_other` — English's closing clause is *— the {{module}}
module is turned off* and the German reads "das Modul {{module}} ist deaktiviert".

> **Corrected 2026-08-12 (round 5), left visible.** This paragraph previously quoted that clause
> capitalized, as a standalone sentence. The key writes it mid-sentence after an em dash, so the
> shipped span is lowercase, and the quotation named a string that does not exist. The citation
> was written in round 1, when `logs` had no German file at all and nothing could check it; it
> became checkable the moment batch 5 created the namespace. The **device** — a real noun in
> front of the token — was never in doubt, only the form quoted for it.

**The same device covers `{{language}}`, and batch 5 is where it decided the preposition.**
The `logs` namespace names a target language nine times, and English varies between *into
{{language}}* and *for {{language}}* for one relation. German cannot mirror *into*: "ins
{{language}}" needs the adjectival form of the language name and "in {{language}}" needs an
article, and the token supplies a bare noun (*Deutsch*, *Französisch*). Batch 2 had already
settled the frame — `strings:compare.cellClearAria` is "Übersetzung für {{language}} löschen" —
so every `logs` line uses *für {{language}}*, e.g. `logs:translation.done`
"Ein Eintrag wurde für {{language}} übersetzt." That is one German preposition for one English
relation, not a collapse of two: check the English of any *new* key before reusing it.

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

**And it covers a third shape, which round 3 shipped and the review caught: deixis.** A
demonstrative is an attachment device too, and German's *dieser* is proximal in exactly the way
English's *this* is — so re-using it for a **different** referent late in a string that has
already spent it on the current one silently redirects the reader.
`glossary:confirmPushReplaceDescription` is the worked example and it is worth keeping, because
the string is the confirm dialog for an irreversible cross-project deletion. English closes with
the **distal** "until **that** project is pushed again", pointing at each *other* project; the
first German shipped the **proximal** "bis **dieses** Projekt erneut übertragen wird" after the
same sentence had already written "nicht nur in **diesem** Projekt" and "wird **dieses** Glossar
neu übertragen" for the project the user is standing in. The reader was told the other projects
recover when *they* re-push. It now reads "…bleiben gelöscht, bis **das jeweilige** Projekt
erneut übertragen wird" — *das jeweilige* / *das betreffende* distributes over the other
projects, which is what the English distal does. **Two rules fall out:**

- **Count your demonstratives per string, not per clause.** If *dieser* is already spent on one
  referent, a second referent needs a distributive (*das jeweilige*, *das betreffende*) or a
  repeated noun — never a second *dieser*.
- **"until" needs a state verb.** German `sein` + participle is a completed state and does not
  carry "until"; a state that persists until an event takes *bleiben* ("bleiben gelöscht, bis
  …"), not "sind gelöscht, bis …".

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
