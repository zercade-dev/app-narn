# Style guide — Simplified Chinese (zh-hans)

This locale is **mainland Simplified Chinese**. Its Traditional counterpart, `zh-hant`, is
a separate translation with different vocabulary and different quotation marks — **never
produce one file by character-converting the other.** The differences are listed in the
traps section below.

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/zh-hans.md`. This file settles register, control shape, casing,
punctuation, length and placeholder handling.

**Citations in this file are checked.** `check-lexicon-citations.mjs` reads style guides as
well as lexicons: a rendering quoted next to a `namespace:key` reference is verified against
the shipped file, once that namespace exists for this locale. A quoted span next to a key in
a namespace that has *not* shipped yet is a **prescription** — it says what that key must
ship — and is skipped until it can be checked. Both are written the same way here on
purpose. An English word under discussion goes in *italics*, never in quotes, or the guard
reads it as a claim that this locale ships English text.

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

Chinese drops the subject freely, so prefer that: `config:selectAll` is “全选”, with no
pronoun, and `config:module.selectProjectFirst` is “请先选择项目”. Use 您 only where
possession or the addressee genuinely has to be marked: `config:enableModuleHelp` is
“添加可在您所有项目中使用的 AI 或翻译服务商。”

Instructions and button labels both take the **bare verb or verb-object phrase**:
`config:delete` is “删除”, `config:continueImport` is “继续导入”, `config:cancelImport` is
“取消”. Do not use 请 on a control; reserve it for a genuine request or an instruction the
user must act on before proceeding, which is what `config:module.selectProjectFirst` and
`config:routing.selectPlaceholder` (“— 请选择 —”) are.

## Control shapes — resolve the control before you translate the string

English writes the same words for a title, a button, a column header and a placeholder.
Chinese has no infinitive/deverbal-noun morphology to mark the difference with, so the
distinction is carried by **word choice and length**, not by inflection. The shapes:

| Control | Shape | Worked example |
| --- | --- | --- |
| Page / section / dialog title | noun phrase, no trailing punctuation | `config:workspaceSettingsTitle` is “工作区设置” |
| Tab label, sidebar item | bare noun phrase, as short as the sense allows | `config:routing.tabRules` is “规则（{{count}}）” |
| Button | bare verb, or verb + object | `config:downloadTemplate` is “下载模板” |
| Confirm-dialog title | the action as a verb phrase, identical to the button it confirms where English makes them identical | `config:confirmDeleteTitle` is “删除项目” |
| Table column header | bare noun, 2–4 glyphs | `config:models.colProcessor` is “处理器” |
| Placeholder inside a control | verb phrase with a trailing `…` where English has one | `config:enableModulePlaceholder` is “选择要启用的模块…” |
| Progress / status | 中 for in-flight, 已 for done — never a bare verb | `config:importing` is “导入中…”, `config:autoSaveSaved` is “已保存” |
| Fragment rendered after a label | no sentence punctuation, no leading capital equivalent | `config:routing.anySource` is “任意来源” |

**A verbal noun is not available as a distinguishing device here, and that is the honest
finding.** `config:models.select` (the picker's trigger, `ModelPicker.tsx:616`) and
`config:models.pickTitle` (its `DialogTitle`, `:656`) are byte-identical in English and
resolve to two different controls — the runbook's worked example of a pair that most
languages separate. Simplified Chinese does not: 选择模型 is the natural, idiomatic form of
both a picker's empty-state label and a picker dialog's own title, and any wording that
forced them apart (a nominalised 模型选择 for the title, say) would read as machine
translation in one of the two places. **Both ship as “选择模型”, deliberately.** Do not
"fix" this into a distinction the language does not make.

## Casing

Chinese has no letter case. The English sentence-case / Title Case / uppercase distinctions
have nothing to map onto. `english-review-notes.md` records that the uppercase table header
`strings:columns.config` shouts for a layout reason and that a language without case should
simply translate it — it ships here as 状态.

Latin-script material inside a Chinese string (`API`, `CSV`, `AI`, `LQA`, provider and model
ids, `token`) keeps its English casing and stays half-width. Never use full-width Latin
letters or full-width digits.

## Punctuation and spacing

- Use full-width Chinese punctuation: ，。：；？！（）—— never the half-width ASCII forms
  inside Chinese text. `config:importFailed` is “导入失败：{{message}}”, with the full-width
  colon.
- **Quotation marks are “…” and ‘…’** — the Simplified convention. 「」 is Traditional and
  must not appear here. Where English quotes a value, Simplified Chinese quotes it the same
  way: `config:instances.slugReserved` is ““{{slug}}”是保留的模块 ID——请换一个标识符。”
- Enumerations use the 顿号 、 between list items, not a comma:
  `config:lqa.forbiddenPlaceholder` is “术语1、术语2”.
- **The em dash is doubled and unspaced**: `config:lqa.lengthLimitSource` is “源语言——不检查”.
  A single spaced `—` is a typography defect here, with **one deliberate exception**:
  `config:routing.selectPlaceholder` ships “— 请选择 —”, where the dashes are a *decorative
  bracket* around an empty-select hint rather than punctuation joining two clauses. Doubling
  them to ——请选择—— would make a deliberately unobtrusive placeholder the widest thing in
  its row. Sweep 6 below must not flag it.
- **Insert a half-width space between Chinese characters and adjacent Latin text or
  numerals**: `config:lqa.title` is “LQA 检查” and `config:health.rateLimitRetries` is
  “429 重试：{{count}} 次”. This is the mainstream Simplified Chinese web convention and it
  materially improves legibility. Note that `zh-hant` follows the same rule and `ja` does
  not — in Japanese the absence of the space is itself the convention.
  **The space applies around a `{{token}}` too**, because a token renders as Latin text or a
  numeral: `config:routing.ruleCount_other` is “{{count}} 条规则”. It does **not** apply when
  the neighbouring character is already punctuation — `config:importSnapshotNote` writes
  “（{{date}}）”, with no space inside the full-width parentheses.
- **Ellipsis:** in prose sentences use the full-width Chinese ellipsis `……`. In short UI
  affordance labels — search placeholders and progress states such as `config:importing`
  (“导入中…”) — keep the single `…`, because `……` doubles the width of a label whose whole
  purpose is to be unobtrusive. This split is a deliberate judgement call; apply it
  consistently. No string in `config` needed the prose form.
- No space between Chinese characters themselves, and never two spaces anywhere.

## Numbers and dates

Half-width Arabic numerals. Comma thousands, period decimal: `1,234.56`. No space before
`%` — `config:health.successRate` is “成功率 {{rate}}%”, spaced before the token and closed
up against the sign.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length budgets — absolute glyph counts, never a multiple of English

Counted in **rendered glyphs**, with the convention stated because the figures move with it:
a full-width character is **1**, a half-width Latin character or digit is **0.5** (a
full-width glyph carries about twice the advance of a Latin one — measured, see
`backfill-notes.md`), and a `{{token}}` counts as the three digits it can show, i.e. **1.5**.
That is what the container has to fit. **Never scale a budget from the character-expansion
ratio**: this locale contracts hard against English in characters and does not contract at
all in width.

| Class | Anchor key | Kind | Budget | Basis |
| --- | --- | --- | --- | --- |
| Sidebar item — **including every `strings:tabs.*` label** | `sidebar:globalConfig`, `strings:tabs.backup` | **hard** — fixed `16rem`, `truncate` | **13** | Derived from the component. `SIDEBAR_WIDTH` is `16rem` = 256px (`components/ui/sidebar.tsx:34`), less the 1px `border-r`, less `SidebarGroup`'s `p-2` (16px), less `SidebarMenuButton`'s `p-2` (16px), less the `size-4` icon (16px), less `gap-2` (8px) = **199px**. The label is a `<span className="truncate">` inside that button (`components/layout/Sidebar.tsx:787`). At `text-sm` (14px) a full-width glyph advances 1em = 14px, so 199 ÷ 14 = 14.2 glyphs fit; **13** leaves one glyph of headroom |
| In-panel sub-tab label | `config:routing.tabRules` | soft | **13** | Same derivation as the sidebar row, applied to a row that scrolls rather than truncates. The `config` members measure 3.5–5.5 with their count token: `config:routing.tabImportExport` is “导入 / 导出” at 5.5, the longest. **Provisional until batch 5** — the class also contains the six `console:filter_*` tabs, which have not shipped; re-derive over all nine at the whole-language sweep, per runbook 2.4 |
| Table column header | `strings:columns.config` | soft | **8** | **Provisional — measured over `config`'s members only.** `config:models.col*` runs 1–3 glyphs (`colProcessor` “处理器” at 3 is the longest). Re-measure over the whole 48-header class at the sweep |
| Filter label | `strings:filters.needsReview` | soft | **14** | **Provisional — no member has shipped.** Carried over as a starting figure only; derive it from the shipped class at the sweep, which is what rubric item 7 exists for |
| Bulk-bar control | `strings:bulk.approveSelected` | soft | **17** | **Provisional — no member has shipped.** Same treatment as the filter row |
| Swatch chip label | `colorText:swatches.hydro` | **hard** — `max-w-24` + `truncate` | **8** | Derived from the component. `PaletteSection.tsx:39` puts the label in a `<span className="max-w-24 truncate">` inside a `text-xs` chip: 96px ÷ 12px = **8** full-width glyphs |
| Palette group caption | `colorText:groupElements` | soft | **9** | Derived from the component. `PaletteSection.tsx:78` and `:93` put each caption in a `w-28 shrink-0` `text-xs` span: 112px ÷ 12px = 9.33, taken down to **9**. Soft because `w-28` is a fixed width with `flex-grow: 0`, so an over-long caption wraps inside its own box and makes the row taller rather than clipping |

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, never distort a term to hit
the number, and never read the figure as a failure threshold. **A term rule outranks the
budget**: 分发规则 stays four glyphs even where 规则 would fit better, because the
`routing rule` row rules out the shorter form.

**Four of the seven rows are provisional and say so.** Replacing them with measured figures
at the whole-language sweep is a deliverable, not a note — runbook section 7, step 2.

**The guard's own length rule is a different, cruder thing** and this locale will never
approach it: `MAX_LENGTH_RATIO` is 2.5x the English character count, and Simplified Chinese
runs roughly 0.4–0.6x. No `LENGTH_EXEMPTIONS` entry is expected for this language.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once, and no token may
be added.

Chinese is comfortable here: nouns do not inflect, there are no articles and no gender, so
a token can sit anywhere in the sentence. `config:credentialsMissing` is
“缺少凭据——请在保险库中设置：{{keys}}”, which moves the token to the end where English has it
after a dash.

### Counted nouns: the measure word is the decision, and it is per object

**Chinese marks no plural. What it does require is a measure word (量词) between the numeral
and the noun, and choosing the wrong one is the equivalent of a wrong plural form** — it is
lexical, per counted object, and no regex can check it. Pick from this table and keep it:

| Counted object | Measure word | Worked example |
| --- | --- | --- |
| entry (条目) | 个 | `config:batchGroupingCustomSizeLabel` is “每批次条目数” |
| CSV row (行) | 行 — the noun is its own measure word | `config:rowsProcessed` is “已处理 {{count}} 行” |
| rule (规则) | 条 | `config:routing.ruleCount_other` is “{{count}} 条规则” |
| glossary (术语表), module, instance, cell, backup | 个 | `config:glossariesSkipped_other` is “已停用 {{count}} 个术语表” |
| translation-memory entry | 条 | `config:tm.clearAllSuccess_other` is “已清空 {{count}} 条记忆库条目” |
| language | 种 | `config:routing.langsMore_other` is “另有 {{count}} 种” |
| attempt, retry, run | 次 | `config:health.lqaRetries` is “LQA 重试：{{count}} 次” |

Never add 们. Where a count is displayed with no noun after it at all — an import-result
chip such as `config:new` (“新增 {{count}}”) — no measure word is needed and none should be
invented.

### Non-`count` numeric tokens

Only `{{count}}` drives plural selection, and Chinese needs no selection anyway — but the
runbook's count-neutral rule still binds this locale for a different reason: **a
non-`count` token must sit in a frame that is true at every value.** Chinese gets this
almost for free, because the measure-word construction is already count-neutral. The one
place it costs something is a token that is a *quantity of things*, where a bare noun after
it can read as a single item.

`config:templateMeta` is the recorded case. English reads "1 languages · 1 routing rules"
for a one-language template — a defect `english-review-notes.md` records and forbids
mirroring. This locale ships “语言数：{{languages}} · 分发规则数：{{rules}}”: the 数 turns
each into a labelled quantity behind a colon, which is true at every value including 1.
Four other locales chose the same shape independently.

## Plurals — one category, and the `_one` key is a build failure

**Simplified Chinese has exactly one CLDR plural category: `other`.** Verified, not assumed:
`new Intl.PluralRules('zh-Hans').resolvedOptions().pluralCategories` returns `["other"]`, and
`scripts/locale-rules.mjs` maps the directory name `zh-hans` to that tag in `BCP47_TAGS`.

So a plural family here supplies **`_other` and nothing else**. Copying English's `_one`
across is a **hard guard failure by design**: `pluralFamilyErrors()` rejects any suffix that
is not a category of the language, because such a key can never be selected and would sit in
the file forever as dead weight.

**Two consequences worth stating, because a single-category language gets them backwards.**

- A `bare + _other` family — the twelve English families with no `_one` at all — keeps
  **both** keys here: the bare key is a plain key in English and must exist, and `_other` is
  the one category. `ja`, the only other single-category locale shipped, does exactly this;
  `config:glossariesSkipped` is one of the families with a `_one` in English, so it keeps
  only `_other`.
- The whole-language key count therefore lands at **1,879** — English's 1,908 minus the 29
  `_one` keys. Not more, and not English's own total. `ja` shipped exactly 1,879, which is
  the check on this claim.

The runbook's warning applies in the other direction and is worth repeating: a category you
*omit* renders the **English** string, not a fallback in your own language. That is why the
missing category is a visible defect rather than a silent one — and why nothing here may be
left short of `_other`.

## Surface names — one rendering, repeated verbatim

A surface is named two or three times across different namespaces, usually by different
batches. Every key naming it gets the same rendering, and prose mentioning it repeats that
rendering verbatim. **Batch 1 settles four of these from `config` prose alone, before the tab
labels that own them ship in batch 2** — so these rows are prescriptions for batch 2, not
citations of it, and batch 2 must copy them rather than re-decide.

| Surface | Rendering | Owning key | Also owed by |
| --- | --- | --- | --- |
| Compare | “对照” | `strings:tabs.compare` | named in prose by `config:routing.tonesHint` |
| Translations | “译文” | `strings:tabs.strings` | named in prose by `config:routing.categoriesConfiguredHint` |
| Backup | “备份” | `strings:tabs.backup` | named in prose by `config:importSnapshotNote`; `backup:*` |
| Orphans | “孤立条目” | `strings:tabs.orphans` | `orphans:title`; named in prose by `config:fullReplaceOrphanNotice` |
| Global Config | “全局配置” | `sidebar:globalConfig` | `config:globalConfigTitle` — English makes these two word-for-word identical and they must stay so |

The word for *tab* in prose is 标签页: `config:importSnapshotNote` is
“本次导入前已创建安全快照（{{date}}）。您可以在备份标签页中恢复它。”

**Two English defects are already handled in `config` and must not be re-introduced.**
`config:fullReplaceOrphanNotice` calls the Orphans tab the *Relink tab*, which does not
exist; it ships here with the Orphans rendering. And `config:routing.simplePlaceholder`
labels a module picker *Provider*; per the frozen lexicon it is translated as written and
ships as “选择服务商”, without dragging 模块 anywhere.

## Locale-specific traps

- **Vocabulary, not just characters, separates this file from `zh-hant`.** Use 软件 (not
  軟體), 程序 (not 程式), 项目 (not 專案), 默认 (not 預設), 内存 (not 記憶體), 质量 (not
  品質), 用户 (not 使用者), 网络 (not 網路), 数据 (not 資料), 文件 (not 檔案), 视频 (not
  影片), 导入/导出 (not 匯入/匯出). A character converter changes none of these, which is
  exactly why converting produces a file that is wrong in a way reviewers miss.
- **模型 and 模板 resolve the *model* / *template* collision cleanly.** `config:models.colModel`
  is “模型” and `config:templatesTitle` is “项目模板”. Chinese is one of the few languages
  where the terminology file's warning about this pair costs nothing; keep the two words
  strictly apart anyway.
- **关卡 is correct for _stage_** — the gaming word for a playable level. 阶段 is exactly
  the process reading `terminology.md` warns about, and because 关卡 is spent on it,
  *quality gate* had to take 质量门禁 rather than any 关 compound.
- **路由 is banned for _routing rule_.** In Chinese it means network routing without
  qualification. The whole `config:routing.*` subtree ships on 分发 instead —
  `config:routing.title` is “分发规则”.
- **_Judge_ takes the evaluative sense** (评分), never 法官 or 审判.
- **Do not use Taiwan-only terms** even when they sound more precise; this file has one
  audience.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms where
  English writes "entr(ies)". Chinese needs no parenthetical at all — number plus measure
  word already covers every count.

## Register and typography sweeps

Six greps, run over `packages/frontend/src/locales/zh-hans/` before every review. All six
were clean on batch 1.

| Sweep | What to look for |
| --- | --- |
| 你 where the register calls for 您 or no pronoun | `你` as a standalone pronoun (not inside 其他/你们-style compounds) |
| Traditional characters or Traditional-only vocabulary | the right-hand column of the `zh-hant` trap list above, plus 「」 |
| Half-width ASCII punctuation inside Chinese text | `,` `.` `:` `;` `?` `!` `(` `)` between two Han characters |
| Doubled spaces | two consecutive spaces anywhere |
| Three-dot ellipsis instead of the single character | `...` for `…` |
| Single or spaced dashes used as punctuation | ` - ` and a lone `—` between clauses; `— 请选择 —` is the one licensed exception |

The missing-space check is the seventh thing to look at and is deliberately not a grep: a
Han character directly against a Latin letter or digit is usually a defect and sometimes
correct (inside a model id, inside a `{{token}}`'s own braces), so it is read rather than
matched.
