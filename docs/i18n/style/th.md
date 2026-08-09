# Style guide — Thai (th)

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**Neutral polite written Thai, with no politeness particles.** Do **not** end strings with
ครับ or ค่ะ. Those particles are gendered — they encode the _speaker's_ gender, and the
app has no gender — and they add length to every string that carries them. Thai software
copy is impersonal written register, not spoken register.

Use คุณ only where the sentence genuinely has to distinguish the reader's things from
someone else's, as in `vault:unlockDescription` ("Enter your password…"). Elsewhere drop
the pronoun: `sidebar:selectProject` ("Select a project") is "เลือกโปรเจกต์", with no
subject and no particle.

Instructions and button labels both take the bare verb: "เลือก", "บันทึก", "ลบ", "ยกเลิก".
Do not use กรุณา ("please") on controls; reserve it for genuine requests such as a retry
prompt.

## Casing

Thai has no letter case. The English distinction between sentence case, Title Case and the
uppercase table headers simply does not exist here, and there is nothing to mirror.

`strings:columns.config` ("STATUS") is the one place this matters:
`english-review-notes.md` records that the header shouts for a layout reason and that a
language with no case should translate it normally — "สถานะ", with no attempt to signal
emphasis.

Latin-script material inside a Thai string (`API`, `CSV`, `AI`, provider names) keeps its
English casing.

## Punctuation and spacing

- **Thai has no spaces between words.** A space in Thai is a phrase or clause separator,
  doing roughly the job of an English comma. Never insert a space to break up a long word,
  and never remove a space that is separating clauses.
- **No full stop at the end of a sentence.** Thai marks a sentence end with a space (or
  nothing at all, at the end of a string). Do not carry the English period across.
- Questions take an interrogative particle — ไหม, หรือไม่ — and **no question mark**.
  `backup:confirmTitle` ("Replace current project data?") becomes
  "แทนที่ข้อมูลโปรเจกต์ปัจจุบันหรือไม่".
- Ellipsis: keep the single character `…` (U+2026) exactly where the English source has it,
  since it is a UI affordance (a loading state, a search placeholder) rather than Thai
  punctuation.
- Do not use ๆ unless the repetition it marks is genuinely there.
- Em dashes in the source stay em dashes with spaces around them.

## Numbers and dates

Use **Arabic numerals** (`0`–`9`), not Thai numerals (๐–๙). Thai numerals are used in
ceremonial and legal contexts, not in software.

Decimal point, comma thousands: `1,234.56`. No space before `%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string. In particular, do not attempt to convert to the Buddhist era by
hand inside a string.

## Length discipline

Thai character counts land close to English, but **Thai has no spaces to wrap on**, so a
long label becomes one unbreakable run that clips rather than wrapping. Thai also renders
taller than Latin script, because vowels and tone marks stack above and below the
consonant line — a tight table row that fits English may cut the marks off.

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.3× the English character count** — a stricter ceiling
than the European locales get, precisely because there is no wrap point to fall back on.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Thai does not inflect, so a token can sit almost anywhere:
`logs:translation.failedModuleDisabled` ("the {{module}} module is turned off") becomes
"โมดูล {{module}} ถูกปิดใช้งาน". Note the spaces around the Latin-script token — those are
correct and necessary; Latin runs inside Thai text are separated by spaces even though Thai
words are not.

**Counted nouns need a classifier and no plural marking.**
`category:countLabel_other` ("{{count}} entries") is "{{count}} รายการ". `_one` and
`_other` will usually be identical, which is correct, not a copy-paste error.

## Locale-specific traps

- **Never insert a zero-width space (U+200B).** Some Thai content uses it as a line-break
  hint. Here it would be invisible in review and would break the whitespace-parity quality
  check, which compares whitespace between source and translation exactly.
- **A misplaced ordinary space changes the meaning**, because it is read as a clause
  boundary. Adding one to "help" a label wrap is a content change, not formatting.
- **Use precomposed, correctly ordered sequences.** Thai vowels, tone marks and sara-am
  have a canonical order; two visually identical strings with different mark order compare
  unequal and will confuse search, glossary matching and the tag checks.
- **Keep Latin technical tokens in Latin script.** `API`, `CSV`, `JSON`, `AI` and provider
  names are not transliterated; `terminology.md` already fixes the never-translated list.
- **"Stage" is a game level.** Thai gaming uses ด่าน or keeps "stage"; ขั้นตอน and ระยะ are
  exactly the process readings `terminology.md` warns about.
- **"Judge"** takes the evaluative sense (ประเมิน), never ผู้พิพากษา/ตัดสินคดี.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Thai needs no parenthetical at all — number plus
  classifier already covers every count.
