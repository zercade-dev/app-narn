# Style guide — Korean (ko)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/ko.md`. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**해요체 for sentences, noun form for controls.**

- Messages, descriptions and instructions end in 해요체: `sidebar:selectProject` ("Select a
  project") is "프로젝트를 선택하세요", `vault:createDescription` ends in "…필요해요."
  해요체 is the register of modern Korean consumer and professional software, and it is the
  right match for an informal-but-professional English source. 합니다체 ("선택하십시오") is
  enterprise-formal and reads as a different product.
- **Buttons and labels take the bare noun form (명사형)**: `sidebar:create` is "만들기",
  `sidebar:cancel` is "취소", `strings:bulk.clearSelection` is "선택 해제". Never conjugate
  a button.

Never mix 해요체 and 합니다체 within one surface — the inconsistency is more visible in
Korean than a wrong word choice would be.

**Never write 당신.** Korean software does not address the user with a pronoun; drop it, or
use the possessive-free construction ("비밀번호를 입력하세요").

## Casing

Korean has no letter case, so the English sentence-case / Title Case / uppercase
distinctions have nothing to map onto. `english-review-notes.md` records that the uppercase
table header `strings:columns.config` ("STATUS") shouts for a layout reason and that a
language without case should simply translate it — "상태".

Latin-script material inside a Korean string (`API`, `CSV`, `AI`, provider and model ids)
keeps its English casing and stays half-width.

## Punctuation and spacing

- Use half-width `.` `,` `?` `!` with Korean text — not the full-width Japanese forms, and
  not 「」, which is Japanese quoting.
- Quoting a value uses 큰따옴표 “…”, with ‘…’ nested inside. Where English has
  `“{{category}}”` (`category:deleteConfirmBody_one`), Korean writes “{{category}}”.
- Use 가운뎃점 · for tight coordinate lists ("정확성·유창성·용어").
- Ellipsis is the single character `…` (U+2026) wherever the English source has it:
  `common:loading` ("Loading…") is "불러오는 중…".
- **띄어쓰기 (word spacing) is mandatory and is the most common Korean quality defect.**
  Dependent nouns take a space ("할 수 있어요", "삭제한 것"), auxiliary verbs take a space,
  and compound technical terms usually do too ("번역 메모리", not "번역메모리"). When in
  doubt, space it.
- Do not put a space before a particle — the particle attaches to the preceding word.

## Numbers and dates

Half-width Arabic numerals. Comma thousands, period decimal: `1,234.56`. No space before
`%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

Korean runs **shorter** than English — roughly 0.7–0.9× the character count — so the chrome
surfaces are rarely the constraint. Where they are, prefer the 한자어 compound over a long
native paraphrase: "번역 메모리" over "번역한 내용을 저장한 기록".

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).
Treat the English character count as the ceiling there rather than a target.

The renderings used as examples above are illustrations of the length problem, not
decisions about wording. `terminology.md` defines every domain term, including the surface
names and _translation memory_; `terminology/ko.md` holds the rendering. Decide the
rendering on first use, write its row there, and then follow it here.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

**The Korean hazard is particles.** 이/가, 은/는, 을/를 and 와/과 are chosen by whether the
preceding syllable ends in a consonant — and a token's value is unknown at translation
time, so a bare particle after `{{token}}` is a coin flip.

Two acceptable fixes, in order of preference:

1. **Put a real noun after the token** and attach the particle to that:
   the closing clause of `logs:translation.failedModuleDisabled` ("…the {{module}} module
   is turned off"; the full string carries three tokens) becomes "{{module}} 모듈이 꺼져 있어요" —
   "모듈" takes 이, the token stays bare.
2. Where no noun fits, use the doublet form — "{{name}}이(가)". It is ugly but correct, and
   Korean readers are used to it in software.

**Counted nouns take a counter and no plural marking.** `category:countLabel_other`
("{{count}} entries") is "{{count}}개" or "{{count}}건" — pick one counter per object type
and keep it. Do not add 들.

**Korean has exactly one plural category: `other`.** A plural family therefore supplies
`_other` and nothing else — never a `_one` copied across from English. A `_one` key can
never resolve here, and the key-parity guard rejects any suffix that is not a plural
category of the language, so copying English's pair is a red build, not a harmless
duplicate.

## Locale-specific traps

- **Loanword transliteration follows the standard orthography**, and the common
  misspellings are widespread enough to look right: "메시지" (not 메세지), "콘텐츠" (not
  컨텐츠), "데이터" (not 데이타), "라이선스" (not 라이센스), "플러그인" (not 플러그 인).
- **"스테이지" is correct for _stage_** — the gaming word for a playable level. "단계" is
  exactly the process reading `terminology.md` warns about.
- **"Judge"** takes the evaluative sense ("평가"), never 판사/재판.
- **한자어 or native word — decide per term and record it.** "저장" vs "보관", "삭제" vs
  "지우기", "설정" vs "환경 설정" are register choices, not synonyms to alternate between.
- **Do not carry the English period into a label.** "저장" takes no full stop; sentences do.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Korean needs no parenthetical at all — number plus
  counter already covers every count.
