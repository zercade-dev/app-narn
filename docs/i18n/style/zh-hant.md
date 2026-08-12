# Style guide — Traditional Chinese (zh-hant)

This locale targets **Taiwan** Traditional Chinese. Its Simplified counterpart, `zh-hans`,
is a separate translation with different vocabulary and different quotation marks —
**never produce this file by character-converting that one.**
A converter changes the characters and leaves mainland vocabulary in place, which produces
text that is technically Traditional and reads as foreign to every Taiwanese user.

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/zh-hant.md`. This file settles register, control shape, casing,
punctuation, length and placeholder handling.

**Citations in this file are checked.** `check-lexicon-citations.mjs` reads style guides as
well as lexicons: a rendering quoted next to a `namespace:key` reference is verified against
the shipped file, once that namespace exists for this locale. A quoted span next to a key in
a namespace that has *not* shipped yet is a **prescription** — it says what that key must
ship — and is skipped until it can be checked. An English word under discussion goes in
*italics*, never in quotes or backticks, or the guard reads it as a claim that this locale
ships English text.

## Register

**您, though usually the subject is dropped entirely.** Taiwanese software localization
uses 您 as its neutral second person: it is the Taiwan norm for professional software, not
a formality upgrade over the English source. What separates this file from `zh-hans` is
above all vocabulary and quotation marks — see the traps section — and neither of those
survives a character conversion.

Chinese drops the subject freely, so prefer that: `sidebar:selectProject` (*Select a
project*) is 「選擇專案」, with no pronoun. Use 您 only where possession or the addressee
genuinely has to be marked: `vault:unlockDescription` is 「請輸入您的密碼，以在這個工作階段中解密模組憑證。」

Instructions and button labels take the **bare verb or verb-object phrase**: `config:delete`
is 「刪除」, `config:continueImport` is 「繼續匯入」. 請 is acceptable in a full sentence
addressed to the user — Taiwanese UI copy uses it more readily than mainland copy does —
but never on a button label. `config:module.selectProjectFirst` (「請先選擇專案」) and
`config:routing.selectPlaceholder` (「— 請選擇 —」) are the shape it is for: an instruction
the user must act on before proceeding.

**The 您 / 你 decision was made once and applies to every string.** Sweep 1 below is the
check; it returns 0 over the finished locale. If it is ever reversed it must be reversed
everywhere at once, not per string.

## Control shapes — resolve the control before you translate the string

English writes the same words for a title, a button, a column header and a placeholder.
Chinese has no infinitive/deverbal-noun morphology to mark the difference with, so the
distinction is carried by **word choice and word order**, not by inflection. The shapes:

| Control | Shape | Worked example |
| --- | --- | --- |
| Page / section / dialog title | noun phrase, no trailing punctuation | `config:workspaceSettingsTitle` is 「工作區設定」 |
| Tab label, sidebar item | bare noun phrase, as short as the sense allows | `strings:tabs.compare` is 「對照」 |
| Button | bare verb, or verb + object | `config:downloadTemplate` is 「下載範本」 |
| Confirm-dialog title | the action as a verb phrase, identical to the button it confirms where English makes them identical | `config:confirmDeleteTitle` is 「刪除專案」 |
| Table column header | bare noun, 2–4 glyphs | `strings:columns.config` is 「狀態」 |
| Placeholder inside a control | verb phrase, keeping the trailing `…` where English has one | `config:enableModulePlaceholder` is 「選擇要啟用的模組…」 |
| Progress / status | 中 for in-flight, 已 for done — never a bare verb | `config:importing` is 「匯入中…」, `config:autoSaveSaved` is 「已儲存」 |
| Fragment rendered after a label | no sentence punctuation | `config:routing.anySource` is 「任一來源」 |

**The 已 / bare-verb split is load-bearing and one collision was fixed by it.**
`config:module.reasoningEffortDisabled` is a *value* inside a select and ships as 「已停用」,
while `config:disableModule` is the button beside it and ships as 「停用」. Both are painted
on the same module card; the state form is what keeps a dropdown option from reading as an
instruction.

**A verbal noun is not available as a distinguishing device here, and that is the honest
finding.** `config:models.select` (the picker's trigger) and `config:models.pickTitle` (its
dialog title) are byte-identical in English — the runbook's worked example of a pair most
languages separate. Traditional Chinese does not: 「選擇模型」 is the natural form of both,
and any wording that forced them apart would read as machine translation in one of the two
places. **Both ship as 「選擇模型」, deliberately.**

## Casing

Chinese has no letter case. The English sentence-case / Title Case / uppercase distinctions
have nothing to map onto. `english-review-notes.md` records that the uppercase table header
`strings:columns.config` shouts for a layout reason and that a language without case should
simply translate it — it ships here as 「狀態」. The same applies in the other direction to
the deliberately lowercase cell chips: `strings:compare.cellNeedsReviewBadge` is 「待審校」,
the same string as the sentence-case filter, and that is correct rather than a lost
distinction.

Latin-script material inside a Chinese string (`API`, `CSV`, `AI`, `LQA`, `token`, provider
and model ids) keeps its English casing and stays half-width. Never use full-width Latin
letters or full-width digits.

## Punctuation and spacing

- Use full-width punctuation: ，。：；？！（）. In Traditional typography these marks are
  **centred in the em box**, so substituting a half-width ASCII comma or period is visibly
  wrong, not merely inconsistent. `config:importFailed` is 「匯入失敗：{{message}}」.
- **Quotation marks are 「…」 with 『…』 nested inside** — the Taiwan convention. “…” is the
  Simplified convention and must not appear here; sweep 2b is the check. Where English
  quotes a value, Traditional Chinese uses corner brackets:
  `category:deleteConfirmBody_other` writes 「{{category}}」 and
  `config:instances.slugReserved` is 「「{{slug}}」是保留的模組 ID——請改用其他識別碼。」
- Enumerations use the 頓號 、 between list items, not a comma:
  `config:lqa.forbiddenPlaceholder` is 「術語1、術語2」.
- **The 破折號 is doubled and unspaced**: `config:lqa.lengthLimitSource` is
  「原文語言——不檢查」. A single spaced `—` is a typography defect here, with **one
  deliberate exception**: `config:routing.selectPlaceholder` ships 「— 請選擇 —」, where the
  dashes are a *decorative bracket* around an empty-select hint rather than punctuation
  joining two clauses. Doubling them would make a deliberately unobtrusive placeholder the
  widest thing in its row. Sweep 6 must not flag it.
- **Insert a half-width space between Chinese characters and adjacent Latin text or
  numerals**: `config:lqa.title` is 「LQA 檢查」 and `config:health.rateLimitRetries` is
  「429 重試：{{count}} 次」. **The space applies around a `{{token}}` too**, because a token
  renders as Latin text or a numeral: `config:routing.ruleCount_other` is 「{{count}} 條規則」.
  It does **not** apply when the neighbouring character is already punctuation —
  `config:importSnapshotNote` writes 「（{{date}}）」, with no space inside the full-width
  parentheses.
- **Ellipsis:** in prose sentences use the full-width `……`. In short UI affordance labels —
  search placeholders and progress states such as `common:loading` (「載入中…」) — keep the
  single `…`, because `……` doubles the width of a deliberately unobtrusive label. This split
  is a judgement call; apply it consistently, and treat it as coupled to `zh-hans` — if it is
  ever revisited, revisit both files together rather than letting them drift. No string in
  the finished locale needed the prose form.
- No space between Chinese characters themselves, and never two spaces anywhere.

## Numbers and dates

Half-width Arabic numerals. Comma thousands, period decimal: `1,234.56`. No space before
`%` — `config:health.successRate` is 「成功率 {{rate}}%」, spaced before the token and closed
up against the sign.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string, and no Minguo-era conversion should be attempted by hand.

## Length budgets — absolute rendered widths, never a multiple of English

> **CORRECTED TWICE, and both corrections are left visible on purpose.** The pre-flight seed
> of this file said: *"Traditional Chinese runs **much shorter** than English — roughly
> 0.4–0.6× the character count — so no chrome surface is length-constrained."* This locale
> then inherited a partial repair. The full correction:
>
> - **Wrong unit.** The constraint is *width*, not character count, and a full-width CJK
>   glyph carries about **twice** the advance of a Latin character (`backfill-notes.md`
>   section 10). So half the characters is roughly the *same width*.
> - **Wrong conclusion.** Measured over this finished locale, the 90th percentile of the
>   width ratio is **exactly 1.00** and **99 of 1,879 keys are wider than their English
>   source**. "No chrome surface is length-constrained" was false.
> - **Right about the character count, and that is the misleading part.** 0.39 in characters
>   is real; it is also the number that makes a CJK locale look unconstrained. Read the width
>   row.

Counted in **rendered glyphs**, with the convention stated because the figures move with it:
a full-width character is **1**, a half-width Latin character or digit is **0.5**, and a
`{{token}}` counts as the three digits it can show, i.e. **1.5**. That is what the container
has to fit.

**The measured expansion, in both units, over all 1,879 shared keys** — which is every key
this locale has, since it carries none English lacks, so the two populations the runbook
warns about coincide here:

| Unit | Aggregate | Median | 90th percentile | Max |
| --- | --- | --- | --- | --- |
| Characters | 0.3932 | 0.3571 | 0.6154 | 1.2083 |
| **Rendered width** | **0.6749** | **0.6667** | **1.0000** | **2.0000** |

Reproduce over `packages/frontend/src/locales`, one ratio per shared key, scoring a
full-width character 1, a half-width one 0.5 and a `{{token}}` 1.5. These land within a
percent of `zh-hans` on both rows (0.3920 / 0.6890), which is the expected result: the two
scripts differ in strokes, not in glyph count.

| Class | Anchor key | Kind | Budget | Basis |
| --- | --- | --- | --- | --- |
| Sidebar item — **including every `strings:tabs.*` label** | `sidebar:globalConfig`, `strings:tabs.backup` | **hard** — fixed `16rem`, `truncate` | **13** | Derived from the component and re-verified for this locale. `SIDEBAR_WIDTH` is `16rem` = 256px (`components/ui/sidebar.tsx:34`), less the 1px `border-r` (`:239`), less `SidebarGroup`'s `p-2` (16px, `:379`), less `SidebarMenuButton`'s `p-2` (16px) and `gap-2` (8px) and `[&_svg]:size-4` icon (16px) (`:467`) = **199px**. The label is a `<span className="truncate">` in that button. At `text-sm` (14px) a full-width glyph advances 1em = 14px, so 199 ÷ 14 = 14.2 glyphs fit; **13** leaves one glyph of headroom |
| In-panel sub-tab label | `config:routing.tabRules` | soft | **7** | Measured over all 9 members (`config:routing.tab*` plus the six `console:filter_*`). Max **5.5**, a two-way tie at `config:routing.tabRules` / `config:routing.tabTemplates` (both carry a `{{count}}`); median 2 |
| Table column header | `strings:columns.config` | soft | **6** | Measured over all 48 headers across eight namespaces. Max **5** at `collab:sharing.columnLanguages` 「可編輯語言」, which is fixed by the *writable language* term and would outrank a budget anyway; median 2. The anchor is 「狀態」 at 2 |
| Filter label | `strings:filters.needsReview` | soft | **11** | Measured over all 26 members. Max **9** at `strings:filters.newOnly` 「新（來自上次匯入）」, next 8.5 at `strings:filters.lqaFailed` and `strings:filters.clearNewFlags`; median 4. The anchor 「待審校」 is 3 |
| Bulk-bar control | `strings:bulk.approveSelected` | soft | **12** | Measured over the controls the bulk bar renders. Max **10** at `strings:bulk.generateGlossaryFromSelection` 「從選取範圍生成術語表」, next 9 at its category sibling; median 4. The anchor 「核准存入記憶庫」 is 7. Notices and status sentences in the same key range (`batch:savedRulesNotice`, `batch:runCompleted*`) are deliberately **not** in this class |
| Swatch chip label | `colorText:swatches.hydro` | **hard** — `max-w-24` + `truncate` | **8** | Derived from the component. `PaletteSection.tsx:39` puts the label in a `<span className="max-w-24 truncate">` inside a `text-xs` chip: 96px ÷ 12px = **8** full-width glyphs. Measured max is **3** |
| Palette group caption | `colorText:groupElements` | soft | **9** | Derived from the component. `PaletteSection.tsx:78` and `:93` put each caption in a `w-28 shrink-0` `text-xs` span: 112px ÷ 12px = 9.33, taken down to **9**. Soft because `w-28` is a fixed width with no grow, so an over-long caption wraps and makes the row taller rather than clipping. Measured max is **4** |

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, never distort a term to hit
the number, and never read the figure as a failure threshold. **A term rule outranks the
budget**: 分派規則 stays four glyphs where 規則 would fit better, because the *routing rule*
row rules out the shorter form.

**Every measured maximum sits well inside its budget, and the hard classes are not close.**
The widest sidebar-class label is 6 glyphs (`strings:tabs.review-source-ai` 「原文 AI 審閱」
and its translation twin, plus 「文字樣式工具」) against a hard budget of 13 and a container
of 199px — under half the space available. Nothing in this locale needed shortening to fit,
and nothing was shortened.

**The legibility point stands and is separate from width.** Traditional characters carry more
strokes than their Simplified equivalents, so at the small type sizes used in table headers
(`text-xs`, 12px) and filter chips a dense four-character compound can turn to mush. Prefer
the two- or three-character form where one exists — which is why the column headers land at a
median of 2 rather than merely inside 6.

**The guard's own length rule is a different, cruder thing** and this locale will never
approach it: `MAX_LENGTH_RATIO` is 2.5× the English *character* count, and this locale runs
0.39. No `LENGTH_EXEMPTIONS` entry was needed or requested.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may change
freely; every token in the English string must appear exactly once, and no token may be
added.

Chinese is comfortable here: nouns do not inflect, there are no articles and no gender, so a
token can sit anywhere. `config:credentialsMissing` is
「缺少憑證——請設定保險庫項目：{{keys}}」, which moves the token to the end where English has
it after a dash.

### Counted nouns: the measure word is the decision, and it is per object

**Chinese marks no plural. What it does require is a measure word (量詞) between the numeral
and the noun, and choosing the wrong one is the equivalent of a wrong plural form** — it is
lexical, per counted object, and no regex can check it. This table is what
`NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES` in `scripts/i18n-preflight.mjs` points at as this
locale's real numeral hazard. Pick from it and keep it:

| Counted object | Measure word | Worked example |
| --- | --- | --- |
| entry (條目) | 個 | `category:countLabel_other` is 「{{count}} 個條目」 |
| CSV row | 列 — **not 行**; Taiwan reads 列 as a row and 欄 as a column, the opposite of mainland usage | `config:rowsProcessed` is 「已處理 {{count}} 列」 |
| routing rule | 條 | `config:routing.ruleCount_other` is 「{{count}} 條規則」 |
| glossary, module, instance, cell, backup, term | 個 | `config:glossariesSkipped_other` is 「已停用 {{count}} 個術語表」 |
| a stored record — translation, memory entry, vault action | 筆 | `config:tm.clearAllSuccess_other` is 「已清除 {{count}} 筆記憶庫項目」. **筆 is far more common in Taiwanese software than in mainland copy** |
| language | 種 | `config:routing.langsMore_other` is 「另有 {{count}} 種」 |
| attempt, retry, run | 次 | `config:health.lqaRetries` is 「LQA 重試：{{count}} 次」 |
| a finding, a job, a discrete operation | 項 | `logs:sourceReview.done` is 「原文審閱找到 {{findings}} 項缺失。」 |
| a suggestion, a navigable record in a queue | 則 | `strings:runs.judgeApproveAllSuccess` is 「已套用 {{applied}} 則建議」 |

Never add 們. Where a count is displayed with no noun after it at all — an import-result chip
such as `config:new` (「新增 {{count}}」) — no measure word is needed and none should be
invented.

### Non-`count` numeric tokens

Only `{{count}}` drives plural selection, and Chinese needs no selection anyway — but the
runbook's count-neutral rule still binds this locale for a different reason: **a non-`count`
token must sit in a frame that is true at every value.** Chinese gets this almost for free,
because the measure-word construction is already count-neutral.

Three keys needed a deliberate frame anyway, all recorded in `english-review-notes.md`:

- `config:templateMeta` reads *1 languages · 1 routing rules* in English for a one-language
  template. It ships here as 「語言數：{{languages}} · 分派規則數：{{rules}}」 — the 數 turns
  each into a labelled quantity behind a colon, true at every value including 1.
- `strings:runs.stringsProgress` counts *jobs*, not entries, and names entries in English.
  It ships as 「已完成：{{completed}} / {{total}}」 — a frame that names nothing counted, per
  the note's instruction not to ship the false claim.
- `batch:progressAriaLabel` does the same for the same reason: 「已翻譯 {{completed}} / {{total}}」.

`logs:translation.queued` also counts jobs rather than entries, and ships as
「已將 {{total}} 項翻譯工作排入佇列。」 — 工作 rather than 條目, so the number is true on a
multi-language run.

## Plurals — one category, and the `_one` key is a build failure

**Traditional Chinese has exactly one CLDR plural category: `other`.** Verified, not assumed:
`new Intl.PluralRules('zh-Hant').resolvedOptions().pluralCategories` returns `["other"]`, and
`scripts/locale-rules.mjs` maps the directory name `zh-hant` to that tag in `BCP47_TAGS`.

So a plural family here supplies **`_other` and nothing else**. Copying English's `_one`
across is a **hard guard failure by design**: `pluralFamilyErrors()` rejects any suffix that
is not a category of the language, because such a key can never be selected.

**Two consequences a single-category language gets backwards.**

- A `bare + _other` family — the twelve English families with no `_one` at all — keeps
  **both** keys: the bare key is a plain key in English and must exist, and `_other` is the
  one category. Because `_other` is selected at *every* count including 1, **both members
  must be count-neutral**, and where English's only difference is plural marking the two
  Chinese strings are legitimately identical (`vault:retryFailed` and `vault:retryFailed_other`
  are the same string, and `vault:retryFailed` carries no token in either form, so no form of
  ours may add a number).
- The whole-language key count therefore lands at **1,879** — English's 1,908 minus the 29
  `_one` keys. `ja`, `ko` and `zh-hans` each shipped exactly 1,879, which is the check on this
  claim. `strings:bulk.removeCategoryApply_zero` is kept: `_zero` resolves in every locale.

## Surface names — one rendering, repeated verbatim

| Surface | Rendering | Owning key | Also owed by |
| --- | --- | --- | --- |
| Translations | 譯文 | `strings:tabs.strings` | named in prose by `config:routing.categoriesConfiguredHint`, `category:subtitle`, `category:empty`, `category:noEntriesInCategory`; `strings:guide.topicMultiLanguage` |
| Compare | 對照 | `strings:tabs.compare` | named in prose by `config:routing.tonesHint`, `strings:order.presortHint`; `strings:guide.topicCompare` |
| Backup | 備份 | `strings:tabs.backup` | named in prose by `config:importSnapshotNote`; `backup:createSection`; `strings:guide.topicBackup` |
| Orphans | 孤立條目 | `strings:tabs.orphans` | `orphans:title`; named in prose by `config:fullReplaceOrphanNotice` |
| Global Config | 全域設定 | `sidebar:globalConfig` | `config:globalConfigTitle` — English makes these word-for-word identical and they must stay so |
| Activity | 活動 | `strings:tabs.runs` | `strings:guide.topicActivity`; the page title expands to 「翻譯活動」 (`strings:runs.title`) |
| Sharing | 共用 | `strings:tabs.sharing` | `collab:sharing.pageTitle` |
| Stage details | 關卡詳情 | `strings:tabs` (stage-details) | `stage-details:title` |
| Text Styler | 文字樣式工具 | `strings:tabs` (color-text) | `colorText:title`, `sidebar:colorText` |
| Source AI review | 原文 AI 審閱 | `strings:tabs` (review-source-ai) | `review:sourceAi.configTitle` |
| Translation AI review | 譯文 AI 審閱 | `strings:tabs` (review-translation-ai) | `review:translationAi.title` |
| Quality | 品質 | `strings:tabs.quality` | `strings:guide.topicQuality`; the dashboard title expands to 「品質儀表板」 |
| Legal | 法律 | `sidebar:legal` | the page title expands to 「法律與政策」 (`legal:title`) |

The word for *tab* in prose is **分頁** — the Taiwan word, where mainland copy writes
标签页: `config:importSnapshotNote` is
「本次匯入前已建立安全快照（{{date}}）。您可以在備份分頁中還原它。」

**Three English defects are handled and must not be re-introduced.**
`config:fullReplaceOrphanNotice` calls the Orphans tab the *Relink tab*, which does not
exist; it ships with the Orphans rendering. `config:routing.simplePlaceholder` labels a
module picker *Provider*; per the frozen lexicon it is translated as written and ships as
「選擇供應商」, without dragging 模組 anywhere. And `logs:action.openQuality` says *Open
quality settings* for a control that opens a read-only dashboard; it ships as
「開啟品質儀表板」.

### The nesting decisions, and why each is licensed

The five sidebar group headings render *over* their tabs (`Sidebar.tsx`), so a heading and
its first child are painted together. Each was checked against the runbook's rule that
**equality is never licensed**:

- **專案設定** over 設定 / 資料 / 共用 — a proper substring of its own child, which is the
  heading-over-child licence. This is why `strings:tabs.config` could keep the plain 設定.
- **翻譯** over 譯文 / 對照 / 分派 / 活動 / 關卡詳情 — distinct words, not a substring
  relation. This is the pair Japanese had to be warned about (both *Translate* and
  *Translations* collapse to 翻訳 there); Chinese separates the verb 翻譯 from the noun 譯文
  for free.
- **審核** over 原文 AI 審閱 / 譯文 AI 審閱 / 人工審校 / 品質 — three review words sharing 審
  and differing in the head, so the umbrella is neither equal to nor a substring of any
  member.
- **術語** over 術語表 / 類別 / 文字樣式工具 — root over its own compound, the second
  structural licence.
- **維護** over 孤立條目 / 備份 — unrelated words.

**Two collisions were repaired rather than licensed, and both were found by co-render
reasoning rather than by a guard.**

- `strings:runs.typeTranslation` (*Translation*, a run type) would have been 翻譯 — **equal**
  to the always-visible sidebar group heading it sits under. It ships as 「翻譯執行」.
- `colorText:groupQuality` (*Quality*, the swatch group for item-rarity colours) would have
  been 品質 — equal to `strings:tabs.quality`, which is in the sidebar whenever the Text
  Styler is open. It ships as 「品階」, the Taiwanese gaming word for a rarity tier, which is
  also the more accurate reading of what those swatches colour.

`strings:runs.judgeTargetLabel` (*Translation*) **is** 譯文, equal to `strings:tabs.strings`,
and that one is licensed rather than repaired: it is a field label rendered directly beneath
「原文」 in a source/translation pair, which is the strongest disambiguator available, and
any other rendering would name the object worse. Recorded here so a reviewer does not
reopen it.

`strings:bulk.removeCategory` and `strings:bulk.removeCategoryApply_zero` are both
「移除類別」. Checked at the component rather than argued: `StringTableBulkBar.tsx` renders
them under `bulkOpMode === 'menu'` and `bulkOpMode === 'remove-category'`, which are mutually
exclusive states of one popover, so they can never be painted together.

## Locale-specific traps

- **Taiwan vocabulary, not mainland.** For the domain term *project*, use 專案, not 項目 —
  which is the mainland rendering of it. (項目 in its ordinary sense of *item* is perfectly
  good Traditional Chinese; what is banned is 項目 standing for *project*, and this locale
  keeps it out of the *entry* row too, which takes 條目.) The rest of the list: 軟體 (not
  軟件), 程式 (not 程序), 預設 (not 默認/缺省), 記憶體 (not 內存), 品質 (not 質量), 使用者
  (not 用戶), 網路 (not 網絡), 資料 (not 數據), 檔案 (not 文件), 影片 (not 視頻), 匯入/匯出
  (not 導入/導出), 儲存 (not 保存), 執行 (not 運行), 佇列 (not 队列), 實例 (not 实例的
  mainland collocations), 群組 (not 组), 搜尋 (not 搜索), 資訊 (not 信息), 內嵌 (not 内联).
  Every one of these survives a character conversion unchanged, which is why converting from
  `zh-hans` fails silently.
- **列 and 欄 are reversed against mainland usage.** Taiwan reads 列 as a *row* and 欄 as a
  *column*; mainland copy uses 行 for a row and 列 for a column. `config:rowsProcessed`
  counts 列 and `config:unknownHeadersTitle` is 「無法辨識的欄標題」. A converter cannot see
  this, and getting it backwards inverts the meaning of every CSV message.
- **Hong Kong Traditional is a third variety.** It shares the characters but not all the
  vocabulary (網絡 rather than 網路, different loanword transliterations). This file is
  Taiwan-targeted; if a Hong Kong variant is ever added it needs its own directory, not an
  edit here.
- **模型 vs 範本.** 模型 is the AI model (`config:routing.labelModelOverride`); Taiwanese usage
  prefers 範本 over 模板 for *template* (`config:templatesTitle` is 「專案範本」), and that
  preference resolves the terminology file's model/template warning at no cost, because the
  two words share no character.
- **「關卡」 is correct for *stage*** — the gaming word for a playable level. 階段 is exactly
  the process reading `terminology.md` warns about. Spending 關卡 there is what pushed
  *quality gate* onto 把關.
- **路由 is banned for *routing rule*.** In Chinese it means network routing without
  qualification (a router is 路由器). The whole `config:routing.*` subtree ships on 分派
  instead — `config:routing.title` is 「分派規則」 and `config:routing.routesTo` is 「分派至」.
- **代理 alone reads as *proxy*.** `config:routing.sectionAgentSettings` (*Agent settings*)
  ships as 「AI 代理設定」: bare 代理 in Taiwanese tech copy names a proxy server, which would
  make an AI prompt section look like a network setting. The AI qualifier reproduces the
  effect the English has on its own reader rather than adding information.
- ***Judge* takes the evaluative sense** (評分), never 法官 or 審判.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms where
  English writes *entr(ies)*. Chinese needs no parenthetical at all — number plus measure word
  already covers every count.

## Register and typography sweeps

Six greps over `packages/frontend/src/locales/zh-hant/`, run before every review. **All six
were clean over the finished 1,879-value locale.**

| Sweep | What to look for | Result |
| --- | --- | --- |
| 你 where the register calls for 您 or no pronoun | `你` anywhere | 0 |
| Simplified-only characters | see the warning below before writing this one | 0 |
| Simplified curly quotes | `“ ” ‘ ’` anywhere | 0 |
| Half-width ASCII punctuation inside Chinese text | `,` `.` `:` `;` `?` `!` `(` `)` between two Han characters | 0 |
| Doubled spaces | two consecutive spaces anywhere | 0 |
| Three-dot ellipsis instead of the single character | `...` for `…` | 0 |
| Single or spaced dashes used as punctuation | ` - ` and a lone `—` between clauses | 1, licensed (see below) |

> **The Simplified sweep is the one that will lie to you, and it lied here too — in a
> different way from `zh-hans`.** That locale's warning is that a class built from Traditional
> *words* sweeps in the characters those words share with Simplified, and that the class must
> be built from single characters instead. This locale built it from single characters and
> still got 48 false hits, because a published "simplified characters" list contains **merge
> targets that are themselves perfectly good Traditional characters**: the whole 48 came from
> exactly three of them — 回 (回應、返回), 准 (核准, a real Traditional character distinct from
> 準) and 台 (一台、主控台). Removing those three from a 1,956-character class returned **0**.
> So the rule is stronger than "build it from characters": **inspect the characters that
> actually matched before believing any hit**, because a Simplified list is a list of
> *simplifications*, and some simplifications are merges onto a character the target script
> already uses.

**One dash exception is licensed**, and sweep 6 must not flag it:
`config:routing.selectPlaceholder` ships 「— 請選擇 —」, where the dashes bracket an
empty-select hint decoratively. Everywhere else the 破折號 is doubled and unspaced.

The missing-space check is a seventh thing to look at and is deliberately **not** a gate: a
Han character directly against a Latin letter or digit is usually a defect and sometimes
correct. Over the finished locale it returns exactly one hit, and that hit is **licensed**:
`config:lqa.forbiddenPlaceholder` is 「術語1、術語2」, a sample of what the user should type,
where a space would read as part of the value rather than as typography.

## Collisions — the licensed ones, so nobody re-opens them

**Run `node scripts/i18n-preflight.mjs zh-hant` for the live list — that command is the
figure, not the numbers below.** At the sweep it reported **11** same-English/different-rendering
groups and **47** same-rendering/different-English groups; both move whenever any string in
this locale changes, and both moved by one while the sweep's own fixes were being applied.
The licences that are not obvious:

- **Five same-English splits are required by a frozen term**: *Discard* splits 捨棄 / 拒絕
  (the two senses the `discard` row defines), *Dismiss* splits 清除 / 關閉 (one deletes, one
  does not), *Pending* splits 待接受 / 待處理 (an invite status against a run status),
  *Failed* splits 未通過 / 已失敗 (a check verdict against a run outcome), and *Translation*
  splits 譯文 / 翻譯執行 (the translated text against a run type — see the nesting section).
- *Export CSV* splitting 「CSV 匯出」 / 「匯出 CSV」 is the control-shape rule working:
  `config:exportCsv` is a card **title** and `glossary:exportCsv` is a **button**, which
  `english-review-notes.md` states explicitly, and Chinese marks that difference by word
  order.
- *Generating…* splits 「產生中…」 (`collab:invites.generating`, minting an invite code) /
  「生成中…」 (`glossary:generateRunning`, an AI run). Taiwanese usage reserves 生成 for
  generative AI; using it for a random code would overclaim.
- *Size* splits 「字級」 (`colorText:formatSize`, a font size) / 「大小」
  (`config:models.colSize`, a model's file size), and *Text* splits 「純文字」
  (`console:exportFormatText`, an export format beside JSON) / 「文字」
  (`strings:runs.manualStringColumn`, a column of content).
- *Next* splits 「下一則」 (a record navigator) / 「下一頁」 (`strings:pagination.next`, a page
  pager).
- **Most same-rendering groups are English singular/plural or casing pairs** that Chinese
  cannot and should not express — *Categories*/*Category*, *Members*/*Member*,
  *Status*/*STATUS*, *Credential Vault*/*Credential vault*. Collapsing them is correct, not
  lossy. A further twelve are the `bare + _other` families, where a single-category language
  is *required* to ship one count-neutral string for both.
- `category:runFailed` and `logs:categoryGen.failed` render identically on purpose — both are
  「類別生成失敗。」 `english-review-notes.md` requires the pair to be one event, against an
  English split its own glossary sibling contradicts.
- **Three collisions this sweep caught and that were fixed rather than licensed:**
  `stage-details:stale` was 已過期, colliding with the *Expired* invite status — a translation
  is out of date with its source, not out of time, so it is now 「已過時」.
  `config:module.reasoningEffortDisabled` was the bare verb 停用, sitting on the same card as
  the *Disable* button, and is now the state form 「已停用」. And `logs:backup.restored` was
  written subject-first, in the log register, against a byte-identical English toast
  (`backup:toastRestoreSuccess`) written action-first — English makes them one string, so the
  split was ours; both now ship as 「已還原備份。」 (Note the shape of that last sentence: the
  rejected rendering is described rather than quoted, because a quoted span beside a key is a
  claim that this locale ships it, and the citation guard rightly failed a first draft that
  quoted it.)
