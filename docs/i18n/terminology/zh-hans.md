# NARN terminology — Simplified Chinese (`zh-hans`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/zh-hans.md`](../style/zh-hans.md) — how Simplified Chinese is written here: register, punctuation,
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
never in quotes — a quoted span next to a key is read by `check-lexicon-citations.mjs` as a
claim that this locale ships that exact text, and an English gloss written that way fails,
correctly. Curly quotes “…” therefore always wrap a real shipped rendering here, matching
the quote convention this locale's strings use.

| Term | Rendering | Notes |
| --- | --- | --- |
| project | 项目 | The universal Simplified rendering. Note the zh-hant divergence recorded in the style guide: Traditional uses 專案 for this sense, so a character conversion of this file would be wrong, not merely different. The verb is 创建 — `config:duplicateProject` is “复制项目” and never a *new project* phrasing |
| workspace | 工作区 | Deliberately shares no morpheme with 项目, which is what the term's "never the same word" rule asks for. `config:workspaceSettingsTitle` is “工作区设置” and `config:batchGroupingDefaultOption` “使用工作区设置” — the contrast against the project value reads correctly because the two words look nothing alike |
| entry | 条目 | **Canonical, and the counter is 个.** Never 词条 (that reads as a dictionary headword and is wanted for *glossary term*), never 行 (a table artefact) and never 记录, which is spent on *recording*. `config:batchGroupingCustomSizeLabel` is “每批次条目数”. See the counter table in the style guide before writing any counted noun |
| source text | 原文 | The established translation-industry word, and it pairs with 译文 exactly as *source text* pairs with *translation*. `config:lqa.checks.tag-equality.description` is “内联标记必须在原文与译文之间保持一致。” Keep it for *source language* too — 源语言 uses 源 rather than 原 because 源语言 is the settled computing compound; the two are not required to share a character and forcing that would produce 原语言, which reads as *primitive language* |
| translation | 译文 | The noun. The verb is 翻译, a different word, which is what lets the *Translations* tab (译文) and the *Translate* sidebar group (翻译) stay distinct — the collapse Japanese had to be warned about. Never 目标文本 or 输出 |
| source label | 来源标签 | `config:routing.sourcesHint` is “导入条目后，来源标签会显示在这里。” The routing column heading shortens to 来源 exactly as English shortens it to *Sources* (`config:routing.labelSources`), and 来源 alone is only ever the column. Kept distinct from 源语言 and 原文 by using a third morpheme entirely |
| achievement | 成就 | The word every Chinese game platform ships for this. `config:lqa.achievementNameBytesLabel` is “成就名称（字节）” |
| inline tag | 内联标记 | 标记 is the head; 内联 is the established computing prefix for *inline*. Distinct from 来源标签 (which takes 标签) so the two never read as one thing, and distinct from 占位符, which is the subset below |
| placeholder | 占位符 | The `{{…}}`-token sense **only**. `config:lqa.checks.mask-integrity.description` is “被掩码的占位符必须在翻译后端的往返过程中保持不变。” For the input-hint sense of the same English word this locale writes 提示文本 instead, per the term's own warning; nothing in `config` needed it yet |
| translator context | 译者上下文 | Three things English calls *context*, and this locale keeps three compounds apart by their modifier exactly as English does: `strings:compare.editContext` is “编辑译者上下文”, `generation:contextLabel` is “包含条目上下文”, and a model’s context window is 上下文窗口 (`config:models.confidenceReason.prompt-near-context`). The shared head 上下文 is deliberate — three unrelated heads would read as three unrelated features. Not 备注, which is spent on the Notes fields |
| source language | 源语言 | See the *source text* row for why 源 and not 原 |
| target language | 目标语言 | Pairs with 源语言; both are the settled computing compounds |
| reference language | 参考语言 | `strings:compare.translateUseReferenceNone` is “使用参考语言作为上下文”. Never a wording implying the app translates *through* it, which the term rules out. The toolbar label shortens to 参考 (`strings:compare.reference`), the same shortening English makes |
| writable language | 可编辑语言 | One adjective everywhere, which is what the term asks: the table column (`collab:sharing.columnLanguages`), the lock messages (`collab:locks.reviewLanguagesScoped` is “审校队列仅限于您的可编辑语言。”) and the compare-toolbar note. 可写 was rejected — it reads as a filesystem permission |
| Pseudo Test | 伪翻译测试 | `config:pseudoTestHelpAria` is “什么是伪翻译测试？” 伪本地化 is the standard Chinese term for pseudo-localization and was rejected on purpose: the English name is deliberately *Pseudo Test*, not *Pseudo-localization*, and the longer compound would have made the sidebar and guide labels a glyph wider for no gain. The language code itself is never translated |
| run | 运行 | The noun, not the verb — the same nominal use Chinese CI tooling makes of it (a workflow run is 一次运行). Its counter is 次. 任务 and 作业 are both barred by the term's *Not:* list, and 进程 would name an OS process. `config:routing.groupSwitchLocked` is “翻译运行期间，规则组切换已锁定。” |
| revert | 回退 | Rolls back everything one run wrote. **Three separate words, and keeping them apart is the point**: 回退 here, 撤销 for *undo* (`strings:compare.undo`, one earlier version of one cell) and 恢复 for the backup *restore* verb (`backup:restoreButton`). The badge is “已回退” (`strings:runs.revertedBadge`) |
| Activity | 活动 | The tab and the guide topic. 历史 and 日志 are both barred by the term — 日志 belongs to the live server-log panel, one row down. The page title expands as English does: `strings:runs.title` is “翻译活动” against the tab’s 活动, and prose repeats the tab form, e.g. `review:translationAi.progressActivityNote` |
| log | 日志 | The live server-log panel and its lines. **Log entry folds into this term**, deliberately: 日志条目 would spend the reserved *entry* word on a log line, so `console:empty` is simply “暂无日志。” Distinct from 活动 above; note that 更新日志 (*changelog*) is a compound of this root, licensed in that row |
| batch | 批次 | Not 批量, which is the *bulk operation* word and is wanted for that. `config:module.batchMode` is “批次模式” |
| batch grouping | 批次分组 | `config:batchGroupingLabel` is “批次分组”, built on 批次 so a reader sees one feature. It cannot collide with 批次模式: 分组 and 模式 are different heads |
| AI review | 审校 | The umbrella review root, shared by every member so the family reads as one system: 原文审校、译文 AI 审校、人工审校、审校队列、待审校. The umbrella *feature name* prefixes the Latin AI with a half-width space; that citation lives in `style/zh-hans.md`, because a lexicon Rendering cell cannot hold a mixed Latin+Han value under the citation guard — see the tooling note at the foot of this file. Never 检查, which is the deterministic LQA word |
| judge | 评分 | The evaluative sense, as the style guide requires — never 法官, 审判 or 裁决. Used verbally: `config:batchGroupingDescription` is “在翻译、评分和原文审校运行中，把相关条目保留在同一批次内，让模型一并看到它们。术语生成和类别生成不受影响。” No noun *the judge* is introduced, because English does not use one either |
| source review | 原文审校 | Built on 原文 plus the 审校 root the whole review family shares, so the four review surfaces read as one family. Not 校对, which names human proofreading specifically |
| finding | 发现项 | One issue the source review reports. The 项 is what keeps it off 问题, which the *issue* term holds for a machine verdict — the two are listed on the same entry, so a shared word would erase the line between an AI opinion and an LQA result. `review:sourceAi.findingsTitle` is “发现项”. The five types ship as 拼写错误、语法、术语、清晰度 and 不安全表述 |
| suggestion | 建议 | One word across the judge panel, the glossary generator and the category generator. The action on it is 应用 (`strings:runs.judgeApply`), never 批准 — see the *approve* row and the English copy bug recorded there |
| discard | 放弃 | Sense one — the ghost button beside Save. `config:discard` is “放弃”. The second sense, refusing something the app produced, takes 拒绝, and the export checkbox takes a third verb entirely; see the *omit* row. Three verbs, exactly as the term predicts most languages need |
| needs review | 待审校 | Works unchanged in all three surfaces the term names: the filter (`strings:filters.needsReview`), the row badge (`strings:compare.cellNeedsReviewBadge`) and “全部标记为待审校”. **The casing trap costs this locale nothing** — Chinese has no case, so the deliberately lowercase badge and the sentence-case filter are the same string, which is exactly what the term wants |
| flag | 搁置 | A disposition, not an alarm — literally *to set aside*. **It had to differ from 标记**, the ordinary marking verb, because this action clears the needs-review flag that 标记为待审校 sets: one word for both would make the same verb set and unset one state. `review:flag` is “搁置”; the filter chip is “已搁置” (`review:filterFlagged`) |
| ignore / ignored | 忽略 | `strings:row.ignored` is “已忽略”. The negation is **built, not coined**: `strings:row.unignoreAction` is “取消忽略条目”, using the standard 取消 + verb pattern. Distinct from 跳过 (a per-run routing outcome) and from 停用 (what happens to a module) |
| Review (the sidebar group) | 审校 | The navigational umbrella over the four review tabs, byte-identical to `strings:guide.groupReview` as English requires. It is a **proper substring** of three of its four children and equal to none of them — the licence the runbook grants a general heading over children that specialise it |
| review queue | 审校队列 | `review:title` is “审校队列”, built on the same 审校 root as the state 待审校 so a reader sees one feature rather than two |
| back-translation | 回译 | The established Chinese term of art in this industry — **not** a literal compound of *back* and *translate*, which in Chinese would name an action the product does not offer. `review:backTranslationTitle` is “回译（仅供参考）” |
| module | 模块 | **Canonical.** `config:routing.labelModule` is “模块”. Never 插件 — the app has no plugin system and the word would promise one |
| module instance | 模块实例 | Shortened to 实例 once 模块 is established in the sentence, which is what `config:instances.*` does throughout: `config:instances.addButton` is “添加实例”. The instance id itself is never translated |
| provider | 服务商 | The outside company. `config:enableModuleHelp` is “添加可在您所有项目中使用的 AI 或翻译服务商。” Shares nothing with 模块, so the three English strings that mislabel a module picker *Provider* — rendered as written, per the term — cannot drag 模块 anywhere |
| model | 模型 | Never 模板, which is *template*; the pair the terminology file warns about costs this locale nothing, because 模型 and 模板 differ in their second character and in every collocation. Model ids are never translated |
| prompt | 提示词 | The settled Chinese AI term. 提示 alone would collide with an ordinary UI hint, so the 词 is not optional. Distinct from 请求 (an HTTP request, `config:requestTimeoutLabel`) and from 搜索 (the search query in `config:models.noMatches`) |
| reasoning effort | 推理强度 | What Chinese AI tooling calls the provider parameter. Not 努力, which would be effort in the sense of work done |
| routing rule | 分发规则 | **路由 was rejected and this is the one term where that matters.** 路由 is unambiguously *network* routing in Chinese — a router is 路由器 — which is exactly the reading the frozen term forbids. 分发 (dispatch, distribute) carries the content sense with no network reading at all. `config:routing.title` is “分发规则” and `config:routing.routesTo` is “分发至” |
| rule group | 规则组 | Built on 规则 so the two read as one feature. Not reused for 类别 or for 批次分组 |
| credential vault | 保险库 | The short form carries the load, as English's does: `config:credentialsVaultLockedChip` is “保险库已锁定” and `config:credentialsUnlockButton` “解锁保险库”. The full compound 凭据保险库 is reserved for the one place that needs it and has not shipped yet. Not 密钥库 (that is a keystore) and not 钥匙串 (a keychain) |
| credential | 凭据 | `config:credentialsMissingChip` is “缺少凭据”. Vault key names themselves are never translated |
| LQA | LQA | **Kept as the Latin acronym.** Simplified Chinese localization practice has no established localized form for Linguistic Quality Assurance — 语言质量保证 is a gloss, not an acronym, and it cannot be used in the filter chip or the column header where the three letters are needed. `config:lqa.title` is “LQA 检查”, with the half-width space this locale puts between Latin and Chinese |
| quality gate | 质量门禁 | The process-control sense, and the term Chinese DevOps practice already uses. **关卡 was unavailable** — the style guide spends it on *stage*, the game level — and it would have imported exactly the physical-door reading the term warns against. `config:overflowRatioDescription` is “应用于新导入条目的默认溢出比例。在 LQA 质量门禁处用于检测文本溢出。默认值：1.75。” Shortens to 门禁 once 质量检查 has been said |
| check | 检查 | One word across 质量检查, LQA 检查 and every individual check name. Not 校验 or 验证 |
| issue | 问题 | The machine verdict. Kept away from the source review's *finding*, which takes a different head — see that row once it is filled |
| severity | 严重级别 | `config:lqa.checks.glossary-adherence.description` ends “严重级别为警告时，该问题仅作提示；将严重级别设为阻断即可触发自动重试。” The two values are 阻断 and 警告 and are fixed by the *check* term, not re-decided here |
| notification severity | 严重级别 | The same head as the LQA *severity* row, with its own value set: 信息、警告、严重. **警告 is not free to re-decide** — it is fixed by the *check* term and renders identically in both places (`account:notificationsSeverity.warning` and `config:lqa.severityWarning`) |
| assertion | 断言 | The established computing word, and genuinely free: 条件 is spent on routing conditions, 检查 on the LQA checks and 规则 on the routing rules, exactly as the term predicts. `config:lqa.regexAddAssertion` is “添加断言” |
| pattern | 模式 | The regex sense only. `config:lqa.regexPattern` is “模式”, sitting beside 标志 and 消息 in the assertion row, which is what disambiguates a word that is otherwise general. Never 模板 |
| overflow | 溢出 | `config:overflowRatioLabel` is “溢出比例”. Kept clearly apart from 长度上限 below — one is a ratio, the other a hard cap, and `config:lqa.checks` lists both |
| length limit | 长度上限 | `config:routing.labelMaxLength` is “条目长度上限”. 上限 rather than 限制 so the absolute, editor-imposed sense is explicit |
| pass rate | 通过率 | `quality:columns.passRate` is “通过率”. **成功率 is the trap and it is already taken**: `config:health.successRate` is a different metric in the same product — provider request success — and ships as “成功率 {{rate}}%” |
| glossary | 术语表 | The CAT-tool word. `config:batchGroupingGlossary` is “按术语表” |
| glossary term | 术语 | The head of 术语表, so the two read as one feature — and never 条目, which is reserved for content. `config:lqa.forbiddenPlaceholder` shows the shape as “术语1、术语2” |
| constant | 常量 | `glossary:colConstant` is “常量”. The near-miss the term warns about is a different word here — *read-only* is 只读 (`glossary:readOnly`), two columns away in the same table — so the two cannot be confused |
| match | 匹配项 | The noun, at `glossary:matchesPanel` “匹配项”. The verb is the bare 匹配, on the same root as the term asks (`config:lqa.regexModeMustMatch` is “必须匹配”, `config:models.noMatches` is “没有模型与您的搜索匹配”). The 项 separates the noun both from the verb and from 术语, which is what is being searched *for* |
| translation memory | 翻译记忆库 | The established CAT term; the 库 is what keeps it from reading as RAM, which is 内存. `config:tm.policyTitle` is “翻译记忆库”. Shortens to 记忆库 inside a sentence that has already said it, as `config:tm.clearAllSuccess_other` does |
| approve | 批准 | The promotion into translation memory. `config:tm.browserEmpty` is “翻译记忆库中暂无条目。只有当您批准一条译文时，条目才会被存入。” Distinct from 应用 (*apply* a suggestion), 标记为已审校 (*mark as reviewed*) and 保存 (*save*) — all four have to sit in one bulk bar |
| category | 类别 | Not 分类, which names the act of classifying, and not 标签, spent on *source label*. `config:batchGroupingCategory` is “按类别” |
| tone | 语气 | The authoring instruction. 语调 would be the acoustic reading and 风格 would read as the model's writing style, which the term rules out. `config:routing.labelTones` is “语气” |
| orphan | 孤立条目 | Built on 条目 so the object is unmistakable, with 孤立 (isolated, cut off) as the figurative noun the term asks for; the bare adjective 孤立 is what the state badge uses. `config:orphanedCount` is “{{count}} 个已孤立”. 孤儿 (the literal orphan) was rejected: it reads as a person in Chinese and would be jarring in a count chip |
| relink | 重新关联 | One verb for the row button, the dialog title, the confirm step and the import warning. `config:importModeFullReplaceHint` is “文件中缺失的条目将被标记为孤立（在重新关联或删除前不参与任何 AI 运行）。” |
| backup | 备份 | The noun; the verb is 创建备份, never a bare 备份 used verbally. `config:maxBackupsLabel` is “每个项目的最大备份数”. Kept apart from 导出 (*export*) and 快照 (*snapshot*) |
| snapshot | 快照 | `config:importSnapshotNote` is “本次导入前已创建安全快照（{{date}}）。您可以在备份标签页中恢复它。” — the one string that uses both this and 备份, which is why they cannot share a word |
| template | 模板 | `config:templatesTitle` is “项目模板”. The *model* trap the terminology file warns about does not exist here: 模型 and 模板 are separate words and neither is anyone's second choice for the other |
| omit (from an export) | 排除 | **A third verb, as the term predicts.** English writes *discard* at `config:discardUntranslatable`, but nothing is destroyed and nothing is refused — only the generated file is smaller — so neither 放弃 (sense one of *discard*) nor 拒绝 (sense two) is true of it. The string ships as “排除无需翻译的条目” |
| collaborator | 协作者 | `collab:join.description` is “输入邀请码，以协作者身份加入他人的项目。” Two distinct words are required against *member* below, and 协作者 / 成员 share no morpheme at all |
| member | 成员 | `collab:sharing.membersTitle` is “成员”. Every 协作者 is a 成员; the owner is a 成员 but not a 协作者, and the two words sit in adjacent strings on the Sharing page |
| nickname | 昵称 | `collab:nickname.title` is “昵称”. **用户名 was rejected**, per the term: the account already has an identity, and reusing that word would recreate exactly the confusion the collaborator/member pair exists to prevent |
| claim | 认领 | Yields the whole family the term requires — the button “认领昵称” (`collab:nickname.claimButton`), the progressive 认领中…, the toast 昵称已认领。 and the immutability hint 昵称一经认领便无法更改。 It stays clear of 保留, which `collab:errors.nickname_reserved` needs for *that name is reserved* |
| invite | 邀请 | `collab:invites.title` is “邀请”. **The four statuses are translated as one set, in one part of speech** — 待接受、已使用、已作废、已过期 — three glyphs each, all states, so a reader comparing them down one column sees a single paradigm |
| revoke | 作废 | **撤销 was unavailable and that is the whole reason for this word.** 撤销 is spent on *undo*, and 撤回 is one character away from it — far too close for a verb that appears in a table beside it. 作废 (to render void) is unmistakable, and its participle differs from the infinitive by the ordinary 已 prefix, so the adjacent Status and Actions columns read 已作废 / 作废 rather than one word twice, which is the constraint the term states |
| recording | 记录 | The manual-edit audit. **English names this feature three ways in three adjacent strings — audit, record and track — and all three ship on this one word**, as `english-review-notes.md` directs: `collab:sharing.auditToggleLabel` is “人工编辑记录”, `auditToggleCheckboxLabel` is “记录人工编辑”, `auditToggleHelp` is “记录协作者对此项目所做的人工文本编辑。” No audit word is coined, and 检查 — spent on the LQA checks, and where every locale reaches first — is deliberately not reached for |
| stage | 关卡 | The gaming word for a playable level. **阶段 is exactly the process reading the term calls the single most likely mistranslation in the app**, and it appears nowhere in this locale. `stage-details:title` is “关卡详情”. Because 关卡 is spent here, *quality gate* had to take 质量门禁 |
| Text Styler | 文本样式器 | `colorText:title` is “文本样式器”, and `sidebar:colorText` and `strings:tabs` carry exactly the same five glyphs. Not 富文本编辑器, which names a different and more general kind of tool |
| element | 元素 | The heading over the seven elemental swatches (`colorText:groupElements`). The seven names themselves are **game content** and use the names the game ships in Simplified Chinese — 水、火、风、雷、草、冰、岩 — never a transliteration of the Greek roots |
| assistant | 助手 | The product’s AI chat persona, and a **role** rather than an act of assistance: 协助 is the near-miss the term warns about and is used nowhere. Settled at the first occurrence — the run-type labels — exactly as the term instructs: `strings:runs.typeChatGeneric` is “助手对话”. `colorText:assistant.title` prefixes it with the Latin AI and a half-width space; that citation is in `style/zh-hans.md` and not here, for the guard reason at the foot of this file — quoting it in this cell was tried and it failed, which is the evidence that note rests on. Chinese compounds without a linking form, so there is no linking note to record |
| theme | 主题 | The four names are byte-identical in `settings:themes.*.name` and `welcome:themeChooser.names.*` — 经典、像素、科技、极简 — which the term calls the highest-risk duplication in the app. Verified by diffing the two objects rather than from memory |
| guide | 指南 | The built-in documentation. `config:pseudoTestHelpLink` is “点击阅读指南 →”. Not 帮助, 文档 or 教程 — any of them could have been the word, using two of them is the bug |
| release | 发布 | `common:changelogShowOlder` is “显示更早的发布（{{count}}）”. **Both obvious Chinese words were unavailable**: 版本 is the version *number* by the term’s own definition, and 条目 is reserved for content |
| changelog | 更新日志 | The settled Simplified convention, and a **compound of the *log* root** two rows up rather than a rival to it — bare 日志 is always the live server-log panel, 更新日志 always this page, and English draws the same line between *log* and *changelog*. The alternatives each collided with something already taken: 更新记录 with *recording*, 版本说明 with *release notes*, which the term bars |
| dismiss | 清除 | **Two English senses, and this one destroys data**: `account:notificationsDismiss` issues a DELETE and the notification does not come back, so it ships as “清除” and never as 关闭 or 隐藏, either of which would make a false statement about the action. The non-destructive sense — `system:restarted.dismiss`, which closes a banner against a stored flag — ships as “关闭”. Both call sites were checked before choosing, which is what the term asks for |

## A tooling limit this file works around

Two rows above — *AI review* and *LQA* — describe a rendering that mixes Latin and Han
with a half-width space between them, and neither quotes it. That is not squeamishness;
the citation guard cannot verify such a value **from a lexicon cell**, and quoting it here
would fail the run.

The mechanism, so nobody re-opens it: `checkStyleGuide()` in
`scripts/check-lexicon-citations.mjs` lowers `minWordLength` to 2 for a locale in
`UNSPACED_SCRIPT_LOCALES`, because a two-character CJK compound carries a word's worth of
meaning. `checkLocaleLexicon()` — the path that reads *this* file — does not. So a candidate
such as the four characters of the AI-review feature name yields no “significant word” at
the default floor of 3, `renderingIsCovered()` falls back to matching the whole candidate
as one unit including its space, and the corpus is tokenized into pure-letter runs where a
space can never appear. The match cannot succeed for any correct value of that shape.

Reproduce it by moving the citation into a Notes cell here and re-running
`node scripts/check-lexicon-citations.mjs`; it passes in `docs/i18n/style/zh-hans.md` and
fails here, on the same string. Both Chinese locales, Korean and Japanese are exposed to it
the moment a term's settled rendering keeps a Latin acronym — which is common in Simplified
Chinese software vocabulary, not a corner case. Reported to the wave controller rather than
worked around in the strings.
