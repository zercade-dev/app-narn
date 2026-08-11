# Style guide — Turkish (tr)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/tr.md`. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**Siz — the `-in` / `-ın` / `-un` / `-ün` imperative.** `sidebar:selectProject` ("Select a
project") is "Bir proje seçin"; `vault:unlockDescription` is "Parolanızı girin…".

Two forms to avoid at both ends:

- The `-sana` / bare-stem singular ("seç", "gir") is too familiar for a professional tool.
- The `-iniz` / `-ınız` form ("seçiniz", "giriniz") is bureaucratic and dated; it is the
  register of government forms, not of the informal-but-professional English source.

Button labels take the same `-in` imperative where the English is a bare verb —
`sidebar:create` is "Oluştur"… with one exception worth knowing: short, isolated action
buttons conventionally take the bare stem in Turkish UI ("Kaydet", "Sil", "İptal"), while
sentences and instructions take `-in`. Follow that split; it is what Turkish users expect.

### Titles, buttons, column headers and placeholders — five shapes

English writes the same words for all of them; Turkish does not, so **resolve the control
before you translate the string.** Settled in batch 1 across the whole `config` namespace;
every later namespace follows it.

- **Titles, tab labels and section headings are noun phrases.** `config:importCsv` is
  "CSV içe aktarma", `config:routing.tabImportExport` is "İçe / dışa aktarma",
  `config:saveAsTemplateTitle` is "Proje şablonu". A dialog title takes the deverbal noun
  for the same reason: `config:models.pickTitle` is "Model seçimi".
- **A confirm-dialog title is the exception and takes the imperative** — it names the
  action you are about to authorize, not a section you are looking at.
  `config:confirmDeleteTitle` is "Projeyi sil". Keep English's question mark where it has
  one and leave it off where it does not; the source is inconsistent about this, and
  matching per key is what stops a reviewer "fixing" one of them.
- **Buttons are the bare stem** where the English is a bare verb: `config:delete` is
  "Sil", `config:routing.importBtn` and `exportBtn` are "İçe aktar" and "Dışa aktar",
  `config:saveAsTemplate` is "Şablon olarak kaydet".
- **Table column headers are bare nouns, and they keep English's abbreviation** where it
  has one: `config:models.colParameters` ("Params") is "Param.",
  `config:models.colQuantization` ("Quant") is "Kuant.". A header is chrome, and the
  length budget bites hardest here.
- **Placeholders inside a control are imperatives**, not titles.
  `config:models.select` and `config:models.pickTitle` are byte-identical in English
  ("Select a model") and are two different controls: "Bir model seçin" for the
  placeholder, "Model seçimi" for the dialog title. That pair is the one licensed
  same-English/different-rendering collision in `config`.

A `-yor` progressive ("İçe aktarılıyor…", "Ölçülüyor…") is a **status**, not a command:
use it for progress text and never for a button.

**A title that is a sentence in English stays a sentence.** The noun-phrase rule covers
titles that *name* something. `config:importWarningsTitle` ("Review before importing") is
an instruction, and ships as one: "İçe aktarmadan önce gözden geçirin".

**A term row fixes the lexeme, not the shape.** Take the *word* from `terminology/tr.md`
and the *form* from the control. An `Example:` line in a term row is an illustration, not
a ruling that the cited key keeps that grammatical form.

## Casing

Sentence case for every control, label, tab and page title. Turkish does not capitalize
every word of a heading, so `config:routing.title` ("Routing Rules") becomes "Yönlendirme
kuralları". `english-review-notes.md` records that English Title Case on page titles is a
per-surface design convention with no meaning outside English.

Language names and nationalities **are** capitalized in Turkish ("Türkçe", "İngilizce") —
unlike the Romance and Slavic locales. Months are capitalized too ("Ocak").

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "DURUM". Preserve deliberate **lowercase** the same way — the cell
chips are lowercase by design, and so are the inline routing fragments
(`config:routing.anySource` "herhangi bir kaynak", `config:routing.promptBadge` "istem",
`config:reviewProgressInactive` "etkin değil").

**The dotted/dotless I is a real hazard when uppercasing.** In Turkish, uppercase of `i`
is `İ` (not `I`), and uppercase of `ı` is `I`. Any label you write in uppercase must use
the Turkish mapping by hand — "İçerik", not "Icerik"; "İŞLEM", not "ISLEM". Do not rely on
a generic uppercase transformation.

**And it is a hazard in the other direction too, in tooling rather than in the UI.**
JavaScript's `toLowerCase()` is locale-invariant: `"İstem".toLowerCase()` is `i` plus a
combining dot (U+0307), not `i`. The lexicon citation guard
(`scripts/check-lexicon-citations.mjs`) lowercases both sides before comparing, so a
rendering you cite in `terminology/tr.md` is only attested against corpus occurrences that
are **already lowercase** if the word starts with `İ`. When you cite such a word, make sure
some shipped string carries it lowercase — batch 1's "istem" is attested through
`config:routing.promptBadge`, not through `config:labelPromptOptions`.

**One do-not-translate collision to know about.** The guard's term check counts `API`, and
Turkish "KAPI" contains it. The check now matches on token boundaries so "KAPI" no longer
registers, but the near-miss is real: it is one of two reasons *quality gate* is "kalite
geçidi" and never "kalite kapısı".

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”`, matching the English source after its review —
  `config:duplicateSuccess` ships `“{{name}}” projesi çoğaltıldı.` The **placeholder is
  untouched; the two characters around it are ours.**
- Ellipsis is the single character `…` (U+2026), matching `common:saving` ("Saving…") —
  "Kaydediliyor…".
- Turkish attaches case suffixes to proper nouns with an apostrophe ("NARN'ı", "API'sini",
  "VRAM'i"). Use the plain ASCII `'` for it, not `’` — that is Turkish practice, and the
  straight-quote sweep below is about quotes **around a value**, not about this apostrophe.
  Do this only on literal names you can see; see the placeholder rules for why never on a
  token.
- Em dashes in the source stay em dashes with spaces around them. Never a hyphen.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. `config:overflowRatioDescription` ships
"Varsayılan: 1,75." for English's "1.75".

No space before `%`, and Turkish writes the sign **before** the number ("%50") — follow
that where the number is literal, including where the English writes it after:
`config:health.successRate` ("Success {{rate}}%") ships "Başarı %{{rate}}", and
`config:models.gpuPlacement` ("{{pct}}% GPU") ships "GPU %{{pct}}".

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string. `{{time}}` is an `Intl.RelativeTimeFormat` output ("3 dk. önce"),
which is why `config:models.updated` can read "{{time}} güncellendi" in natural Turkish
word order.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

### Vowel harmony over an interpolated value — the rule

**Never attach a suffix directly to a token.** A Turkish suffix agrees with the final vowel
of the word it attaches to (and often takes a buffer consonant chosen by the final sound).
A `{{token}}` renders a value that is unknown until runtime, so any suffix written against
it is a coin flip — right for the values that happen to harmonize and wrong for the rest.
There is no i18next mechanism that could choose the allomorph, and nothing in the gate can
see the defect: it ships, and it is wrong for most values.

Three devices, in order of preference:

1. **Appositive — put a real noun after the token and suffix that instead.** The token
   stays bare in the nominative and the head noun carries every suffix the sentence needs.
   Shipped: `config:enableModuleAddInstance` is "Başka bir {{name}} örneği ekle…" and
   `config:models.useCustom` is "“{{model}}” modelini özel model olarak kullan" — "örneği"
   and "modelini" harmonize with "örnek" and "model", never with the interpolated value.
   **This device is only available for tokens the pre-flight detector skips — see the token
   table below.**
2. **Restructure so the token lands at the end of a clause, behind a colon, or inside
   brackets.** This is the count-neutral device the runbook prefers for numeric tokens, and
   in this locale it is also the fallback whenever device 1 is unavailable.
3. **Invariant postposition.** Turkish postpositions — "için", "ile", "gibi", "kadar" —
   do not harmonize, so "{{name}} için" is safe where a case suffix would not be. Use it
   sparingly: the detector still flags it, because it cannot tell a postposition from a
   counted noun until someone clears the word axis for `tr`.

**The apostrophe form is not device 4.** Turkish writes a case suffix on a proper noun with
an apostrophe — "NARN'ı", "API'sini" — and it is tempting to reach for `{{model}}'i`. It
does not help: the apostrophe separates the suffix, it does not choose it. You would still
be picking one of `-i / -ı / -u / -ü` for a value you cannot see. The apostrophe is for
literal names **you can read in the string**, never for a token.

#### Worked example — `config:instances.formTitle` ("New instance of {{base}}")

- **Wrong:** "{{base}}'in yeni örneği". The genitive is `-in / -ın / -un / -ün` plus a
  buffer `n` after a vowel. `openai` wants "openai'nin", `deepl` wants "deepl'in", `gpt-4`
  wants "gpt-4'ün". One string cannot be right for all three, and two of the three are
  wrong however you write it.
- **Device 1 would give** "Yeni {{base}} örneği" — correct Turkish, suffix-safe, and the
  form a Turkish reader expects.
- **Shipped: "Yeni örnek ({{base}})"** — device 2, because `base` is **not** on the
  pre-flight's token skiplist and `tr` has no calibrated word-axis exemption list, so
  device 1 would leave an uncleared survivor in `node scripts/i18n-preflight.mjs tr`. Its
  sibling `config:instances.instanceOf` ("instance of {{base}}") ships the same shape,
  "örnek ({{base}})", so the two badges agree.

That interaction is the whole reason this section exists: **the grammatically best Turkish
device and the detector's clean run do not always coincide, and which one you may use is
decided by the token's name, not by the sentence.**

### Which tokens each device is available for

The pre-flight's token axis skips 23 placeholders that cannot hold a number
(`NUMERAL_TOKEN_SKIPLIST` in `scripts/i18n-preflight.mjs`):

> `count` · `module` · `instance` · `language` · `languages` · `lang` · `name` · `message` ·
> `date` · `verdict` · `headers` · `model` · `keys` · `slug` · `type` · `focus` · `field` ·
> `why` · `label` · `filename` · `id` · `time` · `passRate`

- **Token on that list → device 1 is available.** Write the natural Turkish appositive.
- **Any other token → use device 2.** `tr` has no `NUMERAL_WORD_AXIS_EXEMPTIONS` entry, so
  *every* surviving occurrence is reported as an uncleared candidate and the pre-flight
  exits non-zero. In `config` that meant restructuring nine strings; the tokens involved
  were `base`, `columns`, `reviewed`, `total`, `maxLength`, `rules`, `chars`, `bytes`,
  `entryCount`, `reliable`, `tokens`, `context`, `pct` and `done`.

Worked shapes for device 2, all shipped in `config`:

| Key | English | Turkish |
| --- | --- | --- |
| `config:reviewProgressCount` | `{{reviewed}} / {{total}} reviewed` | `İncelenen: {{reviewed}} / {{total}}` |
| `config:lqa.lengthLimitValue` | `{{chars}} chars / {{bytes}} bytes` | `karakter: {{chars}} / bayt: {{bytes}}` |
| `config:templateMeta` | `{{languages}} languages · {{rules}} routing rules` | `dil: {{languages}} · yönlendirme kuralı: {{rules}}` |
| `config:routing.templateMeta` | `max {{maxLength}} chars` | `uzunluk sınırı: {{maxLength}}` |
| `config:models.confidenceReason.prompt-near-context` | `(~{{tokens}} tokens)` | `(token: ~{{tokens}})` |
| `config:models.confidenceReason.batch-exceeds-reliable` | `{{entryCount}} entries exceed the ~{{reliable}}` | `Girdi sayısı ({{entryCount}}), … sınırı (~{{reliable}}) aşıyor` |

**If a later batch needs device 1 for a non-skiplisted token, do not just write it and
leave the pre-flight red.** Raise it: the fix is a calibrated `tr` entry in
`NUMERAL_WORD_AXIS_EXEMPTIONS`, derived only from post-token-axis survivors, and that file
belongs to whoever runs the wave — not to a translator.

### Counted nouns stay singular

After a numeral, Turkish does not mark the plural: `config:routing.ruleCount_other`
("{{count}} rules") is "{{count}} kural", with no `-lar`. **That means `_one` and `_other`
are usually byte-identical, which is correct and not a copy-paste error** — four families
in `config` ship that way and the pre-flight reports them as same-rendering collisions,
all licensed for this one reason.

Where the two categories *can* legitimately differ, make them differ: a demonstrative plus
a noun carries no numeral, so `config:exportRoundtripWarning_one` ends "o hücreyi düzeltin"
against `_other`'s "o hücreleri düzeltin".

### Plural categories

`Intl.PluralRules('tr')` gives **`one` and `other`** — exactly English's set. So:

- Turkish ships **the same key count as English**, 1,908. No `_few`, no `_many`, no extra
  and no missing category.
- Copy English's plural shape as-is, then apply the singular-after-numeral rule to the
  wording.
- `_zero` remains legal in every locale and English already ships one
  (`strings:bulk.removeCategoryApply_zero`); keep it. Never add a `_plural` suffix — it
  never resolves.
- The twelve `bare + _other` families (listed in the runbook) all live in `console`, `logs`
  and `vault`, none in `config`. Read the runbook's section 2.3 before writing them: your
  `_one` is checked against English's `_other`, so it must carry `{{count}}` even where
  English's own singular does not.

## Length discipline

Turkish is **about the same length as English or slightly longer**, because agglutination
packs prepositions and possessives into suffixes. Measured over the 374 shipped `config`
keys: aggregate **1.10**, median **1.07**, 90th percentile **1.43**, longest single ratio
1.92 (`config:deselectAll`). Re-measure over the whole language at the final sweep, and
state the population with the figure. The catch is distribution, not the aggregate: fewer,
much longer single tokens ("değerlendirilemedi", "yapılandırmalarınızı"), which clip rather
than wrap, and a tail that is what breaks chrome.

**Budgets are absolute character counts, per class — never a multiple of English.** A ratio
is the wrong unit when the English source is short: "Legal" is five characters, and no
correct Turkish rendering of it can fit 1.5×. The five classes are also not equally
constrained — only the sidebar has a fixed width.

| Class | Anchor key | Budget | Kind |
| --- | --- | --- | --- |
| Sidebar item | `sidebar:globalConfig`, `sidebar:legal` | **26** | **hard** — fixed `16rem` (`SIDEBAR_WIDTH`), `truncate` |
| Tab label | `strings:tabs.backup` | 32 (provisional) | soft |
| Table column header | `strings:columns.config` | 22 (provisional) | soft |
| Filter label | `strings:filters.needsReview` | 38 (provisional) | soft |
| Bulk-bar control | `strings:bulk.approveSelected` | 52 (provisional) | soft |

The sidebar number is derived from the container, which is the same container for every
locale. **The four soft ones are provisional and marked so on purpose:** none of those
classes lives in `config`, so batch 1 had nothing to measure. **Batch 2 owns all four**
(`strings` holds the tabs, columns, filters and bulk bar) — set them there from the longest
value Turkish actually ships plus headroom, and the whole-language sweep replaces them with
measured figures either way.

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, but do not distort a term to
hit a number. **Terms outrank the budget**, which exists only to stop *avoidable* length.

The guard's own length check is a separate, cruder thing: a 2.5× ratio cap
(`MAX_LENGTH_RATIO` in `scripts/locale-rules.mjs`) on English sources of 12 characters or
more. Nothing in `config` comes close — the longest Turkish/English ratio in the namespace
is well under 2×. If a correct rendering ever breaches it, escalate for a per-key
`LENGTH_EXEMPTIONS` entry rather than distorting the wording.

## Surface names settled in batch 1 — repeat these verbatim

A surface is named in one namespace and owned by another, so these are written by different
translators at different times. `config` names five surfaces it does not own. They are
settled; copy them, do not re-render them.

| Surface | Turkish | Owning key | Repeated at |
| --- | --- | --- | --- |
| Global Config | Genel yapılandırma | `sidebar:globalConfig` | `config:globalConfigTitle` — **word-for-word identical in English, and must stay so** |
| Compare | Karşılaştırma | `strings:tabs.compare` | `config:routing.tonesHint` |
| Translations | Çeviriler | `strings:tabs.strings` | `config:routing.categoriesConfiguredHint` |
| Backup | Yedekleme | `strings:tabs.backup` | `config:importSnapshotNote` |
| Orphans | Yetimler | `orphans:title` | `config:fullReplaceOrphanNotice` |

Two notes on that table:

- **Backup: the tab is "Yedekleme", a countable backup is "yedek".** `config:maxBackupsLabel`
  is "Proje başına en fazla yedek" — the object — while the surface that lists and restores
  them is the process noun. Do not swap them.
- **Orphans: `config:fullReplaceOrphanNotice` calls it the "Relink tab" in English.** There
  is no such tab; `english-review-notes.md` records it as stale copy. It ships as "Yetimler
  sekmesi".

Turkish declines the surface name in prose, which is expected: "Yedekleme sekmesinden",
"Çeviriler sekmesinde". The **stem** is what must match, not the letters. Keep the surface
name unquoted, as English does.

## Matching a sibling namespace — match the English, not another locale's file

When the surface-name rule sends you to a sibling key, read the sibling's **English**.
Copying another locale's rendering imports whatever *that* key's English says, including
words your own key's English does not have. The standing example:
`config:lqa.checks.tag-equality.name` is "**Inline** tag equality" and ships as "Satır içi
etiket eşitliği", while `quality:checkLabels.tag-equality` is the bare "Tag equality" and
must ship as "Etiket eşitliği" — same term, each faithful to its own key.

## Register and typography sweeps

Run all seven before handing a batch to review. The first six are the standard set; the
seventh is Turkish-specific and is the one that catches this locale's signature defect.

| Sweep | Turkish instance | Command shape |
| --- | --- | --- |
| Over-formal imperative the guide bans | `-iniz` / `-ınız` endings | `grep -nE '(iniz\|ınız\|unuz\|ünüz)\b'` — **eyeball every hit**: the same ending spells the ordinary 2nd-person possessive and ability forms ("oyununuzdaki", "edebilirsiniz", "seçtiğiniz"), which are correct. Only a bare verb stem plus the ending ("seçiniz", "giriniz") is the defect; `config` has 10 hits and 0 defects |
| Bare-stem singular where a sentence needs `-in` | "seç", "gir" mid-sentence | read the imperatives |
| Straight quotes where the guide sets typographic ones | `"` and `'` around a value | `grep -n '\\"'` |
| Doubled spaces | — | `grep -nE '  '` |
| Three-dot ellipsis instead of the single character | `...` for `…` | `grep -n '\.\.\.'` |
| Hyphen used as a dash | ` - ` for ` — ` | `grep -nE ' - '` |
| **Suffix attached to a placeholder** | `{{model}}'i`, `{{count}}ı` | `grep -nE "\}\}['’]?[a-zçğıöşüA-ZÇĞİÖŞÜ]"` |

**The seventh sweep is not redundant with the pre-flight, and this is the part to
understand.** The pre-flight's narrow rule requires **whitespace** between `}}` and the
following word, so it cannot see `{{model}}'i` at all — the exact construction this
locale's placeholder rule forbids. The loose rule does match it, but the loose rule is
printed for information and never gates the exit code. So a Turkish suffix-on-token defect
passes `node scripts/i18n-preflight.mjs tr` cleanly. **Nothing but this grep catches it.**

Conversely, most of what the narrow rule *does* flag for Turkish is not a numeral-agreement
defect in the first place: a Turkish noun after a numeral never inflects for number, so
"{{total}} girdi" would be correct at every count. Batch 1 restructured those strings
anyway, because the detector gates the batch and the count-neutral device is the runbook's
own first preference — but a reviewer should know the two checks are aimed at different
things in this language.

## Locale-specific traps

- **Agglutination means the domain term appears inflected everywhere.** "proje" shows up as
  "projeyi", "projeden", "projenin". That is expected and correct; `terminology/tr.md` records
  the bare citation form, and consistency means the same stem, not the same letters.
- **Vowel harmony applies to your own coinages too** — a suffix chosen for its written look
  rather than by harmony is immediately wrong to a reader.
- **"Judge"** takes the evaluative sense ("değerlendirme"), never "yargıç"/"hâkim", the
  courtroom reading.
- **"Stage" is a game level**, not a phase: "aşama" and "evre" are exactly the process
  readings `terminology.md` warns about.
- **AI is "yapay zekâ"**, with the circumflex, everywhere — `config` ships it four times.
  Do not alternate with "yapay zeka" or the abbreviation "YZ".
- **"Confirm" may not be "Onayla".** *Approve* is the lexicon term and takes "onayla", so a
  confirm button takes the explicit two-step Turkish form instead: "Evet, sil"
  (`config:instances.deleteConfirm`), "Evet, tümünü temizle" (`config:tm.clearAllConfirm`),
  "Eminim" (`config:routing.removeConfirm`). Cancel stays "İptal".
- **The LQA check descriptions' English "Flags …" is not the *flag* term.** It means
  "reports", and ships as "bildirir" throughout `config:lqa.checks.*`. The review-queue
  disposition verb is therefore still free for the batch that meets it.
- **"Success rate" is not "pass rate".** `config:health.successRate` (provider request
  success) ships as "Başarı"; the Quality dashboard's *pass rate* is a different metric and
  needs a different word.
- **"İstem" (prompt) and "istek" (request) differ by one letter** and appear in the same
  settings panel. Read the English before you type either.
- **"Context" is three different things in English.** The model's context window is "bağlam
  penceresi" (`config:models.confidenceReason.prompt-near-context`); the CSV column is the
  translator's own note (`config:includeContext`, "Bağlam sütununu dahil et"); the entry
  metadata bundle is a third. They share the head "bağlam" and are separated by their
  qualifiers, which is licensed — a shared root is not a collision when the heads differ.
  What is banned is rendering *translator context* as bare "bağlam".
- **Loanword or Turkish coinage — pick once.** "modül" vs "birim", "şablon" vs "kalıp",
  "önbellek" vs "cache". All are attested; alternating inside one namespace is the defect.
  Settled and closed by batch 1: module is "modül", template is "şablon", cache is
  "önbellek", token is "token", prompt is "istem", batch is "yığın".
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Turkish needs no parenthetical at all — the singular
  noun after the number already covers every count.
