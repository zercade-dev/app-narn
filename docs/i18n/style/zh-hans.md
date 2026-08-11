# Style guide — Simplified Chinese (zh-hans)

This locale is **mainland Simplified Chinese**. Its Traditional counterpart, `zh-hant`, is
a separate translation with different vocabulary and different quotation marks — **never
produce one file by character-converting the other.** The differences are listed in the
traps section below.

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/zh-hans.md`. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**您, and usually no pronoun at all — a house decision, not a settled norm.** Mainland
Simplified localization is genuinely split here: developer-facing and younger-audience
products lean on 你 or on dropping the subject altogether, while much of the major
platform localization — Apple and Microsoft in zh-CN among them — uses 您. We chose 您
because that platform localization is the company this UI keeps, which makes 您 the
neutral second person here rather than a deferential one; 你 is defensible, and was the
earlier call. It is the same kind of decision `de.md` makes between _Sie_ and _du_:
defensible either way, and if it is reversed it must be reversed across every string at
once, not per string.

The practical risk is low, because the primary rule below is to drop the pronoun entirely,
which sidesteps the question in most strings.

Chinese drops the subject freely, so prefer that: `sidebar:selectProject` ("Select a
project") is "选择项目", with no pronoun. Use 您 only where possession genuinely has to be
marked: `vault:unlockDescription` ("Enter your password…") is "输入您的密码…".

Instructions and button labels both take the **bare verb**: "选择", "保存", "删除", "取消".
Do not use 请 on controls; reserve it for genuine requests such as a retry prompt.

## Casing

Chinese has no letter case. The English sentence-case / Title Case / uppercase distinctions
have nothing to map onto. `english-review-notes.md` records that the uppercase table header
`strings:columns.config` ("STATUS") shouts for a layout reason and that a language without
case should simply translate it — "状态".

Latin-script material inside a Chinese string (`API`, `CSV`, `AI`, provider and model ids)
keeps its English casing and stays half-width. Never use full-width Latin letters or
full-width digits.

## Punctuation and spacing

- Use full-width Chinese punctuation: ，。：；？！（）—— never the half-width ASCII forms
  inside Chinese text.
- **Quotation marks are “…” and ‘…’** — the Simplified convention. 「」 is Traditional and
  must not appear here. Where English quotes a value (`category:deleteConfirmBody_one`),
  Simplified Chinese writes “{{category}}”.
- Enumerations use the 顿号 、 between list items, not a comma.
- **Insert a half-width space between Chinese characters and adjacent Latin text or
  numerals**: "使用 {{module}} 模块", "共 {{count}} 个条目". This is the mainstream
  Simplified Chinese web convention and it materially improves legibility. Note that
  `zh-hant` follows the same rule and `ja` does not — in Japanese the absence of the space
  is itself the convention.
- **Ellipsis:** in prose sentences use the full-width Chinese ellipsis `……`. In short UI
  affordance labels — search placeholders and progress states such as `common:loading`
  ("Loading…") — keep the single `…`, because `……` doubles the width of a label whose whole
  purpose is to be unobtrusive. This split is a deliberate judgement call; apply it
  consistently.
- No space between Chinese characters themselves.

## Numbers and dates

Half-width Arabic numerals. Comma thousands, period decimal: `1,234.56`. No space before
`%` (the space rule above applies to words, not to the percent sign).

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

Simplified Chinese runs **much shorter** than English — roughly 0.4–0.6× the character
count — so none of the chrome surfaces are a constraint. Treat the English character count
as a generous ceiling and spend the room on precision rather than padding.

The surfaces that are tight in every other locale — sidebar items
(`sidebar:translationMemory`), tab labels (`strings:tabs.strings`), table column headers
(`strings:columns.config`), filter labels (`strings:filters.needsReview`), bulk-bar buttons
(`strings:bulk.approveSelected`) — should be **two to four characters** here. If a label
needs more than six, the wording is wrong, not the space.

The one real length risk is a long transliteration of a name that has a settled Chinese
compound; prefer the compound.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Chinese is comfortable here: nouns do not inflect, there are no articles and no gender.
The closing clause of `logs:translation.failedModuleDisabled` ("…the {{module}} module is
turned off"; the full string carries three tokens) becomes "{{module}} 模块已关闭。"

**Counted nouns take a measure word and no plural marking.**
`category:countLabel_other` ("{{count}} entries") is "{{count}} 个条目" — the 个 is not
optional. Pick one measure word per object type (个 for entries, 条 for records, 项 for
items) and keep it. Do not add 们.

**Chinese has exactly one plural category: `other`.** A plural family therefore supplies
`_other` and nothing else — never a `_one` copied across from English. A `_one` key can
never resolve here, and the key-parity guard rejects any suffix that is not a plural
category of the language, so copying English's pair is a red build, not a harmless
duplicate.

## Locale-specific traps

- **Vocabulary, not just characters, separates this file from `zh-hant`.** Use 软件 (not
  軟體), 程序 (not 程式), 项目 (not 專案), 默认 (not 預設), 内存 (not 記憶體), 质量 (not
  品質), 用户 (not 使用者), 网络 (not 網路), 数据 (not 資料), 文件 (not 檔案), 视频 (not
  影片), 导入/导出 (not 匯入/匯出). A character converter changes none of these, which is
  exactly why converting produces a file that is wrong in a way reviewers miss.
- **"模型" and "模板" resolve the collision cleanly** — 模型 is the AI model
  (`config:routing.labelModelOverride`), 模板 is the template (`config:templatesTitle`).
  Chinese is one of the few languages where `terminology.md`'s warning about this pair
  costs nothing; keep the two words strictly apart anyway.
- **"关卡" is correct for _stage_** — the gaming word for a playable level. 阶段 is exactly
  the process reading `terminology.md` warns about.
- **"Judge"** takes the evaluative sense (评估 / 评分), never 法官/审判.
- **Do not use Taiwan-only terms** even when they sound more precise; this file has one
  audience.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Chinese needs no parenthetical at all — number plus
  measure word already covers every count.
