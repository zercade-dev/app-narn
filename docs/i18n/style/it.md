# Style guide — Italian (it)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/it.md`. This file settles register, control shapes, casing,
punctuation, length and placeholder handling.

**Quoted spans in this file are checked.** `check-lexicon-citations.mjs` reads a quoted
span here as a claim that the Italian locale ships that text, and Italian is Latin-script,
so a candidate written in quotes but never shipped fails the guard instead of being
skipped. Rejected wordings are therefore written in _italics_, always.

## Register

**Tu, not Lei.** Italian software localization moved off _Lei_ years ago, and _tu_ is what
the informal-but-professional English source calls for. Instructions use the second-person
singular imperative: `sidebar:selectProject` ("Select a project") is “Seleziona un
progetto”, not _Selezioni un progetto_ and not the impersonal _Selezionare un progetto_.

Progress states are the deverbal noun with _in corso_ where the English is a bare present
participle: `backup:restoring` ("Restoring…") is “Ripristino in corso…”, not
_Ripristinando…_.

## Control shapes — resolve the control before you write the string

English writes the same words for a title, a button, a column header and a placeholder.
Italian does not. `config:models.select` and `config:models.pickTitle` are byte-identical
in English ("Select a model") and are two different controls: the first is the picker's
trigger label (`ModelPicker.tsx:616`) and the second is a `<DialogTitle>` (`:656`), so they
ship “Seleziona un modello” and “Selezione del modello” respectively.

| Control | Shape | Worked example |
| --- | --- | --- |
| Page title, section heading, tab label | noun phrase | `config:routing.title` → “Regole di routing” |
| Dialog title that names an action | deverbal noun phrase | `backup:createSection` → “Creazione di un backup” |
| **Confirm-dialog title** | **infinitive** | `config:confirmDeleteTitle` → “Eliminare il progetto” |
| Button | second-person imperative | `sidebar:create` → “Crea”; `strings:bulk.apply` → “Applica” |
| Table column header | bare noun, keeping English's abbreviation | `config:models.colParameters` ("Params") → “Param.” |
| Placeholder inside a control | imperative | `config:models.searchOrType` → “Cerca o digita il nome di un modello…” |
| Progress or status text | deverbal noun, never an imperative | `strings:row.translating` → “Traduzione in corso” |

**A confirm-dialog title keeps English's question mark where English has one and leaves it
off where English does not** — the source is inconsistent about this and matching per key
is what stops a later reviewer "fixing" one of them. So `config:confirmDeleteTitle`
("Delete project") has none and `category:deleteConfirmTitle` ("Delete category?") does.

**One pair breaks the button rule deliberately.** `sidebar:createTab` and
`sidebar:joinProject` are the two sub-tabs of the new-project dialog, and English writes
both as verb phrases rather than as nouns; they ship “Crea nuovo” and “Unisciti a un
progetto” so the pair stays a pair.

## Casing

Sentence case for every control, label, tab and page title. Italian capitalizes only the
first word and proper nouns, so `config:routing.title` ("Routing Rules") becomes “Regole di
routing”. `english-review-notes.md` records that English Title Case on page titles is a
per-surface design convention with no meaning outside English — do not mirror it.

Language names, months and weekdays are lowercase.

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes “STATO”, because that header sits beside language names the table
uppercases in code. **Preserve deliberate lowercase for the same reason:** the three cell
chips `strings:compare.cellTranslatedBadge`, `cellReviewedBadge` and `cellNeedsReviewBadge`
are lowercase by design and ship “tradotto”, “revisionato” and “da revisionare”.

## Agreement — the two nouns that decide half the locale

Two gender choices in `terminology/it.md` propagate through whole namespaces, so they are
repeated here:

- **_voce_ (entry) is feminine**, so every status word about an entry agrees feminine:
  “Ignorata”, “Nuova”, “Troppo lunga”, “Non ancora tradotta”.
- **_cassaforte_ (credential vault) is feminine**, so every standalone status word in the
  vault namespace agrees feminine: “Bloccata”, “Sbloccata”, “Non ancora creata”.
- **_esecuzione_ (run) is feminine**, so run statuses agree feminine: “In corso”,
  “Completata”, “Non riuscita”, “Annullata”.

**The "reviewed" family follows the es/fr rule, not a fourth one.** A status value quoted
as a token stays in its masculine citation form — `strings:compare.cellReviewedBadge` is
“revisionato” and `strings:contextMenu.clearReviewed` quotes that same token. Where the
string names the noun, agreement is forced: `strings:compare.cellMarkReviewedAria` is
“Segna la traduzione in {{language}} come revisionata”. An elliptical action label with no
visible antecedent follows the token: `strings:shortcuts.markReviewed` is “Segna come
revisionato”.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”` (U+201C / U+201D), matching the English source after its review.
  Reserve `«…»` for reported speech, which this UI does not contain.
- Ellipsis is the single character `…` (U+2026), matching `glossary:generateRunning`
  ("Generating…") — “Generazione in corso…”.
- Write accented vowels with real accented characters — “perché”, “è”, “già” — never
  _e'_ or _perche'_. Distinguish _è_ (verb) from _e_ (conjunction); this is the most
  common Italian typing error in UI strings.
- Em dashes in the source stay em dashes with spaces around them. Where English uses an em
  dash to introduce a consequence, a colon is often better Italian, and several strings
  take one.

## Numbers and dates

Decimal comma, thousands point. `config:overflowRatioDescription` therefore ships the
default overflow ratio as “1,75” where English writes 1.75 — a real localization decision,
not a typo, and the only numeral in the corpus that needed converting.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Keyboard key names

`terminology.md` requires the key name **as engraved on this locale's keyboard**, not the
English word. Italian layouts print **Invio** on the Enter key, so every key-name reading of
_Enter_ is “Invio” — `strings:compare.contextPlaceholder`, `tonePlaceholder`,
`cellEditTooltip`, `cellEditReviewedTooltip` and `common:webSearch.hint`. **Esc** is
engraved in Latin and stays. **Shift** is the one to watch: Italian keycaps print either
the bare ⇧ glyph or the Latin word, so the Latin word is what ships, and a translator with
a physical Italian keyboard in front of them should confirm it rather than take this
sentence on trust.

The same words appear as ordinary verbs and nouns and translate normally there —
`strings:shortcuts.enterEditMode` ("Enter edit mode") is “Attiva la modalità di modifica”,
not a keystroke.

## Surface names — repeat these verbatim

Every key naming one of these gets the same rendering, and prose mentioning the surface
repeats it. This list is the deliverable a later batch inherits; `terminology.md` is the
authority for which surfaces are on it.

| Surface | Rendering | Keys that must agree |
| --- | --- | --- |
| Config | “Configurazione” | `strings:tabs`, `strings:guide.topicConfig` |
| Translations | “Traduzioni” | `strings:tabs`, `strings:guide.topicMultiLanguage`, and prose in `config:routing.categoriesConfiguredHint`, `category:subtitle`, `category:empty`, `category:noEntriesInCategory` |
| Compare | “Confronto” | `strings:tabs`, `strings:guide.topicCompare`, and prose in `config:routing.tonesHint`, `strings:order.presortHint` |
| Source AI review | “Revisione IA origine” | `strings:tabs`, `review:sourceAi.configTitle` |
| Translation AI review | “Revisione IA traduzioni” | `strings:tabs`, `review:translationAi.title` |
| Quality | “Qualità” | `strings:tabs`, `strings:guide.topicQuality`, `colorText:groupQuality` |
| Glossary | “Glossario” | `strings:tabs`, `strings:guide.topicGlossary` |
| Category | “Categoria” | `strings:tabs`, `strings:guide.topicCategory` |
| Activity | “Attività” | `strings:tabs`, `strings:guide.topicActivity`, and prose in `review:translationAi.progressActivityNote`, `glossary:generateRunningHint`, `orphans:toast.aiRetranslateStarted` |
| Stage details | “Dettagli livello” | `strings:tabs`, `stage-details:title` |
| Orphans | “Orfane” | `strings:tabs`, `orphans:title`, `strings:guide.topicOrphans`, and prose in `config:fullReplaceOrphanNotice` |
| Backup | “Backup” | `strings:tabs`, `strings:guide.topicBackup`, and prose in `config:importSnapshotNote` |
| Sharing | “Condivisione” | `strings:tabs`, `collab:sharing.pageTitle` |
| Text Styler | “Stile testo” | `strings:tabs`, `colorText:title`, `sidebar:colorText` |
| Global Config | “Configurazione globale” | `sidebar:globalConfig`, `config:globalConfigTitle`, and prose in `strings:runs.aiReviewNoModules`, `review:sourceAi.noModules`, `orphans:relink.aiNoModules`, `colorText:assistant.openConfig`, `stage-details:chatOpenConfig` |
| Translation Memory | “Memoria di traduzione” | `sidebar:translationMemory`, `config:tm.policyTitle`, `config:tm.browserTitle`, `strings:guide.groupTranslationMemory`, `strings:guide.topicTranslationMemory` |
| Credential Vault | “Cassaforte delle credenziali” | `strings:guide.topicVault`, `vault:statusLabel` |

Two relationships are deliberate and must not be "fixed": `strings:runs.title` is longer
than its tab (“Attività di traduzione” against “Attività”), and `legal:title` is longer than
its sidebar item (“Note legali e informative” against “Note legali”).

**The five sidebar group headings and their guide twins are byte-identical**, because
English writes them so and they render nested: “Preparazione”, “Traduzione”, “Revisione”,
“Terminologia”, “Manutenzione” at `sidebar:groups.*` and `strings:guide.group*`.

**Two nesting decisions were forced and are recorded so nobody reopens them.**
_Preparazione_ was chosen for the Setup group precisely because _Configurazione_ is the
Config tab nested directly under it, and a heading equal to its own child is the defect the
runbook's co-render rule exists to prevent. _Traduzione_ (singular) heads _Traduzioni_
(plural): the two are distinct strings and neither contains the other, which is the same
shape every wave-1 locale reached independently. Under _Revisione_ each child specialises
the heading — “Revisione IA origine”, “Revisione IA traduzioni”, “Revisione manuale” — so
the heading is a proper substring of three of them and equal to none.

**One collapse is accepted and is recorded here so nobody reopens it.**
`sidebar:groups.translate` (“Traduzione”) reads identically to
`strings:runs.typeTranslation` and `strings:runs.judgeTargetLabel`, and those do co-render:
the sidebar is always painted and the run type is a cell in the Activity table. English
keeps them apart only because it has a zero-derived verb ("Translate" against
"Translation"), which Italian does not. The decision is **not** taken from English: `ru`
(Перевод/Перевод) and `tr` (Çeviri/Çeviri) ship exactly this collapse, and only `de` avoids
it, because German has a distinct verbal noun (Übersetzen/Übersetzung) where Italian has
one word. The collapse this locale does **not** accept is the parent/child one — the group
heading against the tab nested directly under it — and “Traduzione” over “Traduzioni” keeps
those two distinct, which is the pair the co-render rule actually protects.

## Length discipline

Measured over the 1,908 keys Italian shares with English (see `backfill-runbook.md` §2.10
on stating the population): **aggregate 1.25, median 1.25, 90th percentile 1.70.** Italian
sits between French and German, and the tail is what matters — at the 90th percentile a
string runs 1.7× its English source, which is what breaks chrome.

**Budget in absolute characters per class, never as a multiple of English.** A ratio scales
with the source rather than with the container: `sidebar:legal` is "Legal", five
characters, so a 1.5× rule would grant seven and a half and no correct Italian rendering
could exist. The Russian pilot audited every constrained-surface key against such a rule and
found 27 breaches, none of them a wrong string.

| Class | Budget | Longest shipped | Kind |
| --- | --- | --- | --- |
| Sidebar item (`sidebar:globalConfig`, `sidebar:legal`) | **26** | 22 | **hard** — fixed 16rem, truncates |
| Tab label (`strings:tabs.backup`) | **26** | 23 | **hard** — the same 16rem sidebar, truncates |
| In-panel sub-tab (`config:routing.tabImportExport`) | 30 | 27 | soft — the bar scrolls |
| Table column header (`strings:columns.config`) | 24 | 22 | soft — columns auto-size |
| Filter label (`strings:filters.needsReview`) | 45 | 43 | soft — the filter row wraps |
| Bulk-bar control (`strings:bulk.approveSelected`) | 38 | 35 | soft |

**The two hard budgets are derived from the container, not from what Italian happened to
need**, so they carry over unchanged to any language: the sidebar is `16rem`
(`SIDEBAR_WIDTH` in `components/ui/sidebar.tsx`) and every label in it is wrapped in
`truncate`. About 199px of the 256px is usable once the border, group padding, button
padding, icon and gap come off, which is roughly 26 characters of Latin script. **The tab
labels are sidebar menu items** — there is no horizontal tab bar in this frontend; the only
call site of `strings:tabs.*` is a truncating span inside a `SidebarMenuButton` — so that
class shares the sidebar's budget rather than the softer in-panel one.

**The four soft budgets are the longest rendering each class actually needed, rounded up**,
re-derive them rather than copying them if the corpus moves. They are a preference, not a
threshold: prefer the shorter of two correct options, never distort a term to hit a number.

Italian's longest tab label is “Revisione IA traduzioni” at 23 characters, four under the
hard budget, so nothing in this locale needed an escalation.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Three Italian-specific hazards:

- **Never elide before a token.** _l'{{module}}_ is unsafe because neither the value's
  initial letter nor its gender is known. Put a real noun in front: the closing clause of
  `logs:translation.failedModuleDisabled` becomes “il modulo {{module}} è disattivato”.
- **Never let an article or a past participle agree with a token** — the inserted noun
  carries the agreement.
- **Only `count` triggers plural selection.** Every other numeric token — `{{total}}`,
  `{{maxLength}}`, `{{entryCount}}`, `{{findings}}`, `{{completed}}` — needs a frame that is
  grammatical at every value, because the framework never looks for a plural key for them.
  The devices this locale uses, in order of preference: **the number after an invariant
  noun phrase behind a colon** (“Voci: {{count}}”, “Da tradurre: {{count}}”), **an
  invariant abbreviation or loanword** (_car._, _byte_, _token_, _batch_ — all invariable in
  Italian), and **a bare ratio with the label in front rather than behind**
  (“Revisionate: {{reviewed}} / {{total}}”).

  That last device is the one Italian gets wrong by default, and the numeral detector caught
  both instances: `config:reviewProgressCount` and `strings:runs.stringsProgress` first read
  _{{completed}} / {{total}} voci_, with a plural noun after a ratio whose denominator can be
  1. Putting the word in front turns it from an agreement into a label. Do not reach for
  `{{count}}` instead — the placeholder guard compares the multiset of tokens against
  English, so swapping the token is two violations rather than a clever fix.

## Plurals

**Ship `_one` and `_other`, and nothing else. Do not write `_many`.**

CLDR gives Italian three categories — `one`, `many`, `other` — but `many` selects **only
exact millions** (1000000, 2000000, …; verified via `Intl.PluralRules`, where no integer in
0..200 selects it and 1500000 is `other`). No count this UI renders reaches a million, so
the category is real per the grammar and unreachable by anything the product can show.
`COVERAGE_GAP_GRANDFATHER` in `scripts/locale-rules.mjs` records exactly this for `it` and
`pt-br`, and the shipped `es`/`fr` precedent — identical category shape, zero `_many` keys
between them — agrees.

**`LOCALE_PARITY_STRICT=it` reports all 41 families as missing `_many`, and that is the one
expected failure for this language.** Strict mode short-circuits the grandfather by design,
so it cannot see the reachability argument. Read that specific failure as the documented
exception; **every other strict-mode finding on `it` is real and must be fixed.** As shipped,
it is the only one.

**An earlier version of this section said the opposite** — that a count which could
plausibly reach a million should carry `_many`, and that the parity guard only reports the
gap. Both halves were wrong: the default guard does not merely report it, it grandfathers
it on a measured reachability argument, and adding `_many` would ship 41 keys that no count
can ever select. The correction is left visible here rather than rewritten away, because a
quietly repaired reason is indistinguishable from one that was always sound.

**Twelve families need a `_one` that English does not have.** English writes twelve families
as a bare key plus `_other`, with no `_one` at all, and a locale backfilled under strict
parity must supply all twelve — so Italian lands at **1,920 keys**, not English's 1,908.
They are the four in `vault`, two in `console` and six in `logs`.

Three things about those twelve that cost time:

- **Check English's `_other`, not English's bare key, before writing your singular.**
  Reference resolution for your `_one` falls back to `en:foo_other` and never reaches the
  bare key. `vault:retrySuccess` is the only token-asymmetric one: its bare key carries no
  token while `_other` carries `{{count}}`, so a correct Italian singular **must** carry
  `{{count}}` even though English's own singular does not. `vault:retryFailed` is the
  opposite — neither English form has a token, so no Italian form may add one.
- **Write the bare key count-neutral too.** Once all the categories exist it is
  unreachable, so its only remaining job is to be grammatical if something ever does reach
  it.
- **Two of the twelve are deliberately count-neutral in every category**, which is the one
  place this locale throws away a distinction English makes. `logs:translation.queued` and
  `logs:sourceReview.done` each display a non-`count` token while their family selects on
  `count`; the log-presentation registry happens to set both from the same value, but that
  guarantee lives in a different file from the string, so depending on it would let a later
  change there break the grammar silently with nothing failing. Do not "restore" the
  singular without re-reading `lib/log-presentation/registry.ts` and deciding to depend on
  it.

**Do not add a plural family over a plain English key.** The guard permits it and no shipped
locale does it; every count English writes as one string is handled with a count-neutral
device instead.

## The six sweeps

Run these over `packages/frontend/src/locales/it/` before calling a batch done. All six are
clean on the finished locale.

| Sweep | What it looks for | Italian instance |
| --- | --- | --- |
| The deferential pronoun this guide bans | `Lei`/`La` as a courtesy form mid-sentence | second-person plural or courtesy verb endings |
| Apostrophe-for-accent | a vowel followed by `'` where an accented character belongs | `e'`, `perche'`, `citta'` |
| Straight quotes where the guide sets typographic ones | `"` and `'` | must be `“`, `”` and the apostrophe `'` |
| Doubled spaces | two spaces in a row | — |
| Three-dot ellipses instead of the single character | `...` | must be `…` |
| Hyphens used as dashes | ` - ` between spaces | must be `—` |

Note that the apostrophe used **inside** a word (`dell'area`, `un'altra`) is the ordinary
straight apostrophe `'` and is correct — the third sweep is about quotation marks around a
value, not about elision, so read its hits before acting on them.

## Locale-specific traps

- **"Stage" is a false friend, and a bad one.** In Italian _uno stage_ is an internship.
  The Stage details tab is about a playable game level; never leave _stage_ untranslated and
  never use _fase_ or _tappa_, which are the process readings `terminology.md` warns about.
- **_Modello_ is taken by the AI model** (`config:routing.labelModelOverride`). It is also
  the obvious Italian word for _template_, so template takes “Schema” instead — recorded in
  `terminology/it.md`, and the reason the whole template family reads “Schemi di progetto”.
- **_Controllo_ is taken by the LQA check.** `settings:previewHint` therefore says
  “Elementi di esempio resi con il tema selezionato.” rather than reaching for the term.
- **_Libreria_, _supporto_ and _eventualmente_** are the classic calque traps if English
  prose creeps in; none of them means what the English cognate means.
- **_Judge_ takes the evaluative sense**, never _giudicare_ in the courtroom reading or the
  noun _giudice_.
- **Loanwords are invariable, and that is load-bearing.** _token_, _batch_, _byte_, _tag_,
  _backup_, _log_, _prompt_, _provider_ and _overflow_ take no Italian plural ending, which
  is what makes several count-neutral frames work at all. Never write _tokens_ or _batches_.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)" or "translation(s)". Do not imitate the parentheses;
  rephrase so one string covers every count.
