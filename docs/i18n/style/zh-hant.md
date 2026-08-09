# Style guide — Traditional Chinese (zh-hant)

This locale targets **Taiwan** Traditional Chinese. Its Simplified counterpart, `zh-hans`,
is a separate translation with different vocabulary, different quotation marks and a
different register decision — **never produce this file by character-converting that one.**
A converter changes the characters and leaves mainland vocabulary in place, which produces
text that is technically Traditional and reads as foreign to every Taiwanese user.

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**您, though usually the subject is dropped entirely.** Taiwanese software localization
uses 您 as its neutral second person — it does not carry the deferential, customer-service
weight that makes it the wrong choice in `zh-hans`. This is a genuine divergence between the
two Chinese files, not an oversight: `zh-hans` decides on 你 and this file decides on 您.

Chinese drops the subject freely, so prefer that: `sidebar:selectProject` ("Select a
project") is "選擇專案", with no pronoun. Use 您 only where possession has to be marked:
`vault:unlockDescription` ("Enter your password…") is "請輸入您的密碼…".

Instructions and button labels take the **bare verb**: "選擇", "儲存", "刪除", "取消". 請
is acceptable in full sentences addressed to the user (Taiwanese UI copy uses it more
readily than mainland copy does) but never on a button label.

## Casing

Chinese has no letter case. The English sentence-case / Title Case / uppercase distinctions
have nothing to map onto. `english-review-notes.md` records that the uppercase table header
`strings:columns.config` ("STATUS") shouts for a layout reason and that a language without
case should simply translate it — "狀態".

Latin-script material inside a Chinese string (`API`, `CSV`, `AI`, provider and model ids)
keeps its English casing and stays half-width. Never use full-width Latin letters or
full-width digits.

## Punctuation and spacing

- Use full-width punctuation: ，。：；？！（）. In Traditional typography these marks are
  **centred in the em box**, so substituting a half-width ASCII comma or period is visibly
  wrong, not merely inconsistent.
- **Quotation marks are 「…」 with 『…』 nested inside** — the Taiwan convention. “…” is the
  Simplified convention and must not appear here. Where English quotes a value
  (`category:deleteConfirmBody_one`), Traditional Chinese writes 「{{category}}」.
- Enumerations use the 頓號 、 between list items, not a comma.
- Insert a half-width space between Chinese characters and adjacent Latin text or numerals:
  "使用 {{module}} 模組", "共 {{count}} 個項目".
- **Ellipsis:** in prose sentences use the full-width `……`. In short UI affordance labels —
  search placeholders and progress states such as `common:loading` ("Loading…") — keep the
  single `…`, because `……` doubles the width of a deliberately unobtrusive label. This split
  is a judgement call; apply it consistently, and identically to `zh-hans`.
- No space between Chinese characters themselves.

## Numbers and dates

Half-width Arabic numerals. Comma thousands, period decimal: `1,234.56`. No space before
`%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string, and no Minguo-era conversion should be attempted by hand.

## Length discipline

Traditional Chinese runs **much shorter** than English — roughly 0.4–0.6× the character
count — so no chrome surface is length-constrained. The constraint here is **legibility, not
width**: Traditional characters carry more strokes than their Simplified equivalents, so at
the small type sizes used in table headers and filter chips a dense four-character compound
can turn to mush. Prefer the two- or three-character form where one exists.

The surfaces to keep short — sidebar items (`sidebar:translationMemory`), tab labels
(`strings:tabs.strings`), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`), bulk-bar buttons (`strings:bulk.approveSelected`) — should
be two to four characters. If a label needs more than six, the wording is wrong, not the
space.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Chinese is comfortable here: nouns do not inflect, there are no articles and no gender.
The closing clause of `logs:translation.failedModuleDisabled` ("…the {{module}} module is
turned off"; the full string carries three tokens) becomes "{{module}} 模組已停用。"

**Counted nouns take a measure word and no plural marking.**
`category:countLabel_other` ("{{count}} entries") is "{{count}} 個項目" — the 個 is not
optional. Pick one measure word per object type (個 for entries, 筆 for records — note that
筆 is far more common in Taiwanese software than in mainland copy — 項 for items) and keep
it.

**Chinese has exactly one plural category: `other`.** A plural family therefore supplies
`_other` and nothing else — never a `_one` copied across from English. A `_one` key can
never resolve here, and the key-parity guard rejects any suffix that is not a plural
category of the language, so copying English's pair is a red build, not a harmless
duplicate.

## Locale-specific traps

- **Taiwan vocabulary, not mainland.** For the domain term _project_, use 專案, not 項目 —
  which is the mainland rendering of it. (項目 in its ordinary sense of "item" is perfectly
  good Traditional Chinese and is used in the measure-word example above; what is banned is
  項目 standing for _project_.) The rest of the list: 軟體 (not 軟件), 程式 (not 程序),
  預設 (not 默認/缺省), 記憶體 (not 內存), 品質 (not 質量), 使用者 (not 用戶), 網路 (not
  網絡), 資料 (not 數據), 檔案 (not 文件), 影片 (not 視頻), 匯入/匯出 (not 導入/導出), 儲存
  (not 保存), 執行 (not 運行). Every one of these survives a character conversion unchanged,
  which is why converting from `zh-hans` fails silently.
- **Hong Kong Traditional is a third variety.** It shares the characters but not all the
  vocabulary (網絡 rather than 網路, 硬碟 differences, different loanword transliterations).
  This file is Taiwan-targeted; record that in `terminology.md` if a Hong Kong variant is
  ever added.
- **模型 vs 模板 / 範本.** 模型 is the AI model (`config:routing.labelModelOverride`).
  Taiwanese usage prefers 範本 over 模板 for _template_ (`config:templatesTitle`); pick one,
  record it, and never let either drift onto the model.
- **"關卡" is correct for _stage_** — the gaming word for a playable level. 階段 is exactly
  the process reading `terminology.md` warns about.
- **"Judge"** takes the evaluative sense (評估 / 評分), never 法官/審判.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Chinese needs no parenthetical at all — number plus
  measure word already covers every count.
