# Style guide — Turkish (tr)

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles register, casing, punctuation, length and
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

## Casing

Sentence case for every control, label, tab and page title. Turkish does not capitalize
every word of a heading, so `config:routing.title` ("Routing Rules") becomes "Yönlendirme
kuralları". `english-review-notes.md` records that English Title Case on page titles is a
per-surface design convention with no meaning outside English.

Language names and nationalities **are** capitalized in Turkish ("Türkçe", "İngilizce") —
unlike the Romance and Slavic locales. Months are capitalized too ("Ocak").

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "DURUM".

**The dotted/dotless I is a real hazard when uppercasing.** In Turkish, uppercase of `i`
is `İ` (not `I`), and uppercase of `ı` is `I`. Any label you write in uppercase must use
the Turkish mapping by hand — "İçerik", not "Icerik"; "İŞLEM", not "ISLEM". Do not rely on
a generic uppercase transformation.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”`, matching the English source after its review.
- Ellipsis is the single character `…` (U+2026), matching `common:saving` ("Saving…") —
  "Kaydediliyor…".
- Turkish attaches case suffixes to proper nouns with an apostrophe ("NARN'ı"). Do this
  only on literal names you can see; see the placeholder rules for why never on a token.
- Em dashes in the source stay em dashes with spaces around them.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. No space before `%`, and Turkish conventionally
writes the sign before the number ("%50") — follow that where the number is literal, and
leave app-formatted values alone.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

Turkish is **about the same length as English or slightly shorter overall** (roughly −5% to
+10%), because agglutination packs prepositions and possessives into suffixes. The catch is
distribution: fewer, much longer single tokens ("değerlendirilemedi",
"yapılandırmalarınızı"), which clip rather than wrap.

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.4× the English character count**, and prefer a
two-word noun phrase over one long suffixed word where both are correct.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

**Never attach a suffix directly to a token.** Turkish suffixes obey vowel harmony and take
a buffer consonant depending on the value's final sound — and the value is unknown at
translation time, so "{{module}}'ü" is a coin flip. Put a real noun after the token and
suffix that instead: the closing clause of `logs:translation.failedModuleDisabled` ("…the
{{module}} module is turned off"; the full string carries three tokens) becomes
"{{module}} modülü kapalı" — "modül" takes the suffix, the token stays bare.

**Counted nouns stay singular.** After a numeral, Turkish does not mark the plural:
`category:countLabel_other` ("{{count}} entries") is "{{count}} girdi", with no `-ler`.
That means the `_one` and `_other` strings are usually identical, which is correct, not a
copy-paste error.

## Locale-specific traps

- **Agglutination means the domain term appears inflected everywhere.** "proje" shows up as
  "projeyi", "projeden", "projenin". That is expected and correct; `terminology.md` records
  the bare citation form, and consistency means the same stem, not the same letters.
- **Vowel harmony applies to your own coinages too** — a suffix chosen for its written look
  rather than by harmony is immediately wrong to a reader.
- **"Judge"** takes the evaluative sense ("değerlendirme"), never "yargıç"/"hâkim", the
  courtroom reading.
- **"Stage" is a game level**, not a phase: "aşama" and "evre" are exactly the process
  readings `terminology.md` warns about.
- **Loanword or Turkish coinage — pick once.** "modül" vs "birim", "şablon" vs "kalıp",
  "önbellek" vs "cache". All are attested; alternating inside one namespace is the defect.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Turkish needs no parenthetical at all — the singular
  noun after the number already covers every count.
