# Style guide — Turkish (tr)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/tr.md`. This file settles register, casing, punctuation, length and
placeholder handling.

> **How to read a quoted rendering in this file — it is one of two things, and nothing
> guards the difference.** `scripts/check-lexicon-citations.mjs` checks
> `terminology/tr.md` and **does not read style guides**, so every quotation below is
> maintained by hand and can go stale silently.
>
> - A quotation attached to a **`config:` or `strings:` key is a citation**: that string is
>   shipped, and it is checkable today. The `config:` ones were verified against
>   `packages/frontend/src/locales/tr/config.json` at the end of batch 1; the `strings:`
>   ones against `.../tr/strings.json` at the end of batch 2.
> - A quotation attached to a key in **any other namespace is a prescription**, binding on
>   the batch that owns that namespace — `sidebar:*` and `vault:*` in batch 4,
>   `quality:*` in batch 3, `orphans:*` and `colorText:*` in batch 6. It describes what
>   that key **must** ship, not what it does ship.
> - A quotation attached to **no key at all** is an illustration: a rejected candidate, a
>   wrong form shown as wrong, or a convention example. Never copy one as a rendering.
>
> When you ship a prescription, come back and leave it as a citation. When you change a
> `config` string, re-run the audit — grep this file's quoted spans against the shipped
> JSON — because nothing else will.

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
  for the same reason: `config:models.pickTitle` is "Model seçimi", and
  `strings:achievement.dialogTitle` ("Link achievement") is "Başarım bağlama" while its own
  button `strings:achievement.linkButton` ("Link…") is the bare stem "Bağla…" — the same
  English verb, two shapes, one dialog apart.
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
use it for progress text and never for a button. It is the settled shape for every progress
string in `config` — `importing`, `duplicating`, `autoSaveSaving`, `instances.creating`,
`models.loading` — so a progress label in a later namespace that reaches for a verbal noun
instead is the outlier, not the innovation.

**A pair of keys that renders the same English word takes the same Turkish shape in both.**
`config:models.footprintInspecting` and `footprintInspectingShort` are both English
"Inspecting", and both ship the progressive: "{{model}} ölçülüyor ({{done}}/{{total}})…"
and "Ölçülüyor…". Where the long member's natural Turkish word order would put a finite
verb in front of the numbers, **reorder around the tokens rather than changing the shape** —
word order around a placeholder is free, the shape of a sibling pair is not.

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
`config:routing.promptBadge`, not through `config:routing.labelPromptOptions`.

**One do-not-translate collision to know about.** The guard's term check counts `API`, and
Turkish "KAPI" contains it. The check now matches on token boundaries so "KAPI" no longer
registers, but the near-miss is real: it is one of two reasons *quality gate* is "kalite
geçidi" and never "kalite kapısı".

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”`, matching the English source after its review —
  `config:duplicateSuccess` ships `“{{name}}” projesi çoğaltıldı.` The **placeholder is
  untouched; the two characters around it are ours.**
- **Adding quotes English does not have is licensed for an identifier**, and only for one:
  `config:instances.formTitle` / `instanceOf` / `slugHelp` quote `{{base}}` so the module id
  reads as a name rather than as part of the sentence, exactly as English itself quotes
  `{{slug}}` and `{{model}}` in the same namespace. It is not licensed for prose values, and
  never for a number.
- Ellipsis is the single character `…` (U+2026), matching `common:saving` ("Saving…") —
  "Kaydediliyor…".
- Turkish attaches case suffixes to proper nouns with an apostrophe ("NARN'ı", "API'sini",
  "VRAM'i"). Use the plain ASCII `'` for it, not `’` — that is Turkish practice, and the
  straight-quote sweep below is about quotes **around a value**, not about this apostrophe.
  Do this only on literal names you can see; see the placeholder rules for why never on a
  token.
- Em dashes in the source stay em dashes with spaces around them. Never a hyphen.

### Keyboard key names — Latin, as engraved

**`Enter`, `Esc`, `Shift`, `Tab`, `Ctrl` and `Alt` stay in English for this locale**, and
that is a decision about the hardware, not an untranslated leftover: a Turkish Q or F keycap
is printed with the Latin words. `terminology.md`'s rule is "write the key name as it is
engraved on that locale's keyboard", and here the engraving is English — unlike French
(**Entrée**, **Échap**, **Maj**) or Spanish (**Intro**, **Mayús**).

Shipped in batch 2 at `strings:compare.contextPlaceholder` and `tonePlaceholder`
("kaydetmek için Enter, yeni satır için Shift+Enter, iptal için Esc"),
`strings:compare.cellEditTooltip` ("Düzenle · Enter · iptal için Esc") and
`cellEditReviewedTooltip` ("İncelendi — düzenlemek için Enter'a basın").

Two consequences worth knowing:

- **A case suffix on a key name takes the apostrophe** — "Enter'a basın" — because it is a
  literal proper noun you can read in the string. That is the licensed use of the
  apostrophe form; it is still **never** available on a `{{token}}` (see the placeholder
  section).
- **The same words translate normally as verbs and nouns.** "Enter your password" is not
  this rule; read the string, not the word.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. `config:overflowRatioDescription` ships
"Varsayılan: 1,75." for English's "1.75".

No space before `%`, and Turkish writes the sign **before** the number ("%50") — follow
that where the number is literal, including where the English writes it after:
`config:health.successRate` ("Success {{rate}}%") ships "Başarı %{{rate}}", and
`config:models.gpuPlacement` ("{{pct}}% GPU") ships "GPU %{{pct}}".

**A currency symbol follows the number, with a space.** Turkish writes "10,50 $", not
"$10,50", so the four cost strings invert English's order: `strings:runs.estimatedCost`
("≈ ${{amount}}") ships "≈ {{amount}} $", and `projectTotal` / `projectTotalYou` /
`projectTotalCollaborators` follow it. This is the mirror of the `%` rule above — Turkish
puts the percent sign *before* and the currency symbol *after* — and the two are easy to
conflate, so they are written down together. The token is untouched; only the symbol moves.

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
2. **Restructure so the token lands at the end of a clause, behind a colon, or inside
   brackets.** This is the count-neutral device the runbook prefers for numeric tokens, and
   in this locale it is also the fallback whenever device 1 is unavailable.
3. **Invariant postposition.** Turkish postpositions — "için", "ile", "gibi", "kadar" —
   do not harmonize, so "{{name}} için" is safe where a case suffix would not be.

**The apostrophe form is not device 4.** Turkish writes a case suffix on a proper noun with
an apostrophe — "NARN'ı", "API'sini" — and it is tempting to reach for `{{model}}'i`. It
does not help: the apostrophe separates the suffix, it does not choose it. You would still
be picking one of `-i / -ı / -u / -ü` for a value you cannot see. The apostrophe is for
literal names **you can read in the string**, never for a token.

### Which device a string takes — open the call site, do not consult a list

**The rule turns on what the token's value can be, not on what the token is called.** One
question decides it, and you answer it at the call site:

> **Is the token `{{count}}`?**
>
> - **Yes — stop here. Write the plain, natural Turkish: `{{count}}` + the singular
>   noun.** "{{count}} satır işlendi", "{{count}} kural", "{{count}} yetim". `{{count}}` is
>   the one token i18next selects a plural category for, so its own family handles
>   agreement — and Turkish does not mark the plural after a numeral anyway, so there is
>   nothing to make grammatical and **nothing to restructure**. Roughly eighteen strings in
>   `config` are this shape. The rest of this section does not apply to them.
>
> **Otherwise — can this token's value ever be a number the reader counts?**
>
> - **No** — it is an id, a name, a language, a message, a timestamp, a model, a slug.
>   **Device 1 is available**, and is usually the best Turkish: write the natural
>   appositive, and the following head noun carries the suffix. It is *available*, not
>   compulsory — device 2 is often the better sentence anyway, and three `config` strings
>   correctly take it on non-numeric tokens (`credentialsMissing`, `activatedLanguages`,
>   `rawNewlineLanguagesNotice`, all of which end on a list the reader scans). Choose on the
>   sentence; either is safe here.
> - **Yes, and it is not `{{count}}`** — a total, a size, a limit, a rate, a token count, a
>   position. **Write the natural Turkish here too, unit noun and all: "en fazla
>   {{maxLength}} karakter", "{{chars}} karakter / {{bytes}} bayt".** The runbook's
>   *"Only `count` triggers plural selection"* rule demands a count-neutral frame for these
>   tokens because in most languages the noun after them inflects and the framework cannot
>   select the form. **Turkish has no numeral agreement at all** — a noun after any numeral
>   stays in the bare singular — so there is no form to get wrong and the frame buys this
>   locale nothing. Device 2 stays available as a *stylistic* choice where the sentence
>   reads better with the number last; it is not a requirement.
>
> **Two rules survive all three branches, and they are the ones that actually bind:** never
> weld a suffix onto a token (the section above), and never swap the token English wrote for
> a different one — interpolating `{{count}}` in place of `{{total}}` fails the placeholder
> multiset check, whatever it does for the grammar.

An earlier version of this section said the device was chosen by whether the token appeared
on the pre-flight's 23-name `NUMERAL_TOKEN_SKIPLIST`. **That was wrong, and it is worth
saying why**: that list is a Russian-calibrated description of which tokens in this app
cannot hold a number — a fact about the app, useful as a *hint* for the question above —
not a grammar policy for 1,500 Turkish keys. Reading it as policy also made the guide
disagree with its own batch: `config:models.confidenceReason.effort-reduces-quality` ships
device 1 on `effort`, which is not on that list, and it is perfectly correct Turkish.

#### The tooling constraint that used to bind here — and no longer does

**Read this before copying batch 1's shapes: the blocker is gone.** While batch 1 was
written, `tr` had no `NUMERAL_WORD_AXIS_EXEMPTIONS` entry, so *every* `{{token}}` + space +
Turkish word occurrence outside the token skiplist was reported as an uncleared candidate
and the pre-flight exited non-zero — which blocked the bare device-1 form even where it was
the correct Turkish. `scripts/i18n-preflight.mjs` now carries
`NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES`, and `tr` is in it: because Turkish counted nouns
never inflect for number, there is no numeral-word agreement to check, so every token-axis
survivor is cleared **unconditionally** — "there is nothing to look for", not "nobody has
looked yet". The script's own comment names `{{total}} girdi` as the correct string the old
behaviour would have failed.

Two consequences:

- **Device 1 is now available for every non-numeric token**, bare, in natural word order.
  No punctuation trick is needed to satisfy the gate.
- **The identifier quoting in `config:instances.*` (`“{{base}}” örneği`) stands on its own
  merits, not on the gate.** Keep it: English quotes identifiers in the same namespace
  (`config:instances.slugReserved`, `config:models.useCustom`), and punctuation around a
  placeholder is ours to set. But do not reach for it as a workaround — there is nothing
  left to work around.

Turkish's real numeral-adjacent hazard is a different check now: **1b, "Welded suffix"**,
which gates a case or particle suffix written directly against a token. That is the one to
keep clean.

#### Worked example — `config:instances.formTitle` ("New instance of {{base}}")

- **Wrong:** "{{base}}'in yeni örneği". The genitive is `-in / -ın / -un / -ün` plus a
  buffer `n` after a vowel. `openai` wants "openai'nin", `deepl` wants "deepl'in", `gpt-4`
  wants "gpt-4'ün". One string cannot be right for all three, and two of the three are
  wrong however you write it.
- **The question:** can `{{base}}` be a number? No — it is a base module id. **Device 1.**
- **Shipped: "Yeni “{{base}}” örneği"** — the appositive, in natural Turkish word order,
  with the identifier quoted. The suffix rides on "örnek". Its sibling
  `config:instances.instanceOf` ships the same shape, "“{{base}}” örneği", so the badge and
  the dialog title agree.

#### Numeric tokens, as shipped — natural order, unit noun attached

Every one of these carries a token whose value **is** a number. They ship in ordinary
Turkish word order, with the unit noun where a Turkish writer would put it:

| Key | English | Turkish |
| --- | --- | --- |
| `config:reviewProgressCount` | `{{reviewed}} / {{total}} reviewed` | `{{reviewed}} / {{total}} incelendi` |
| `config:lqa.lengthLimitValue` | `{{chars}} chars / {{bytes}} bytes` | `{{chars}} karakter / {{bytes}} bayt` |
| `config:templateMeta` | `{{languages}} languages · {{rules}} routing rules` | `{{languages}} dil · {{rules}} yönlendirme kuralı` |
| `config:routing.templateMeta` | `max {{maxLength}} chars` | `en fazla {{maxLength}} karakter` |
| `config:models.confidenceReason.prompt-near-context` | `(~{{tokens}} tokens)` | `(~{{tokens}} token)` |
| `config:models.confidenceReason.batch-exceeds-reliable` | `{{entryCount}} entries exceed the ~{{reliable}}` | `{{entryCount}} girdi, … ~{{reliable}} sınırını aşıyor` |

**Never drop the unit noun.** Whether the number comes first or last, "karakter", "bayt",
"token" and their kind stay: a bare number in a metadata strip says nothing, and rubric
item 4 is about exactly this. `config:routing.templateMeta` is the standing example: it
ships "en fazla {{maxLength}} karakter". A round-1 draft of it read *uzunluk sınırı*
followed by the bare number, with no unit at all — that is the shape to avoid, and it is
quoted here as a wrong form, not as a rendering.

**These six shipped inverted for one round, and the story is worth keeping.** Turkish's
natural order was blocked while batch 1 was written: the pre-flight then treated `tr` as an
uncalibrated word axis, so "{{maxLength}} karakter" reported as an uncleared survivor and
failed the gate. It was recorded as calibration debt — a word axis waiting to be derived
from whole-language survivors. **The debt turned out not to be real.** Turkish nouns never
inflect after a numeral, so there is nothing for a word axis to catch and none was ever
needed; `tr` is now in `NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES` and the natural order passes.
The six were restored in fix round 3. **The lesson generalises past this locale: an
inversion that exists only to keep a detector quiet is a guard authoring copy, which the
runbook forbids — when a shape looks unnatural, check whether a tool is the only thing
asking for it before you write it down as a convention.**

#### Non-numeric tokens, as shipped in batch 2 — the cell aria-labels

Five sibling `aria-label`s in the Compare grid all interpolate `{{language}}`, and they are
the clearest worked set of device 1 vs device 3 in the language. A screen reader speaks an
ungrammatical form verbatim, so this family is worth copying rather than re-deriving.

| Key | English | Turkish | Device |
| --- | --- | --- | --- |
| `strings:compare.cellMarkReviewedAria` | `Mark {{language}} translation as reviewed` | `{{language}} çevirisini incelendi olarak işaretle` | 1 — "çeviri" carries the suffix |
| `strings:compare.cellClearAria` | `Clear translation for {{language}}` | `{{language}} çevirisini temizle` | 1 |
| `strings:compare.cellEditAria` | `Edit translation for {{language}}` | `{{language}} çevirisini düzenle` | 1 |
| `strings:compare.cellRetranslateAria` | `Re-translate {{language}}` | `{{language}} için yeniden çevir` | 3 — invariant "için" |
| `strings:compare.cellUndoAria` | `Previous versions for {{language}}` | `{{language}} için önceki sürümler` | 3 |

**Why two devices inside one family, deliberately.** Device 1 needs a head noun to carry the
suffix, and for the first three that noun is "çeviri", which their English names too. The
last two have no such noun available: device 1 on `cellRetranslateAria` forces
"{{language}} çevirisini yeniden **çevir**" — the same root twice in four words — and
`cellUndoAria`'s head is already "sürümler", which cannot take the language. The invariant
postposition is the better sentence in both, and it is just as safe. **Choose on the
sentence, not on the family**: the rule that binds is that no suffix ever touches the token.

`strings:runs.copyRunId` ("{{runId}} çalıştırma kimliğini kopyala") and
`strings:runs.runFailedToast` ("{{type}} çalıştırması başarısız oldu") are the same device 1
shape on other tokens, and `strings:achievement.dialogSubtitle` ("“{{text}}” için karşılığını
seçin.") is device 3 with the identifier quoted exactly as English quotes it.

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
1.92 (`config:deselectAll`). Over the 452 shipped `strings` keys: aggregate **1.16**, median
**1.13**, 90th percentile **1.70**, longest single ratio 3.33 (`strings:compare.run`, three
English characters against “Çalıştırma”). Re-measure over the whole language at the final
sweep, and state the population with the figure. **The two namespaces differ because
`strings` is chrome:** it is full of one- and two-word labels, and a short English source is
what produces a large ratio — the tail here is not long renderings, it is short sources. The catch is distribution, not the aggregate: fewer,
much longer single tokens ("değerlendirilemedi", "yapılandırmalarınızı"), which clip rather
than wrap, and a tail that is what breaks chrome.

**Budgets are absolute character counts, per class — never a multiple of English.** A ratio
is the wrong unit when the English source is short: "Legal" is five characters, and no
correct Turkish rendering of it can fit 1.5×. The five classes are also not equally
constrained — only the sidebar has a fixed width.

| Class | Anchor key | Budget | Kind | Basis |
| --- | --- | --- | --- | --- |
| Sidebar item | `sidebar:globalConfig`, `sidebar:legal` | **26** | **hard** — fixed `16rem` (`SIDEBAR_WIDTH`), `truncate` | the container |
| Tab label | `strings:tabs.backup` | 32 | soft | measured over the **main** tab bar — longest shipped is 28: `tabs.review-source-ai` "Kaynak yapay zekâ incelemesi" (and `tabs.review-translation-ai`, also 28) |
| Table column header | `strings:columns.config` | 20 | soft | measured — longest shipped is 18: `runs.runIdColumn` "Çalıştırma kimliği" |
| Filter label | `strings:filters.needsReview` | 40 | soft | measured — longest shipped is 38: `filters.lqaFailed` "Yalnızca LQA başarısızlıklarını göster" |
| Bulk-bar control | `strings:bulk.approveSelected` | 40 | soft | measured — longest shipped control is 39 as a template / ~35 rendered: `bulk.selectAllFiltered` "Filtrelenen {{count}} satırın tümünü seç"; longest static one is 23, the anchor itself, "Çeviri belleğine onayla" |

The sidebar number is derived from the container, which is the same container for every
locale, and is the only figure not re-derivable from shipped strings.

**All four soft figures are now measured, and batch 2 raised three of them.** Batch 1 could
only see `config`'s own members of two classes — the twelve model-table headers
(`config:models.col*`) and the routing editor's *in-panel secondary* tab bar
(`config:routing.tabRules`, `tabTemplates`, `tabImportExport`) — and had no filter row or
bulk bar to measure at all. `strings` owns the widest member of every one of the four, so
these are the figures the classes are actually held to.

**The tab-label figure moved 26 → 32, and the reason is the container, not drift.**
`config`'s tabs sit inside one panel; `strings:tabs.*` is the main, wider, scrolling bar.
The two AI-review tabs are 28 characters because *AI review* is “yapay zekâ incelemesi” and
the AI is never abbreviated to “YZ” (see the term row) — a term forcing a long label is the
term rule doing its job, and the budget exists to stop *avoidable* length, not this. **Do
not shorten a settled surface name to fit an earlier batch's number:** every later batch
repeats these names verbatim, so a shortened tab label would propagate into four namespaces.

Each figure is the longest shipped value plus a little headroom, and the whole-language
sweep re-measures all four over the finished locale.

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, but do not distort a term to
hit a number. **Terms outrank the budget**, which exists only to stop *avoidable* length.

The guard's own length check is a separate, cruder thing: a 2.5× ratio cap
(`MAX_LENGTH_RATIO` in `scripts/locale-rules.mjs`) on English sources of 12 characters or
more. Nothing in `config` comes close — the longest Turkish/English ratio in the namespace
is well under 2×. If a correct rendering ever breaches it, escalate for a per-key
`LENGTH_EXEMPTIONS` entry rather than distorting the wording.

## Surface names — repeat these verbatim

A surface is named in one namespace and owned by another, so these are written by different
translators at different times. **Batch 2 owns the main tab bar, which is where most of them
are settled**; `config` named five of them before the labels existed, and those five are
consistent with the table below by construction. They are settled; copy them, do not
re-render them.

### The main tab bar — `strings:tabs.*`, all seventeen

| Surface | Turkish | Owning key | Also named at |
| --- | --- | --- | --- |
| Config | Yapılandırma | `strings:tabs.config` | `strings:guide.topicConfig` "Yapılandırma sekmesi" |
| Data | Veri | `strings:tabs.data` | — |
| Translations | Çeviriler | `strings:tabs.strings` | `config:routing.categoriesConfiguredHint`, `strings:guide.topicMultiLanguage` |
| Compare | Karşılaştırma | `strings:tabs.compare` | `config:routing.tonesHint`, `strings:guide.topicCompare`, `strings:order.presortHint` |
| Source AI review | Kaynak yapay zekâ incelemesi | `strings:tabs.review-source-ai` | `review:sourceAi.configTitle` (batch 3) |
| Translation AI review | Çeviri yapay zekâ incelemesi | `strings:tabs.review-translation-ai` | `review:translationAi.title` (batch 3) |
| Manual review | Elle inceleme | `strings:tabs.review-manual` | — |
| Quality | Kalite | `strings:tabs.quality` | `strings:guide.topicQuality` — **no "Tab" suffix in English; do not add "sekmesi"** |
| Glossary | Sözlükçe | `strings:tabs.glossary` | `strings:guide.topicGlossary` "Sözlükçe sekmesi" |
| Category | Kategori | `strings:tabs.category` | `strings:guide.topicCategory` "Kategori sekmesi" — singular on purpose, though the page it opens is plural |
| Routing | Yönlendirme | `strings:tabs.routing` | `strings:guide.topicRouting` "Yönlendirme sekmesi" |
| Activity | Etkinlik | `strings:tabs.runs` | `strings:guide.topicActivity`; page title expands to "Çeviri etkinliği" (`strings:runs.title`) |
| Stage details | Bölüm ayrıntıları | `strings:tabs` (stage-details) | `stage-details:title` (batch 6), `strings:runs.typeStageDetailsTranslation` |
| Orphans | Yetimler | `strings:tabs.orphans` | `orphans:title` (batch 6), `config:fullReplaceOrphanNotice`, `strings:guide.topicOrphans` |
| Backup | Yedekleme | `strings:tabs.backup` | `config:importSnapshotNote`, `strings:guide.topicBackup` |
| Sharing | Paylaşım | `strings:tabs.sharing` | `collab:sharing.pageTitle` (batch 4) |
| Text Styler | Metin biçimlendirici | `strings:tabs` (color-text) | `colorText:title` and `sidebar:colorText` (batches 4/6), `strings:runs.typeChatTextStyler` |

### Surfaces named outside that bar

| Surface | Turkish | Owning key | Also named at |
| --- | --- | --- | --- |
| Global Config | Genel yapılandırma | `sidebar:globalConfig` | `config:globalConfigTitle` — **word-for-word identical in English, and must stay so**; also `strings:runs.aiReviewNoModules` |
| Credential Vault | Kimlik bilgisi kasası | `strings:guide.topicVault` | `vault:statusLabel` (batch 4) — the full form, never the bare clip "kasa" |
| AI Review | Yapay zekâ incelemesi | `strings:guide.topicAiReview` | `strings:runs.aiReview` / `aiReviewConfigTitle` / `judgeBadge` |
| Translation Memory | Çeviri belleği | `sidebar:translationMemory` | `config:tm.*`, `strings:guide.groupTranslationMemory`, `strings:guide.topicTranslationMemory` |
| Review (sidebar group) | İnceleme | `sidebar:groups.review` | `strings:guide.groupReview` — an umbrella, not any one member; see the term row |
| Pseudo Test | Pseudo Test | `strings:guide.topicPseudoTest` | `config:pseudoTestHelpAria` — a proper noun, untranslated |

**Guide topics append "sekmesi", and only where English appends "Tab".** `topicQuality`,
`topicActivity`, `topicAiReview`, `topicPseudoTest`, `topicVault`, `topicQuickSetup` and
`topicTranslationMemory` have no "Tab" in English and take no "sekmesi" — mirror English
per key rather than regularising the set.

Four notes on these tables:

- **Two tab labels are 28 characters** — the two AI-review tabs — because the term is
  "yapay zekâ incelemesi" and the AI is never abbreviated. That is what set the tab-label
  budget to 32; see "Length discipline".
- **`strings:runs.viewEngines` ("AI engines") is not a surface name.** It labels a view
  toggle inside Activity and ships as "Yapay zekâ motorları". "motor" is banned as a
  rendering of *module*, not as a word — here English itself says engines.
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

**The seventh sweep now has a gate behind it — keep running it anyway.** When batch 1 was
written, the pre-flight's narrow rule required **whitespace** between `}}` and the following
word, so it could not see `{{model}}'i` at all — this locale's signature defect passed the
gate cleanly, and the grep was the only thing that caught it. `scripts/i18n-preflight.mjs`
now carries **check 1b, "Welded suffix"**, which matches a case or particle suffix written
directly against a token and gates the exit code. The grep stays in this table as the
cheaper inner-loop check and as cover for shapes the gate may not match; a clean grep is no
longer the only evidence, but a dirty one is still a defect.

Conversely, what the narrow numeral rule flags for Turkish is **not** a numeral-agreement
defect at all: a Turkish noun after a numeral never inflects for number, so "{{total}} girdi"
is correct at every count. The pre-flight now says so itself — it reports the word axis as
**not applicable** for `tr` and clears token-axis survivors unconditionally rather than
treating this locale as merely uncalibrated. Twelve `config` occurrences are cleared that
way today, and every one of them is ordinary Turkish. The runbook's *"Only `count` triggers
plural selection"* rule is written for languages whose counted nouns inflect; it constrains
this locale only through the shared placeholder rules, never through word order.

## Open debts — each with the event that discharges it

Three decisions were deliberately deferred rather than guessed. Each is a **debt with a
trigger**, not a remark: when the trigger happens, the person it happens to owns the fix.
They are also recorded in the wave ledger, so neither this file nor the ledger is the single
point of failure.

| # | Debt | Trigger — who discharges it, and when | What to do |
| --- | --- | --- | --- |
| 1 | ~~`terminology/tr.md` records *credential vault* as the clip **"kasa"**, not the term.~~ **CLOSED in batch 2.** | — | `strings:guide.topicVault` ships **"Kimlik bilgisi kasası"**, and the Rendering column in `terminology/tr.md` is promoted to the full form. The clip "kasa" remains licensed only where the string already establishes credentials. **Batch 4's `vault:statusLabel` is the second cold naming and takes the full form too** — that part of the debt transfers, it does not vanish. |
| 2 | ~~Six strings invert the unit noun behind a colon where Russian ships natural order.~~ **CLOSED in fix round 3 — and it was never a real debt.** It was recorded as a word-axis calibration debt on the assumption that `tr`'s axis was merely uncalibrated; Turkish counted nouns do not inflect after a numeral at all, so the axis is structurally moot and no list was ever owed. | — | Natural order restored in all six, plus `models.confidenceReason.batch-exceeds-reliable` in the same class. **Batch 2 writes numeric strings in natural Turkish order, unit noun attached** — there is one convention, not two. See "Numeric tokens, as shipped" above. |
| 3 | ~~Two of the five length budgets (filter label, bulk-bar control) are still provisional.~~ **CLOSED in batch 2.** | — | All four soft figures are re-derived from the longest value `strings` actually ships: tab label 26 → **32**, column header 16 → **20**, filter label 38 → **40** (the provisional guess landed on the exact measured longest, 38), bulk-bar control 52 → **40**. The whole-language sweep re-measures them over the finished locale, as it does for every language. |

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
