# Style guide — Vietnamese (vi)

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**Bạn.** It is the neutral second person of Vietnamese software and the right match for an
informal-but-professional English source. `sidebar:selectProject` ("Select a project") is
"Chọn một dự án"; `vault:unlockDescription` ("Enter your password…") is "Nhập mật khẩu của
bạn…".

Do not use "quý khách" (commercial, reads like a bank), "anh/chị" (assumes the reader's
gender and age) or "mày/tao" in any circumstance.

Vietnamese drops the pronoun freely — prefer that in short strings. Instructions and button
labels both take the **bare verb**: "Chọn", "Lưu", "Xóa", "Hủy".

## Casing

Sentence case for every control, label, tab and page title. Vietnamese capitalizes the
first word and proper nouns only, so `config:routing.title` ("Routing Rules") becomes "Quy
tắc định tuyến". `english-review-notes.md` records that English Title Case on page titles is
a per-surface design convention with no meaning outside English.

Months are never capitalized: "tháng một" or "tháng 1", never "tháng Một". In a language
name only the proper noun takes a capital — "tiếng Việt", "tiếng Anh".

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "TRẠNG THÁI". Diacritics survive uppercasing and **must be kept** —
"TRANG THAI" is a different phrase, not a stylistic variant.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”`, matching the English source after its review.
- Ellipsis is the single character `…` (U+2026), matching `sidebar:searchProjects`
  ("Search projects…") — "Tìm kiếm dự án…".
- **Diacritics are mandatory, never optional.** Unaccented Vietnamese is not an informal
  register, it is unreadable. Write "sửa", not "sua".
- Use **precomposed (NFC) characters**. Decomposed sequences look identical on screen but
  compare unequal, which will make the whitespace and tag checks and any string search
  behave unpredictably.
- Tone-mark placement follows the **traditional style (kiểu cũ)**: "hòa", "thủy", "quý" —
  not the newer style (kiểu mới), which writes "hoà"/"thuỷ". Despite the names, the
  traditional placement is what Vietnamese software, dictionaries and publishing use, and
  it is what the input methods produce by default.
- Em dashes in the source stay em dashes with spaces around them.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. No space before `%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

Vietnamese runs **20–35% longer** than English — the widest expansion of the fourteen
locales — because every syllable is written as a separate space-delimited unit. "Translation
Memory" is two English words and four Vietnamese ones.

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.7× the English character count**, and keep chrome to
two or three syllables where you can: "Hoạt động" over "Lịch sử hoạt động", "Chất lượng"
over "Kiểm soát chất lượng". A long label does not clip — it wraps at a syllable boundary,
which reads as a typo.

The renderings used as examples above are illustrations of the length problem, not
decisions about wording. `terminology.md` owns the rendering of every domain term,
including the surface names and _translation memory_ — decide it there on first use,
record it, and then follow it here.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Vietnamese is comfortable here: nouns do not inflect and there are no articles.
The closing clause of `logs:translation.failedModuleDisabled` ("…the {{module}} module is
turned off"; the full string carries three tokens) becomes "Mô-đun {{module}} đã bị tắt".

**Do not put a classifier in front of a token** ("cái {{module}}") — the correct classifier
depends on the value, which is unknown. Put the real noun first and classify that instead.

**No plural marking after a numeral.** `category:countLabel_other` ("{{count}} entries") is
"{{count}} mục" — never "các mục" or "những mục" after a number.

**Vietnamese has exactly one plural category: `other`.** A plural family therefore supplies
`_other` and nothing else — never a `_one` copied across from English. A `_one` key can
never resolve here, and the key-parity guard rejects any suffix that is not a plural
category of the language, so copying English's pair is a red build, not a harmless
duplicate.

## Locale-specific traps

- **CAT-tool vocabulary is not settled in Vietnamese.** "Bộ nhớ dịch" for _translation
  memory_ and "bảng thuật ngữ" for _glossary_ are the common renderings, but they are not
  universal the way the Spanish or German equivalents are. Whatever you choose, record it in
  `terminology.md` on first use — the next translator will otherwise pick differently in
  good faith.
- **Sino-Vietnamese vs native register.** "Xóa" and "loại bỏ", "lưu" and "lưu trữ", "cài
  đặt" and "thiết lập" differ in formality, not meaning. Pick one per term; mixing them
  inside a namespace is the defect.
- **"Stage" is a game level.** Vietnamese gaming uses "màn" or keeps "stage"/"level"; "giai
  đoạn" is exactly the process reading `terminology.md` warns about.
- **"Judge"** takes the evaluative sense ("đánh giá"), never "thẩm phán"/"xét xử".
- **Loanword spelling.** Decide between the hyphenated transliteration ("mô-đun") and the
  bare English form ("module") once, per term, and record it — both are attested in
  Vietnamese software.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Vietnamese needs no parenthetical at all — the unmarked
  noun already covers every count.
