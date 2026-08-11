# NARN terminology — German (`de`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/de.md`](../style/de.md) — how German is written here: register, punctuation,
  capitalization, plural and agreement rules. That one is yours to write too, for this
  locale only.

Fill a row when you meet the term, in the same change that introduces the wording — so
this file records decisions actually taken, never predictions. Use **Notes** for anything
the next translator would otherwise have to rediscover: a declension that forced a
different word, a term you deliberately left in English, an acronym you expanded, a
candidate you rejected and why.

Terms are in the order they appear in `../terminology.md`. Do not add, remove or reorder
rows: a term the lexicon lacks goes in the additive queue in [`README.md`](README.md).

An empty Rendering means **no batch has met that term yet** — not that it was skipped.
Batch 1 (`config`) filled the rows below; the rest are for later batches.

| Term | Rendering | Notes |
| --- | --- | --- |
| project | Projekt | n., neuter. Verb is *erstellen*, never *öffnen*. |
| workspace | Workspace | Loan kept on purpose: it must never share a word with *Projekt*, and every German native candidate (*Arbeitsbereich*, *Umgebung*) reads as a project-sized or environment-sized scope. Attributive as a hyphenated compound — `config:workspaceSettingsTitle`, `config:batchGroupingDefaultOption`. |
| entry | Eintrag | n., masc., pl. *Einträge*. The counting unit of the whole app. Do not reuse for a translation-memory record without a qualifier — `config:tm.clearAllSuccess_one` writes it out in full. **English *string* splits two ways and both readings were verified at the call site — do not harmonize them.** `config:routing.simpleHint` ("Every string in this project") really does mean entries and takes *Eintrag*; `config:pseudoTestHelpBody` ("hardcoded strings") means literal text baked into the game, is not an entry at all, and takes "hartcodierte Texte". The `logs` namespace's narrated *strings* are entries and take *Eintrag*, per the canonical-term rule. **House rule for this column, since this row is the first to need it:** the citation guard treats a quoted span as a checkable German citation whenever it sits *immediately* next to a backtick key, so an English gloss must be kept out of that adjacency — wrap it in parentheses, as both glosses above are, or set it in italics. Drop the parentheses and the English words get tested against the German corpus and fail. That is not hypothetical: the first draft of this sentence demonstrated the bad form inline, and the lexicon citation check failed on it. **A second trap sits next to it** — a backtick span containing a space is treated as a citation too, so a shell command in backticks fails the same way; the guard's own header calls that path unexercised, and it is not any more. Name the check in plain prose here, and keep backticks for key and file references only. |
| source text | Quelltext | n., masc. Shares the *Quell-* root with *Quellsprache*; that is fine, the heads differ. Not *Originaltext*. |
| translation | Übersetzung | n., fem. Verb *übersetzen*. |
| source label | Herkunftslabel | n., neuter, pl. *Herkunftslabels*. *Quellenlabel* was rejected: English already shortens the column heading to *Sources*, and a German shortening to *Quellen* would be indistinguishable from *Quelltext*/*Quellsprache* — exactly the collision the shared lexicon warns about. `config:routing.labelSources` therefore shortens to "Herkunft" instead, and `config:routing.anySource` follows it. |
| achievement | Errungenschaft | n., fem. Steam's German term; *Erfolg* (Xbox) was rejected because `config:health.successRate` already uses *Erfolg* for a different thing, and *Trophäe* is PlayStation-only. The genitive compound is long, so the labels use a *von*/*der*-phrase instead: `config:lqa.achievementDescriptionBytesLabel`. |
| inline tag | Inline-Tag | n., neuter, pl. *Inline-Tags*. Hyphenated mixed compound. |
| placeholder | Platzhalter | n., masc. The in-text token sense only (the double-brace tokens). The input-hint sense of the English word is a different thing and takes no noun in German — those strings are written as infinitive phrases instead. |
| translator context |  | Not yet rendered. `config:includeContext` names only the CSV column ("Kontextspalte"), not the term. Whoever meets the term must keep it distinct from the model's *Kontextfenster*, which `config:models.confidenceReason.prompt-near-context` already uses. |
| source language | Quellsprache | n., fem. Pairs with *Zielsprache*. |
| target language | Zielsprache | n., fem. |
| reference language |  |  |
| writable language |  |  |
| Pseudo Test | Pseudo Test | Proper noun, kept as-is and unhyphenated when standing alone (`config:pseudoTestHelpAria`). In a German compound it takes hyphens throughout — `config:pseudoExportHint` writes "Pseudo-Test-Text" — which is orthography, not a second name. The language code `pseudo-test` is never translated. |
| run | Durchlauf | n., masc., pl. *Durchläufe*. Never a verb. Bare *Lauf* was rejected: on its own it reads as running/jogging, and *Durchlauf* is the ordinary German word for one execution of a process. **The compound head is `-durchlauf` / `-durchläufe`, never a shortened `-lauf`** — `config:importModeFullReplaceHint` "KI-Durchläufen", `config:batchGroupingDescription` "Übersetzungs-, Bewertungs- und Quelltext-Review-Durchläufe". A shortened compound reads as a different word from the standalone noun, which is how one term becomes two. |
| Activity |  |  |
| batch | Batch | n., masc./neuter — treated as masc. here (*ein Batch*, pl. *Batches*). Loan, per the don't-over-Germanize rule; *Stapel* reads as a physical pile. |
| batch grouping | Batch-Gruppierung | n., fem. Distinct from *Batch-Modus* (`config:module.batchMode`), which is the other setting. |
| AI review | KI-Review | n., neuter, pl. *KI-Reviews*. Deliberately **not** built on *Prüfung*, which is reserved for the deterministic LQA checks. *Review* is ordinary German developer vocabulary (Code-Review). |
| judge | bewerten / Bewertung | Verb, evaluative sense; never *richten*/*Richter*, and no noun "der Judge". **One rendering, both parts of speech: wherever English uses *judge* as a noun or an attributive naming the pass, it is the deverbal *Bewertung*** — `config:requestTimeoutDescription` and `config:maxOutputTokensDescription` list it among the AI call types, `config:batchGroupingDescription` compounds it as "Bewertungs-…-Durchläufe". It had briefly drifted to a second rendering ("KI-Review der Übersetzungen") in the third of those; that is the *surface* name of the Translation AI review tab, which batch 3 owns, and it must not double as the term. |
| source review | Quelltext-Review | n., neuter. Built from *Quelltext* + *Review* so it is visibly the same system as *KI-Review* applied to the source. |
| finding |  | Whoever fills this must not reuse *Beanstandung*, which is taken by *issue* below. |
| suggestion |  |  |
| discard | Verwerfen | Sense 1 only — the unsaved-edits button beside Save (`config:discard`). The reject-a-proposal sense needs a second word and is not decided yet; do not extend this one to it. `config:discardUntranslatable` is a **third** sense the frozen lexicon does not cover — omitting entries from an export, which destroys nothing — and is written as "weglassen". It is **queued** in [`README.md`](README.md) for the between-waves resolution, because thirteen other languages meet that same key in their own batch 1 and this file is not one any of them reads. |
| needs review | zu prüfen | Verb phrase, so it carries no gender. The *reviewed* counterpart is the participle "geprüft" (`config:reviewProgressCount`) and the progress heading is "Prüffortschritt" (`config:reviewProgress`). Batch 2 owns the filter label and the row badge; it must reuse these two forms rather than coin a third. |
| flag |  |  |
| Review (the sidebar group) |  |  |
| review queue |  |  |
| module | Modul | n., neuter, pl. *Module*. Never *Plugin*. |
| module instance | Modulinstanz | n., fem. Shortened to *Instanz* once *Modul* is established in the sentence, which is most of `config:instances.*`. The id itself is never translated; `config:instances.slugLabel` is "Instanz-ID" and the identifier fragment stays *Slug*. |
| provider | Anbieter | n., masc. Used only for the outside company/service. `config:routing.simplePlaceholder` labels a module-instance picker *Provider* in English — a known English defect — and is rendered with this word as written, without dragging *Modul* toward it anywhere else. |
| model | Modell | n., neuter. *Vorlage* carries *template*, so the usual German model/template collision does not arise. |
| prompt | Prompt | n., masc. Loan. Capitalized as a German noun even where the English badge is lowercase (`config:routing.promptBadge`). |
| reasoning effort | Reasoning-Aufwand | n., masc. The provider's own parameter; German AI tooling keeps *Reasoning*. |
| routing rule | Routing-Regel | n., fem., pl. *Routing-Regeln*. *Routing* is the established German loan for content routing too, and hyphenation keeps it from reading as network routing on its own. |
| rule group | Regelgruppe | n., fem. Distinct from *Kategorie* and from *Batch-Gruppierung*. |
| credential vault | Tresor | n., masc. Bitwarden's German term for the same object. Carries all four phrasings: `config:credentialsVaultLockedChip`, `config:credentialsVaultLocked`, `config:credentialsUnlockButton`, `config:credentialsMissing`. |
| credential | Zugangsdaten | n., plural-only in German (there is no natural singular), which suits every string — English uses the plural throughout. *Anmeldeinformationen* was rejected as a 21-character unbreakable compound. Vault key names are never translated. |
| LQA | LQA | Kept as the industry acronym; German localization practice uses it untranslated. Attributive with a hyphen: `config:lqa.title`, `config:health.lqaRetries`. |
| quality gate | Gate | n., neuter. The full form is *Quality-Gate*; `config:overflowRatioDescription` says "LQA-Gate" and `config:lqa.description` uses the bare "Gate" once quality checks have been named, mirroring English. *Tor*, *Pforte* and *Schranke* all read physically and are banned. |
| check | Prüfung | n., fem., pl. *Prüfungen*; verb *prüfen*. Covers "Qualitätsprüfungen" and "LQA-Prüfungen" (`config:lqa.title`, `config:lqa.description`) and every individual check name. Reserved against *AI review*. |
| issue | Beanstandung | n., fem. One verdict an LQA check files. *Fehler* is reserved for *error*, *Problem* reads as a crash, and *Meldung* collides with the `{{message}}` strings. `config:lqa.description`. |
| severity | Schweregrad | n., masc. The two values are "Blockierend" and "Warnung" (`config:lqa.severityBlocking`, `config:lqa.severityWarning`); they belong to *check*, not here. |
| notification severity |  | Not met in `config`, but "Warnung" is already fixed by *severity* above and must render identically there. |
| assertion | Zusicherung | n., fem. A genuinely fourth word: *Bedingung* is routing conditions, *Prüfung* is the LQA checks, *Regel* is routing rules. `config:lqa.regexAddAssertion`. |
| pattern | Muster | n., neuter. Regex sense only. Free of the *Vorlage* (template) collision by construction. |
| overflow | Überlauf | n., masc. "Überlauf-Verhältnis" for the ratio (`config:overflowRatioLabel`), "Längenüberlauf" for the check name. |
| length limit | Längenlimit | n., neuter. A hard cap, deliberately not built on *Überlauf*. *Begrenzung* was rejected as the banned *limitation* reading. `config:routing.labelMaxLength`, `config:lqa.checks.length-limit.name`. |
| pass rate |  | Not met in `config`. Note before deciding it: `config:health.successRate` is the **other** metric (provider request success) and already ships as "Erfolg {{rate}} %", so *pass rate* must not be built on *Erfolg*. |
| glossary | Glossar | n., neuter. |
| glossary term | Glossarbegriff | n., masc., pl. *Glossarbegriffe*. Never *Eintrag*. |
| constant |  |  |
| match | Treffer | n., masc.; verb *übereinstimmen*. `config:lqa.checks.glossary-adherence.description` uses the noun, `config:lqa.regexModeMustMatch` the verb. Never the word chosen for *glossary term*. |
| translation memory | Translation Memory | Neuter, uninflected. The established German CAT-tool term (Trados, memoQ) and it sidesteps *Speicher*, which reads as RAM. In a German compound it takes hyphens: `config:tm.policyUpdateFailed`. |
| approve | freigeben | Verb; the only route into the Translation Memory (`config:tm.browserEmpty`, which uses the nominalized infinitive). Distinct from *anwenden* (apply), *als geprüft markieren* (mark reviewed) and *speichern* (save). If a later batch ships only an inflected form (*freigibst*), **change this cell to the attested form and keep the dictionary form here in Notes — never reword the string.** See the citation-guard note in `../style/de.md`. |
| category | Kategorie | n., fem., pl. *Kategorien*. |
| tone | Tonfall | n., masc., pl. *Tonfälle*. Bare *Ton* reads acoustically; *Stil* and *Stimme* read as the model's writing style. |
| orphan | Waise | n., fem., pl. *Waisen* — the Orphans tab title. The adjective is *verwaist* (`config:orphanedCount`, `config:importModeFullReplaceHint`), and it is invariant after a number, which is why the count strings need no plural family. |
| relink | neu verknüpfen | Verb. `config:importModeFullReplaceHint` ships the participle "verknüpft". One verb for the row button, the dialog title, the confirm step and the import warning. |
| backup | Backup | n., neuter, pl. *Backups*. Loan, per the don't-over-Germanize rule; *Sicherungskopie* is not what practitioners say. The surface name is the bare word (`config:importSnapshotNote`, `config:maxBackupsLabel`). |
| snapshot | Snapshot | n., masc./neuter — treated as masc. (*ein Snapshot*, "Sicherheits-Snapshot" in `config:importSnapshotNote`). `config:templatesDescription` uses the plural loosely for saved configurations, exactly as English does. |
| template | Vorlage | n., fem. *Modell* is taken by the AI model and *Muster* by the regex pattern, so neither is available. `config:templatesTitle`, `config:saveAsTemplate`. |
| collaborator |  |  |
| member |  |  |
| nickname |  |  |
| claim |  |  |
| invite |  |  |
| recording |  |  |
| stage |  |  |
| Text Styler |  |  |
| element |  |  |
| theme |  |  |
| guide | Guide | n., masc. Loan, kept as the surface name; *Anleitung*, *Handbuch* and *Dokumentation* are all defensible German but the shared lexicon bans alternating between them, and *Guide* is what the sidebar item will be. `config:pseudoTestHelpLink`. |
| release |  |  |
| changelog |  |  |
