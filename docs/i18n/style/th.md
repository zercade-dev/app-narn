# Style guide — Thai (th)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/th.md`. This file settles register, casing, punctuation, length and
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

## Control shapes — resolve the control before you translate the string

English writes the same words for a title, a button, a column header and a placeholder.
Thai does not, and the difference is nominalization: `การ` + verb turns an action into the
name of a thing, and it is the single lever this locale uses to tell the four apart. The
worked pair is `config:models.select` and `config:models.pickTitle`, byte-identical in
English ("Select a model") and two different controls — a picker trigger and a dialog
title. Thai ships the bare verb for the first and the nominalized form for the second.

| Control | Thai shape | Example |
| --- | --- | --- |
| Page / section / dialog title, tab label | noun phrase — nominalize with `การ` where the English is a verb | `config:models.pickTitle`, `config:importCsv` |
| Button, menu item | **bare verb**, no `การ`, no subject, no particle | `config:chooseCsv`, `config:templateImport` |
| Confirm-dialog title | bare verb phrase where English has no question mark; interrogative particle where it does — see Punctuation | `config:confirmDeleteTitle` |
| Table column header | bare noun, keeping any abbreviation English keeps | `config:models.colContext` |
| Filter label, option value, state badge | bare noun or stative phrase, never an imperative | `config:module.reasoningEffortDisabled` |
| Placeholder inside a control | imperative — the same bare verb a button takes | `config:enableModulePlaceholder` |
| Progress / status text | `กำลัง` + verb, or verb + `แล้ว` when finished | `config:importing`, `config:autoSaveSaved` |

**An action and its resulting state must not collapse onto one string when both can be on
screen.** `config:disableModule` is a button ("Disable") and `config:modulesDisabledSection`
is the heading over the modules it produced ("Disabled ({{count}})"); both render on the
Global Config page at once. The button takes the bare verb and the heading takes the
stative `อยู่` form. The same split settles `config:module.reasoningEffortDisabled`, which
is an option value rather than an action.

**Score the paradigm, not the option.** Every value set — the four confidence tiers, the
five batch-grouping options, the four TM policies — is translated as a group and read down
the page, so all members take one part of speech.

## Casing

Thai has no letter case. The English distinction between sentence case, Title Case and the
uppercase table headers simply does not exist here, and there is nothing to mirror.

`strings:columns.config` ("STATUS") is the one place this matters:
`english-review-notes.md` records that the header shouts for a layout reason and that a
language with no case should translate it normally — "สถานะ", with no attempt to signal
emphasis.

Latin-script material inside a Thai string (`API`, `CSV`, `AI`, provider names) keeps its
English casing.

Because Thai has no case **and** no number marking, two English strings differing only in
case or only in number collapse to one Thai string. That is licensed, not drift: batch 1
ships one rendering for both "inactive" and "Inactive", and one for both "Target Languages"
and "Target language".

## Punctuation and spacing

- **Thai has no spaces between words.** A space in Thai is a phrase or clause separator,
  doing roughly the job of an English comma. Never insert a space to break up a long word,
  and never remove a space that is separating clauses.
- **No full stop at the end of a sentence.** Thai marks a sentence end with a space (or
  nothing at all, at the end of a string). Do not carry the English period across.
- Questions take an interrogative particle — ไหม, หรือไม่ — and **no question mark**.
  `backup:confirmTitle` ("Replace current project data?") becomes
  "แทนที่ข้อมูลโปรเจกต์ปัจจุบันหรือไม่".
- **Quotation marks follow the English source, per key.** Thai has no quotation marks of
  its own — both the straight pair and the curly pair are in ordinary Thai use — so there
  is no Thai convention to prefer, and matching the source is what keeps the pair around a
  `{{token}}` stable. Where English writes the straight pair (`config:duplicateSuccess`)
  Thai writes the straight pair; where English writes the curly pair
  (`config:instances.slugReserved`) Thai writes the curly pair. This is the one punctuation
  rule that does **not** follow the "your language's convention wins" instruction in the
  runbook, and the reason is that Thai has no competing convention rather than that the
  source outranks it.
- Ellipsis: keep the single character `…` (U+2026) exactly where the English source has it,
  since it is a UI affordance (a loading state, a search placeholder) rather than Thai
  punctuation.
- Do not use ๆ unless the repetition it marks is genuinely there.
- Em dashes in the source stay em dashes with spaces around them.

## Numbers, counting and dates

Use **Arabic numerals** (`0`–`9`), not Thai numerals (๐–๙). Thai numerals are used in
ceremonial and legal contexts, not in software.

Decimal point, comma thousands: `1,234.56`. No space before `%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string. In particular, do not attempt to convert to the Buddhist era by
hand inside a string.

**Thai nouns have no number, so no word in this locale ever agrees with a count.** The
numeral-agreement detector's word axis is therefore switched off for `th`
(`NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES` in `scripts/i18n-preflight.mjs`), on the same
grammar-fact grounds as `ja` and `tr`. That is not licence to stop thinking about numbers:
it moves the whole hazard onto the **classifier** (ลักษณนาม), which no script can check.

**Classifier by counted object.** Pick from this table rather than reaching for the nearest
noun; the wrong classifier is the one numeral defect this locale can actually ship.

| Counted object | Classifier | Where it was settled |
| --- | --- | --- |
| entry (the content unit) | รายการ | `config:new`, `config:orphanedCount` |
| CSV row | แถว | `config:rowsProcessed` |
| glossary | ชุด | `config:glossariesSkipped_other` |
| occurrence of an event (retries, attempts) | ครั้ง | `config:health.rateLimitRetries` |
| module instance | ตัว | `config:enableModuleAddInstance` |

**Where a non-`count` token carries a number, keep the head noun in front of the ratio.**
`config:reviewProgressCount` is "{{reviewed}} / {{total}} reviewed" in English and ships
here as the label first, then the bare ratio — the count-neutral device the runbook
prescribes, and the same fix `it` applied to the same key. `config:templateMeta` takes the
same shape, per `english-review-notes.md`, which records that both of its tokens are plain
array lengths.

## Length discipline

Thai character counts land close to English — measured over the whole language, the
aggregate ratio is **below 1.0** — but two facts make a raw character budget the wrong
instrument, and both are why this class needs measuring rather than estimating.

**1. Thai has no wrap point.** A Thai run has no spaces inside it, so an over-long label in
a fixed container does not wrap onto a second line; it clips or ellipsizes at whatever
character the container ends on. The overflow is silent and it can cut a word in half.

**2. A code-point count over-states Thai width by about a fifth.** Thai vowels and tone
marks are **nonspacing** — Unicode general category `Mn` — so they consume no advance
width at all. Measured over the shipped `th` files, `Mn` marks are **21.4%** of all Thai
code points. A budget written in code points is therefore not a budget in width. Count
**advance-bearing characters** instead, which is reproducible:

```js
[...value].filter((c) => !/\p{Mn}/u.test(c)).length
```

### The budgets

| Class | Anchor key | Kind | Budget (advance-bearing chars) |
| --- | --- | --- | --- |
| Sidebar item | `sidebar:globalConfig`, `sidebar:legal` | **hard** | 24 |
| Tab label | `strings:tabs.backup` | **hard** — same container | 24 |
| In-panel sub-tab | `config:routing.tabImportExport` | soft | 20 |
| Table column header | `strings:columns.config` | soft | 14 |
| Filter label | `strings:filters.needsReview` | soft | 18 |
| Bulk-bar control | `strings:bulk.approveSelected` | soft | 22 |

**How the two hard numbers were derived**, so the next person can redo it rather than trust
it. `SIDEBAR_WIDTH` is `16rem` = 256px (`components/ui/sidebar.tsx:34`). Off that come 1px
of right border, 16px of `SidebarGroup` `p-2`, 16px of `SidebarMenuButton` `p-2`, a 16px
`size-4` icon and an 8px `gap-2` — leaving **199px** of label. The label renders at
`text-sm`, 14px. A Thai consonant or spacing vowel in a UI sans face has an advance of
roughly 0.55em, so ~7.7px at 14px; rounding to 8px for headroom gives 199 / 8 ≈ **24**.
The 0.55em figure is the one estimate in this derivation and it is **not** measured here —
see the font note below for why it cannot be, in this repo, today. Everything else is read
off the component.

The four soft budgets are the longest value this locale ships in each class plus headroom,
measured after the last batch. Soft means prefer the shorter of two correct options; it is
not a failure threshold, and a term rule outranks it.

### Height is a separate constraint, and it is the one a character count cannot express

Thai stacks. A syllable can carry an upper vowel, a tone mark **above that**, and a lower
vowel below the consonant line — three levels where Latin has one. A line box tuned to
Latin clips the top and bottom of Thai rather than making it look cramped.

Two concrete findings, both read off the code:

- **`components/ui/label.tsx:12` sets `leading-none`** — line-height 1 — on every `<Label>`
  in the app, at `text-sm` (14px text in a 14px line box). A single-line label is safe:
  nothing on that element sets `overflow: hidden`, so the marks simply overflow the line
  box and still paint. A label that **wraps to two lines** is not: line 1's lower vowels
  and line 2's upper marks occupy the same pixels. **Keep Label strings short enough to sit
  on one line**, which for a form label in this app is the practical rule this constraint
  reduces to.
- **The bundled font has no Thai at all.** `--font-sans` is `'Geist Variable', sans-serif`
  (`packages/frontend/src/index.css:633`), and `@fontsource-variable/geist` ships only the
  `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext` and `vietnamese` subsets — check
  `metadata.json` in that package. Every Thai glyph therefore comes from the reader's own
  fallback face, so Thai line height, mark placement and advance width are all set by a
  font this app does not ship, does not pin and cannot measure. That is also why the 0.55em
  advance above is an estimate: there is no Thai font in this container to measure
  (`fc-list :lang=th` returns nothing), so a real pixel measurement needs the running app
  on a machine that has one. **A measurement beats this table**; if you can take one, do.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Thai does not inflect, so a token can sit almost anywhere:
the closing clause of `logs:translation.failedModuleDisabled` ("…the {{module}} module is
turned off"; the full string carries three tokens) becomes "โมดูล {{module}}
ถูกปิดใช้งาน". Note the spaces around the Latin-script token — those are correct and
necessary; Latin runs inside Thai text are separated by spaces even though Thai words are
not.

**Counted nouns need a classifier and no plural marking.**
`category:countLabel_other` ("{{count}} entries") is "{{count}} รายการ".

**Thai has exactly one plural category: `other`.** A plural family therefore supplies
`_other` and nothing else — never a `_one` copied across from English. A `_one` key can
never resolve here, and the key-parity guard rejects any suffix that is not a plural
category of the language, so copying English's pair is a red build, not a harmless
duplicate. Verified rather than assumed: `Intl.PluralRules('th').resolvedOptions()
.pluralCategories` is `["other"]`, for ordinals as well as cardinals. This locale therefore
lands at **29 keys fewer than English** — one per English `_one` — and the twelve
`bare + _other` families keep their bare key and add nothing.

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
- **`ตรวจ` is a shared root, not a shared word.** The sidebar Review group, the LQA check
  and human proofreading are three different terms built on it, told apart by their second
  element. Never shorten one of them to the bare root in running text.

## Surface names — repeat these verbatim

Every key naming one of these surfaces takes exactly the rendering below, and prose that
mentions the surface repeats it. Rows are added by the batch that first ships the name.

| Surface | Rendering | First shipped |
| --- | --- | --- |
| Global Config | การตั้งค่าส่วนกลาง | `config:globalConfigTitle` |
| Config (tab) | การตั้งค่า | `strings:tabs.config` |
| Data (tab) | ข้อมูล | `strings:tabs.data` |
| Translations (tab) | คำแปล | `strings:tabs.strings` |
| Compare (tab) | เปรียบเทียบ | `strings:tabs.compare` |
| Source AI review (tab) | รีวิวต้นฉบับด้วย AI | `strings:tabs` (review-source-ai) |
| Translation AI review (tab) | รีวิวคำแปลด้วย AI | `strings:tabs` (review-translation-ai) |
| Manual review (tab) | ตรวจทานเอง | `strings:tabs` (review-manual) |
| Quality | คุณภาพ | `strings:tabs.quality`, `strings:guide.topicQuality` |
| Glossary (tab) | อภิธานศัพท์ | `strings:tabs.glossary` |
| Category (tab) | หมวดหมู่ | `strings:tabs.category` |
| Routing (tab) | การจ่ายงาน | `strings:tabs.routing` |
| Activity | กิจกรรม | `strings:tabs.runs`, `strings:guide.topicActivity` |
| Stage details (tab) | รายละเอียดด่าน | `strings:tabs` (stage-details) |
| Orphans (tab) | รายการกำพร้า | `strings:tabs.orphans` |
| Backup (tab) | ข้อมูลสำรอง | `strings:tabs.backup` |
| Sharing (tab) | การแบ่งปัน | `strings:tabs.sharing` |
| Text Styler | ตัวแต่งข้อความ | `strings:tabs` (color-text) |
| Translation Memory | หน่วยความจำการแปล | `config:tm.policyTitle` |

The five sidebar group headings are settled here too, because `strings:guide.group*` ships
first and `sidebar:groups.*` must copy it byte for byte in a later batch:
`strings:guide.groupSetup`, `groupTranslate`, `groupReview`, `groupContent` and
`groupMaintenance`. Two of the five are deliberately a heading over its own child and both
are **proper substrings**, never equal to it: the Translate group is the bare verb over the
Translations tab's noun, and the Setup group avoids the Config tab's own word entirely.
`groupTranslationMemory` is identical to its single child, which English does on purpose and
every shipped locale reproduces.

## Keyboard key names

**Keep `Enter`, `Shift`, `Esc`, `Tab`, `Ctrl` and `Alt` in Latin.** A Thai keyboard is a
Latin QWERTY layout with Thai letters added to the same keycaps; the modifier and control
keys are engraved with the English words, not with Thai. Copying the English word is
therefore what `terminology.md`'s "write it as it is engraved" rule actually requires here,
exactly as it does for Russian — this is a positive decision, not an untranslated leftover,
and a reviewer scanning for stray English should not reopen it.

The same words translate normally when they are **not** key names: `enter your password`,
`enter edit mode` and the UI sense of *tab* are ordinary words. Read the string, not the
word.

## The six register and typography sweeps

Run these over every namespace before handing a batch to review. All six are greps and all
six must return nothing.

| Sweep | Thai instance |
| --- | --- |
| gendered politeness particles the register bans | `ครับ`, `ค่ะ`, `นะคะ` |
| "please" on a control label | `กรุณา` |
| the invisible character that breaks whitespace parity | U+200B |
| Thai digits where Arabic numerals are required | `[๐-๙]` |
| doubled spaces | `  ` |
| three-dot ellipses instead of the single character | `...` for `…` |
