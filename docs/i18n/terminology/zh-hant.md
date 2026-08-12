# NARN terminology — Traditional Chinese (`zh-hant`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/zh-hant.md`](../style/zh-hant.md) — how Traditional Chinese is written here: register, punctuation,
  capitalization, plural and agreement rules. That one is yours to write too, for this
  locale only.

Fill a row when you meet the term, in the same change that introduces the wording — so
this file records decisions actually taken, never predictions. Use **Notes** for anything
the next translator would otherwise have to rediscover: a declension that forced a
different word, a term you deliberately left in English, an acronym you expanded, a
candidate you rejected and why.

Terms are in the order they appear in `../terminology.md`. Do not add, remove or reorder
rows: a term the lexicon lacks goes in the additive queue in [`README.md`](README.md).

**Reading the Notes column.** An English word under discussion is written in *italics*,
never in quotes and never in backticks — a quoted or backticked span is read by
`check-lexicon-citations.mjs` as a claim that this locale ships that exact text, and an
English gloss written that way fails, correctly. Corner brackets 「…」 therefore always
wrap a real shipped rendering here, matching the quote convention this locale's strings
use.

| Term | Rendering | Notes |
| --- | --- | --- |
| project | 專案 | The Taiwan rendering, and the single most load-bearing divergence from `zh-hans`, which ships 项目 — whose Traditional form 項目 is used *here* for an ordinary item and is barred for this sense. A character conversion of the Simplified file would therefore have produced a locale that calls a project an item throughout. `config:duplicateProject` is 「複製專案」 |
| workspace | 工作區 | Shares no morpheme with 專案, which is what the term's *never the same word* rule asks. `config:workspaceSettingsTitle` is 「工作區設定」 and `config:batchGroupingDefaultOption` is 「使用工作區設定」, so the contrast against a project value reads at a glance |
| entry | 條目 | **Canonical, counter 個.** 項目 was rejected even though it is idiomatic Taiwanese for an item: the frozen term lists *item* among the readings this word must not take, and the same two characters are the mainland word for *project*, so admitting it in one sense while banning it in the other would leave a trap in every later batch. 記錄 is spent on *recording*, 列 on a CSV row. `config:batchGroupingCustomSizeLabel` is 「每批次條目數」 |
| source text | 原文 | The settled Taiwanese localization-industry word, and it pairs with 譯文 exactly as *source text* pairs with *translation*. `config:lqa.checks.tag-equality.description` is 「原文與譯文之間的內嵌標記必須一致。」 Kept for *source language* too — see that row |
| translation | 譯文 | The noun. The verb is 翻譯, a different word, which is what keeps the *Translations* tab and the *Translate* sidebar group apart without effort — the collapse Japanese had to be warned about. `config:routing.categoriesConfiguredHint` is 「類別是在譯文分頁中設定的。」 Never 目標文字 or 輸出 |
| source label | 來源標籤 | `config:routing.sourcesHint` is 「匯入條目後，來源標籤會顯示在這裡。」 The routing column heading shortens to 來源 exactly as English shortens it to *Sources* (`config:routing.labelSources`). 來源 and 原文 use different morphemes on purpose, so the *source label* / *source text* / *source language* trio can never blur |
| achievement | 成就 | What every Taiwanese game platform ships for this. `config:lqa.achievementNameBytesLabel` is 「成就名稱（位元組）」 |
| inline tag | 內嵌標記 | 標記 is the head; 內嵌 is the settled Taiwanese computing prefix for *inline* (mainland copy prefers 内联, which is one of the divergences a converter leaves untouched). Distinct from 來源標籤, which takes 標籤, and the umbrella over 佔位符 below |
| placeholder | 佔位符 | The `{{…}}`-token sense **only**, and note the character: Taiwan writes 佔 with the person radical where the mainland writes 占. `config:lqa.checks.mask-integrity.description` is 「被遮罩的佔位符必須在往返翻譯後端的過程中保持不變。」 The input-hint sense of the same English word takes a different word entirely and had no occurrence in `config` |
| translator context | 譯者情境 | Three things English calls *context*, and this locale keeps them apart by head rather than by modifier: this one is 情境, a model's context window is 上下文 (`config:models.confidenceReason.prompt-near-context` and `config:models.colContext`). `config:includeContext` is 「包含譯者情境欄」 — English says only *context column* there, and the qualifier is not padding: the exported column is the translator note (`M2-csv-importer.ts:518` seeds it as an optional translator note), and bare 情境 beside a table of AI settings would have read as the model's. 備註 is spent on the routing Notes field |
| source language | 原文語言 | Built on 原文 rather than on 來源, so the pair 原文語言 / 目標語言 reads as one axis and 來源 stays the *source label* word |
| target language | 目標語言 | Pairs with 原文語言; both are the settled Taiwanese compounds |
| reference language |  |  |
| writable language |  |  |
| Pseudo Test | 偽翻譯測試 | `config:pseudoTestHelpAria` is 「什麼是偽翻譯測試？」 偽在地化 is the industry term for pseudo-localization and was rejected deliberately: the English name is *Pseudo Test*, not *Pseudo-localization*, and the app's own description calls it a QA pass rather than a localization mode. The language code itself is never translated |
| run | 執行 | The noun — one execution of a background engine. **The frozen term lists *execution* among the readings to avoid, and this row takes it anyway, knowingly.** Taiwanese Chinese has no other nominal for this: 運行 is the mainland verb, 任務 and 作業 are the *job* / *task* readings the same list bars, 程序 would name an OS process. What the reservation actually protects is that *run* must not be 批次, 活動 or 日誌, and 執行 collides with none of them. Its counter is 次. `config:importModeFullReplaceHint` is 「…不會納入 AI 執行」 |
| revert |  |  |
| Activity |  |  |
| log |  |  |
| batch | 批次 | Not 批量, which is the mainland form and is wanted here for nothing. `config:module.batchMode` is 「批次模式」 |
| batch grouping | 批次分組 | `config:batchGroupingLabel` is 「批次分組」, built on 批次 so a reader sees one feature. It cannot collide with 批次模式 — 分組 and 模式 are different heads |
| AI review | 審閱 | The AI's opinion. **Three review words, sharing 審 and differing in the head**: 審閱 for an AI pass, 審校 for a person proofreading (*needs review*, *review queue*), 審核 for the sidebar umbrella. None is a substring of another and none is equal to another, so the runbook's equality ban is satisfied structurally rather than by luck. Never 檢查, which is the deterministic LQA word |
| judge | 評分 | The evaluative sense the term demands, never 法官 or 審判. Used verbally: `config:batchGroupingDescription` is 「在翻譯、評分與原文審閱執行中，把相關條目保留在同一個批次，讓模型能一起看到它們。術語與類別生成不受影響。」 No noun *the judge* is introduced, because English introduces none either |
| source review | 原文審閱 | 原文 plus the 審閱 root, so the AI passes over source and over translation read as one pair. Not 校對, which names human proofreading specifically and belongs to the 審校 family |
| finding |  |  |
| suggestion |  |  |
| discard | 捨棄 | Sense one — the ghost button beside Save. `config:discard` is 「捨棄」. The second sense (refusing something the app produced) and the export checkbox each take a different verb; see the *omit* row. Three verbs, exactly as the term predicts |
| needs review |  |  |
| flag |  |  |
| ignore / ignored |  |  |
| Review (the sidebar group) |  |  |
| review queue |  |  |
| back-translation |  |  |
| module | 模組 | **Canonical**, and the Taiwan form — mainland copy writes 模块. `config:routing.labelModule` is 「模組」. Never 外掛, which would promise a plugin system the app does not have |
| module instance | 模組實例 | Shortened to 實例 once 模組 is established in the sentence, which is what the whole `config:instances.*` subtree does: `config:instances.addButton` is 「新增實例」. The instance id itself is never translated |
| provider | 供應商 | The outside company. `config:enableModuleHelp` is 「新增可在您所有專案中使用的 AI 或翻譯供應商。」 Shares nothing with 模組, so the three English strings that mislabel a module picker *Provider* — rendered as written, per the term — cannot drag 模組 anywhere. `config:routing.simplePlaceholder` is 「選擇供應商」 |
| model | 模型 | Never 範本, which is *template*; the collision the terminology file warns about costs this locale nothing, because Taiwanese usage prefers 範本 over 模板 and the two words then share no character with 模型 |
| prompt | 提示詞 | The settled Chinese AI term. 提示 alone would collide with an ordinary UI hint, so the 詞 is not optional. Distinct from 請求 (an HTTP request, `config:requestTimeoutLabel`) and from 搜尋 (the search query behind `config:models.noMatches`) |
| reasoning effort | 推理強度 | What Taiwanese AI tooling calls the provider parameter. Not 努力, which is effort in the sense of work expended |
| routing rule | 分派規則 | **路由 was rejected, and it is the one rejection that changes a whole subtree.** In Chinese 路由 is unambiguously *network* routing — a router is 路由器 — which is the reading the frozen term forbids outright. 分派 (assign, dispatch) carries the content sense with no network reading. `config:routing.title` is 「分派規則」 and `config:routing.routesTo` is 「分派至」 |
| rule group | 規則群組 | Built on 規則 so the two read as one feature, and 群組 rather than the mainland 组. Not reused for 類別 or for 批次分組 |
| credential vault | 保險庫 | The short form carries the load, as English's does: `config:credentialsVaultLockedChip` is 「保險庫已鎖定」 and `config:credentialsUnlockButton` is 「解鎖保險庫」. The full compound 憑證保險庫 is held for `vault:statusLabel` and has not shipped yet. Not 金鑰庫 (a keystore) and not 鑰匙圈 (a keychain) |
| credential | 憑證 | `config:credentialsMissingChip` is 「缺少憑證」. Taiwanese usage also gives 憑證 the TLS-certificate sense, which the app never renders, so no disambiguation is needed. The vault key names themselves are never translated |
| LQA | LQA | Kept as the acronym. Taiwanese localization vendors use LQA untranslated in exactly this sense, and no established Chinese expansion competes with it. `config:lqa.title` is 「LQA 檢查」, with the half-width space the style guide requires between Latin and Han |
| quality gate | 品質把關 | 關卡 is the natural word for a gate and is spent on *stage*, so the gate had to be built elsewhere. 把關 is the process-control reading — to vet at a checkpoint — with none of the physical-door readings the term warns about. `config:lqa.description` says a blocking issue causes 品質把關失敗. Note 品質, not the mainland 质量 |
| check | 檢查 | One word across 品質檢查, 「LQA 檢查」 and every individual check name in `config:lqa.checks.*`. Kept clear of 審閱 (the AI's opinion) and of 稽核, which the *recording* row warns every locale reaches for first |
| issue | 問題 | One LQA verdict. `config:lqa.checks.glossary-adherence.description` says 這個問題僅供參考 at warning severity. Held apart from the source review's *finding*, which takes a different word entirely, because both are listed against the same entry |
| severity | 嚴重程度 | `config:lqa.checks.glossary-adherence.description` is where the head noun actually appears — 將嚴重程度設為阻斷. The two values are 阻斷 and 警告, and they belong to the *check* term, not to this one |
| notification severity |  |  |
| assertion | 斷言 | The regex LQA check's user-written rule. A fourth word was genuinely required, as the term says: 條件 is the routing condition, 檢查 the LQA check, 規則 the routing rule. `config:lqa.regexAddAssertion` is 「新增斷言」 |
| pattern | 正規式 | The regular expression in the field beside an assertion, and nothing else. 模式 is spent on *mode* (`config:module.batchMode`), 樣式 on the Text Styler's visual sense, 範本 on *template* — so the standard Taiwanese short form of 正規表示式 is what is left, and it is exactly what the field holds. `config:lqa.regexPattern` is 「正規式」 |
| overflow | 溢出 | Relative to the source, and configured as 溢出比例 (`config:overflowRatioLabel`). Kept clearly apart from 長度上限, which is absolute — both appear in the same checks list, as `config:lqa.checks.overflow.name` (「長度溢出」) and `config:lqa.checks.length-limit.name` |
| length limit | 長度上限 | The hard per-language cap, and also the routing condition on source length (`config:routing.labelMaxLength` is 「條目長度上限」). 上限 rather than 限制 because the same head then serves every other cap in the product — batch size, output tokens, backups — and a reader meets one word for one idea |
| pass rate |  |  |
| glossary | 術語表 | A named list attached to a project. 術語庫 was rejected because 庫 is spent on the single workspace-wide 翻譯記憶庫, and a project-scoped list sharing that head would imply one global store. `config:batchGroupingGlossary` is 「依術語表」 |
| glossary term | 術語 | One row of a glossary; the head of 術語表, which is the *root over its own compound* licence rather than a collapse. Never 條目, which is reserved for content entries — `config:lqa.checks.forbidden-terms.name` is 「禁用術語」 |
| constant |  |  |
| match |  |  |
| translation memory | 翻譯記憶庫 | The industry term, used unchanged in Taiwanese CAT tooling. `config:tm.policyTitle` is 「翻譯記憶庫」. Never bare 記憶體, which is RAM |
| approve | 核准 | To store a translation into memory. `config:tm.browserEmpty` is 「尚無翻譯記憶庫項目。當您核准譯文時，項目就會被存入。」 Kept apart from 套用 (*apply* a suggestion), 標記為已審校 (*mark as reviewed*) and 儲存 (*save*) — all four share the bulk bar |
| category | 類別 | `config:routing.labelCategories` is 「類別」. Not reused for 規則群組 or for 來源標籤 |
| tone | 語氣 | The authoring instruction, per entry. The acoustic readings (音調, 聲調) and the model's writing style (文風) are exactly the traps the term names. `config:routing.labelTones` is 「語氣」 |
| orphan | 孤立條目 | The figurative noun, built on 條目 so the count chip, the tab and the log lines all count the same object. `config:importModeFullReplaceHint` says such entries 會標示為孤立, and `config:fullReplaceOrphanNotice` names the tab 孤立條目分頁 — English calls it the *Relink tab* there, which does not exist, and that defect is not mirrored |
| relink | 重新連結 | One verb for the row button, the dialog title, the confirm step and the import warning. `config:importModeFullReplaceHint` is 「…在重新連結或刪除前不會納入 AI 執行」 |
| backup | 備份 | `config:maxBackupsLabel` is 「每個專案的備份數量上限」. Kept apart from 匯出 (*export*) and from 快照 below, which share sentences with it |
| snapshot | 快照 | The automatic pre-operation backup. `config:importSnapshotNote` is 「本次匯入前已建立安全快照（{{date}}）。您可以在備份分頁中還原它。」 — one sentence carrying both this term and *backup*, which is why they cannot share a word |
| template | 範本 | **Taiwanese usage prefers 範本 over the mainland 模板**, and that preference resolves the terminology file's warning for free: 範本 shares no character with 模型, so *template* and *model* can never be confused here. `config:templatesTitle` is 「專案範本」 |
| omit (from an export) | 排除 | The third *discard* sense — leaving rows out of a generated file, destroying nothing. `config:discardUntranslatable` is 「排除不需翻譯的條目」. 捨棄 is sense one and 拒絕 sense two; this is a fourth verb by count and a third by sense, which is what the term predicts every locale needs |
| collaborator |  |  |
| member |  |  |
| nickname |  |  |
| claim |  |  |
| invite |  |  |
| revoke |  |  |
| recording |  |  |
| stage |  |  |
| Text Styler |  |  |
| element |  |  |
| assistant |  |  |
| theme |  |  |
| guide | 指南 | `config:pseudoTestHelpLink` is 「點選此處閱讀指南 →」. One word for the built-in documentation section everywhere; 說明 is spent on the ordinary *description* label and 教學 would promise a tutorial |
| release |  |  |
| changelog |  |  |
| dismiss |  |  |
