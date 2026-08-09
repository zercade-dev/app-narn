# Style guide — Indonesian (id)

This locale is **Indonesian**, not Malaysian Malay. The two are close enough that a
Malaysian word slips through unnoticed by a non-native reviewer and jars every native one —
the traps section lists the ones that actually occur in software.

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**Anda, capitalized, and used sparingly.** Indonesian UI convention is to drop the pronoun
altogether wherever the sentence still works: `sidebar:selectProject` ("Select a project")
is "Pilih proyek", not "Pilih proyek Anda". Reserve "Anda" for sentences that genuinely
need to distinguish the user's things from someone else's — `vault:unlockDescription`
("Enter your password…") is "Masukkan kata sandi Anda…".

Never "kamu" (too familiar for a professional tool) and never "Saudara" (dated and formal).

Instructions and button labels both take the **bare verb form**: "Pilih", "Simpan",
"Hapus", "Batal". Do not use the passive "di-" construction for controls — "Disimpan" is a
state, not a button.

## Casing

Sentence case for every control, label, tab and page title. Indonesian has a title-case
convention for document titles, but the app's controls are not document titles, and
`english-review-notes.md` records that English Title Case here is a per-surface design
convention with no meaning outside English.

Language names, months and days **are** capitalized in Indonesian ("Bahasa Indonesia",
"Januari", "Senin") — unlike the Romance locales.

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "STATUS", which happens to be identical.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”`, matching the English source after its review.
- Ellipsis is the single character `…` (U+2026), matching `sidebar:searchProjects`
  ("Search projects…") — "Cari proyek…".
- Reduplication is hyphenated and unspaced: "kata-kata", "masing-masing". Do not write
  "kata kata" or "kata2".
- Prefixes attach without a space ("menerjemahkan"); the particles "di" and "ke" are
  separate when locative ("di proyek") and attached when passive ("diterjemahkan"). This is
  the single most common Indonesian spelling error in UI copy.
- Em dashes in the source stay em dashes with spaces around them.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. No space before `%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

Indonesian runs roughly **15–25% longer** than English, almost entirely through affixation:
"terjemahan" becomes "penerjemahan", "atur" becomes "pengaturan", "pilih" becomes
"pemilihan".

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.6× the English character count**, and prefer the
shorter derivation: "Terjemahan" over "Penerjemahan", "Kualitas" over "Penjaminan
kualitas". Body text is unconstrained — put the precision there.

The renderings used as examples above are illustrations of the length problem, not
decisions about wording. `terminology.md` owns the rendering of every domain term,
including the surface names and _translation memory_ — decide it there on first use,
record it, and then follow it here.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Indonesian is comfortable here: nouns do not inflect, there are no articles and no gender,
so a token can sit almost anywhere. The closing clause of
`logs:translation.failedModuleDisabled` ("…the {{module}} module is turned off"; the full
string carries three tokens) becomes "Modul {{module}} dinonaktifkan".

**No plural marking after a numeral.** `category:countLabel_other` ("{{count}} entries") is
"{{count}} entri" — never "entri-entri".

**Indonesian has exactly one plural category: `other`.** A plural family therefore supplies
`_other` and nothing else — never a `_one` copied across from English. A `_one` key can
never resolve here, and the key-parity guard rejects any suffix that is not a plural
category of the language, so copying English's pair is a red build, not a harmless
duplicate.

## Locale-specific traps

- **Indonesian, not Malaysian.** Use "hapus" (not _padam_), "unggah" (not _muat naik_),
  "unduh" (not _muat turun_), "kata sandi" (not _kata laluan_), "berkas" or "file" (not
  _fail_), "tombol" (not _kekunci_), "pratinjau" (not _pratonton_), "peramban" or "browser"
  (not _pelayar_).
- **Loanword or coinage — decide per term and record it.** Indonesian tech vocabulary is
  genuinely split: "proyek", "modul", "glosarium" and "template" are the words practitioners
  say, while "berkas", "peramban" and "gawai" compete with plain English loans. Prefer the
  established loan for domain terms and Indonesian for everyday verbs (simpan, hapus,
  batal). Alternating inside one namespace is the defect.
- **"Stage" is a game level.** Indonesian gaming says "level" or keeps "stage"; "tahap" and
  "tahapan" are exactly the process readings `terminology.md` warns about.
- **"Judge"** takes the evaluative sense ("menilai", "penilaian"), never "hakim"/"mengadili".
- **Formal written Indonesian, not Jakarta colloquial.** "tidak", not "nggak"; "hanya", not
  "cuma"; "membuat", not "bikin".
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Indonesian needs no parenthetical at all — the
  unmarked noun already covers every count.
