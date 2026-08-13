# Style guide — Indonesian (id)

This locale is **Indonesian**, not Malaysian Malay. The two are close enough that a
Malaysian word slips through unnoticed by a non-native reviewer and jars every native one —
the traps section lists the ones that actually occur in software.

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/id.md`. This file settles register, control shape, casing,
punctuation, length and placeholder handling.

## Register

**Anda, capitalized, and used sparingly.** Indonesian UI convention is to drop the pronoun
altogether wherever the sentence still works: `sidebar:selectProject` ("Select a project")
is “Pilih proyek”, not the same with Anda appended. Reserve Anda for sentences that
genuinely need to distinguish the user's things from someone else's —
`vault:unlockDescription` is “Masukkan kata sandi Anda untuk mendekripsi kredensial modul
pada sesi ini.”

Never _kamu_ (too familiar for a professional tool) and never _Saudara_ (dated and formal).

## Control shapes — resolve the control before you translate the string

English writes the same words for a title, a button, a column header and a placeholder.
Indonesian does not, because it marks the difference morphologically: the bare verb stem is
a command, `pe-…-an` is the deverbal noun, `me-…` is the progressive and `di-…` is the
participle. Choosing between them is the single most frequent decision in this locale, so
it is settled once here.

| Control | Shape | Worked example |
| --- | --- | --- |
| Button, menu item | bare verb stem | `backup:createButton` is “Buat cadangan” |
| Dialog title that **authorizes an action** | bare verb stem, matching its button | `config:confirmDeleteTitle` is “Hapus proyek” |
| Dialog title that **presents a thing** | deverbal noun phrase | `config:models.pickTitle` is “Pemilihan model” |
| Section heading, page title | deverbal noun phrase | `backup:createSection` is “Pembuatan cadangan” |
| Placeholder inside a control | bare verb stem (imperative) | `config:models.select` is “Pilih model” |
| Table column header | bare noun, keeping English's abbreviation | `strings:runs.runIdColumn` is “ID putaran” |
| Progress / status text | progressive `me-` or participle `di-` | `config:importing` is “Mengimpor…”, `config:autoSaveSaved` is “Tersimpan” |

**The section-heading row is the one that costs a round if you get it wrong**, and it is
recorded in the runbook as a defect another locale shipped: `backup:createSection` and
`backup:createButton` are byte-identical in English, and rendering both as the bare verb
puts a command where its two sibling headings — `backup:backupsListSection` and
`backup:restoreSection` — are noun phrases. All three are noun phrases here, and the button
below the first one is the verb. Two renderings of one English string is correct; a heading
that does not match its siblings is not.

**A verbal noun is a status, never a command.** `strings:row.translating` is “Menerjemahkan”
because it narrates; the button that starts the same work is `strings:compare.translate`,
“Terjemahkan…”.

**Score the paradigm, not the option.** Where a setting has a list of values, translate the
whole list together: `config:batchGroupingCategory` and its four siblings are all
lowercase `per …` fragments, because they are rendered inline after a label, not as
sentences.

## Casing

Sentence case for controls, labels, hints, messages and section headings.

**Title Case for product surface names only** — the tabs, pages and tools named in
`terminology.md`'s surface-name table, plus the sidebar items. Indonesian marks proper
names by capitalization and these are names rather than descriptions, so
`sidebar:globalConfig` is “Konfigurasi Global” while the ordinary section heading
`config:workspaceSettingsTitle` is “Pengaturan ruang kerja”. The rule is worth stating as a
boundary because English's own Title Case is a per-surface design convention that
`english-review-notes.md` says carries no meaning outside English: do not import it
wholesale, and do not drop it from the surface names either.

Language names, months and days **are** capitalized in Indonesian (Bahasa Indonesia,
Januari, Senin) — unlike the Romance locales.

Preserve uppercase where English uses it for layout: `strings:columns.config` is “STATUS”.
Preserve lowercase for the same reason: the three cell chips
`strings:compare.cellTranslatedBadge`, `cellReviewedBadge` and `cellNeedsReviewBadge` ship
as “diterjemahkan”, “ditinjau” and “perlu ditinjau”, lowercase by design, while the filter
label with the same wording, `strings:filters.needsReview`, is sentence case.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”`. This is the delimiter throughout, including where the English
  source uses escaped straight quotes — `config:duplicateSuccess` is “Proyek “{{name}}”
  diduplikatkan.”
- Ellipsis is the single character `…` (U+2026), never three dots.
- Em dashes in the source stay em dashes with spaces around them.
- Reduplication is hyphenated and unspaced: kata-kata, masing-masing. Never with a digit.
- Prefixes attach without a space (menerjemahkan); *di* and *ke* are separate when locative
  (di tab Aktivitas) and attached when passive (diterjemahkan). This is the single most
  common Indonesian spelling error in UI copy and it has its own sweep below.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. `config:overflowRatioDescription` therefore
ships the default overflow ratio as 1,75, not 1.75. No space before `%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length budgets — absolute characters, per class

**Never a multiple of English.** An earlier version of this file set a 1.6× ceiling; the
runbook forbids ratio budgets by name (section 2.4, "Length budgets are absolute character
counts, per class"), because an audit found 27 correct strings over the pilot's ratio
ceiling, including a sidebar item at 3.80×. A ratio measures how long the *English* is
rather than how wide the *control* is: `sidebar:legal` is five characters, so no ratio
gives a correct Indonesian rendering any room at all.

The correction is left visible rather than deleted, per the runbook's rule that a repaired
reason should not be indistinguishable from one that was always sound.

The six classes, with the numbers derived for this locale and how:

| Class | Budget | Kind | Longest shipped |
| --- | --- | --- | --- |
| Sidebar item | 26 | **hard** | 18 (`sidebar:globalConfig`) |
| Tab label | 26 | **hard** | 22 (`strings:tabs` for review-translation-ai) |
| In-panel sub-tab | 22 | soft | 19 (`config:routing.tabTemplates`) |
| Table column header | 16 | soft | 14 (`strings:runs.manualEditedByColumn`) |
| Filter label | 44 | soft | 39 (`strings:filters.untranslatedOnly`) |
| Bulk-bar control | 44 | soft | 39 (`strings:bulk.selectAllFiltered`) |

**Where the two hard numbers come from.** The sidebar is a fixed `16rem` = 256px
(`SIDEBAR_WIDTH` in `components/ui/sidebar.tsx`) and every label in it is wrapped in
`truncate`, so overflow ellipsizes rather than wrapping. One border, 16px of group padding,
16px of button padding, a 16px icon and an 8px gap come off it, leaving about 199px of
usable label width — roughly 26 characters of Latin lowercase at this app's body size.
**The tab labels share that number because they are the same container**: `strings:tabs.*`
is not a tab bar at all, it renders at `components/layout/Sidebar.tsx:785` and `:788` as a
`truncate` span inside a `SidebarMenuButton`. There is no horizontal tab bar in this
frontend.

**The four soft numbers are the longest value this locale ships plus about 15% headroom**,
re-derived over the finished language rather than over one batch. Soft means prefer the
shorter of two correct options; it is not a failure threshold, and nothing should be
distorted to hit it.

Reproduce any of these by measuring the class across the shipped files rather than trusting
the table — a key added or removed moves a row.

## Measured expansion

Over the 1,879 keys `id` ships, each measured against the English key it resolves to
(`_other` against English's `_other`, then the bare key):

| Aggregate | Median | 90th percentile | 99th percentile |
| --- | --- | --- | --- |
| 1.12 | 1.09 | 1.48 | 2.25 |

Indonesian is the shortest locale measured so far — below ru's 1.19, es's 1.22 and fr's
1.26 — and its tail is markedly flatter: 1.48 at the 90th percentile against 1.6–1.7 for
all three. Affixation lengthens individual words (atur becomes pengaturan) but the language
gives it back elsewhere: no articles, no gender, no case endings, no plural marking, and
several very short high-frequency verbs. **Do not read the comfortable aggregate as licence
to be long in chrome** — the p99 of 2.25 is where the sidebar lives.

State the population whenever you quote these: 1,879 keys is the whole `id` corpus, which
is 29 fewer than English's 1,908 because Indonesian supplies no `_one` forms. There is no
second population for this locale — unlike Russian, `id` adds no plural forms English lacks,
so the shared-key figure and the full-locale figure are the same number.

## Placeholders and plurals

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once, and the guard
compares the multiset.

Indonesian is comfortable here: nouns do not inflect, there are no articles and no gender,
so a token can sit almost anywhere. `logs:translation.failedModuleDisabled` closes with
“modul {{module}} sedang nonaktif.”

**No plural marking after a numeral.** `category:countLabel_other` is “{{count}} entri”.
Reduplication is the only plural device Indonesian has and it is *ungrammatical* after a
numeral, so there is no alternative form to choose between — which is why this locale is
listed in `NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES` in `scripts/i18n-preflight.mjs` rather
than carrying a word-exemption list. Verbs, participles and adjectives carry no number
agreement either, so `batch:runCompletedWithErrors` can put “berhasil” straight after a
token.

**Indonesian has exactly one plural category: `other`.** Verify rather than trust:
`new Intl.PluralRules('id').resolvedOptions().pluralCategories` returns `['other']`, and no
integer selects anything else. A plural family therefore supplies `_other` and nothing
else — never a `_one` copied across from English. A `_one` key can never resolve here, and
`pluralFamilyErrors()` rejects any suffix that is not a plural category of the language, so
copying English's pair is a red build rather than a harmless duplicate. `_zero` is the one
exception the tooling always allows, and English ships one
(`strings:bulk.removeCategoryApply_zero`), so this locale ships one too.

**The twelve `bare + _other` families still get both keys**, because key parity is by key
and English has both. In a number-invariant language the two forms genuinely coincide and
that is correct, not lazy — `vault:keysCount` and its `_other` are the same string. The two
exceptions are token-driven, not meaning-driven: `vault:retrySuccess`'s bare key carries no
`{{count}}` and its `_other` does, so those two must differ; `vault:retryFailed` carries no
token in either form, so neither may add a number.

**The classifier is the hazard no script can check.** Indonesian has measure words — buah,
orang, lembar — and choosing one is a lexical decision per counted object, exactly like a
Japanese counter. **This locale omits them throughout.** They are optional in modern
Indonesian UI copy, every counted object in this app is an abstract one (entri, istilah,
putaran, kunci), and a half-classified corpus reads worse than an unclassified one. If a
future string genuinely needs one, it is a decision for the whole locale at once.

**Only `count` triggers plural selection**, so every other numeric token needs a frame that
is true at any value. Indonesian's grammar makes this nearly free, but two English defects
still force a rewrite rather than a literal rendering, both recorded in
`english-review-notes.md`: `strings:runs.stringsProgress` counts jobs while naming entries,
so it ships as “Selesai: {{completed}} dari {{total}}” with no head noun; and
`logs:translation.queued` counts jobs too, so it ships as “Diantrekan untuk diterjemahkan:
{{total}}.” — the invariant-phrase-then-colon device, which names nothing counted.
`config:templateMeta` reads "1 languages" in English and must not be mirrored; here the
noun is simply invariant, so “{{languages}} bahasa · {{rules}} aturan penyaluran” is correct
at every value.

## Surface names — repeat these verbatim

Every key naming one of these gets the same rendering, and prose mentioning the surface
repeats it exactly. Settled in batch 2 (`strings`) and inherited by every later batch.

| Surface | Rendering | Also written at |
| --- | --- | --- |
| Translations | Terjemahan | `strings:guide.topicMultiLanguage` (with Tab), `config:routing.categoriesConfiguredHint` |
| Compare | Bandingkan | `strings:guide.topicCompare`, `config:routing.tonesHint` |
| Activity | Aktivitas | `strings:guide.topicActivity`; the page title expands to “Aktivitas Terjemahan” |
| Quality | Kualitas | `strings:guide.topicQuality`; the dashboard title expands to “Dasbor Kualitas” |
| Glossary | Glosarium | `strings:guide.topicGlossary` |
| Category | Kategori | `strings:guide.topicCategory`, `category:title` |
| Orphans | Entri Yatim | `orphans:title`, `strings:guide.topicOrphans` |
| Backup | Cadangan | `strings:guide.topicBackup`, `config:importSnapshotNote`; the page title expands to “Cadangan dan Pemulihan” |
| Sharing | Berbagi | `collab:sharing.pageTitle` |
| Stage details | Detail Stage | `stage-details:title` |
| Text Styler | Penata Teks | `colorText:title`, `sidebar:colorText` |
| Source AI review | Tinjauan AI Sumber | `review:sourceAi.configTitle` |
| Translation AI review | Tinjauan AI Terjemahan | `review:translationAi.title` |
| Global Config | Konfigurasi Global | `config:globalConfigTitle`; word-for-word identical to the sidebar item, deliberately |
| Translation Memory | Memori Terjemahan | `config:tm.policyTitle`, `config:tm.browserTitle` |
| Legal | Legal | the page title expands to “Legal & kebijakan” |

**The five sidebar group headings and their guide twins are byte-identical**, because
English writes them identically and they render one inside the other: “Persiapan”,
“Terjemahkan”, “Peninjauan”, “Terminologi”, “Pemeliharaan” at `sidebar:groups.project` and
its four siblings, and again at `strings:guide.groupSetup` and its four. **Terjemahkan is
deliberately not Terjemahan** — the group heading is the verb and the tab nested under it
is the noun, which is the distinction every other shipped locale also keeps. A sixth guide
heading, `strings:guide.groupTranslationMemory`, sits over an identically named child on
purpose and is left identical here too.

## Locale-specific traps

- **Indonesian, not Malaysian.** Use *hapus* (not _padam_), *unggah* (not _muat naik_),
  *unduh* (not _muat turun_), *kata sandi* (not _kata laluan_), *berkas* (not _fail_),
  *tombol* (not _kekunci_), *pratinjau* (not _pratonton_), *peramban* (not _pelayar_).
- **Loanword or coinage — decided per term and recorded.** Indonesian tech vocabulary is
  genuinely split. The settled split in this locale: **loans for domain nouns** the
  practitioners actually say (proyek, modul, glosarium, templat, batch, prompt, log,
  snapshot, placeholder, stage, instans, kredensial, asersi, isu), **Indonesian for
  everyday verbs and for anything a non-specialist reads** (simpan, hapus, batal, buang,
  tolak, sisihkan, kembalikan, urungkan, pulihkan, cabut, kecualikan). *berkas* is used for
  file rather than the English loan, consistently. Alternating inside one namespace is the
  defect, not the choice itself.
- **Stage is a game level.** Kept in English; *tahap* and *tahapan* are exactly the process
  reading `terminology.md` warns about.
- **Judge takes the evaluative sense** — `review:translationAi.description` uses *menilai*,
  never the legal verb.
- **Formal written Indonesian, not Jakarta colloquial.** *tidak*, not _nggak_; *hanya*, not
  _cuma_; *membuat*, not _bikin_.
- **Count-neutral phrasing needs no parenthetical.** `english-review-notes.md` lists keys
  where English writes "entr(ies)" and "translation(s)" because they have no plural forms.
  Indonesian needs nothing at all — the unmarked noun already covers every count, so
  `review:allItemsCount` is simply “{{count}} terjemahan”.
- **Do not abbreviate the pager.** `strings:pagination.prev` is "Prev" in English and ships
  here as “Sebelumnya”, the same word as its three unabbreviated siblings.
  `english-review-notes.md` item 7 records that this key is *not* space-constrained — the
  claim that it was is a retracted error — and directs each locale to its own usual pager
  wording. Indonesian has no shorter idiomatic form, so the four coincide; that is the
  language, not an alignment.

## The six sweeps

Run these over the shipped values (not the raw JSON — the file's own indentation and key
names produce false positives on two of them). All six were clean on the finished locale.

| Sweep | Pattern |
| --- | --- |
| the familiar pronouns this guide bans | `kamu`, `Saudara` |
| Malaysian lexis | `padam`, `muat naik`, `muat turun`, `kata laluan`, `fail`, `kekunci`, `pratonton`, `pelayar` |
| Jakarta colloquial | `nggak`, `cuma`, `bikin`, `gak`, `udah` |
| straight quotes or apostrophes where this guide sets curly | `"` and `'` |
| doubled spaces inside a value | `\S  +\S` |
| three-dot ellipses, and hyphens used as dashes | `...` and ` - ` |

Two more are worth keeping because they catch Indonesian-specific errors nothing else does:
a separable `di`/`ke` written apart from a passive verb (`di terjemahkan`), and digit
reduplication (`kata2`). The second one has exactly one licensed hit,
`config:lqa.forbiddenPlaceholder`, whose English is a pair of numbered example terms rather
than a reduplication — exclude it rather than widening the pattern.
