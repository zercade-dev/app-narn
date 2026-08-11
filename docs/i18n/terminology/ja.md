# NARN terminology — Japanese (`ja`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/ja.md`](../style/ja.md) — how Japanese is written here: register, punctuation,
  capitalization, plural and agreement rules. That one is yours to write too, for this
  locale only.

Fill a row when you meet the term, in the same change that introduces the wording — so
this file records decisions actually taken, never predictions. Use **Notes** for anything
the next translator would otherwise have to rediscover: a declension that forced a
different word, a term you deliberately left in English, an acronym you expanded, a
candidate you rejected and why.

Terms are in the order they appear in `../terminology.md`. Do not add, remove or reorder
rows: a term the lexicon lacks goes in the additive queue in [`README.md`](README.md).

**Quoting convention, so every claim here is checkable.** 「…」 marks a span quoted
**verbatim from a shipped value** — never truncated with an internal `…`, so it can be
verified by substring search. A rejected candidate, an English source phrase, or a bare
lexeme under discussion is written in plain text or *italics*, never in 「…」. The citation
guard did not read 「…」 as a citation at all until the wave fixed it, which is exactly how a
stale quote in the *pass rate* row survived batch 1's own review.

| Term | Rendering | Notes |
| --- | --- | --- |
| project | プロジェクト | Batch 1 (`config`). Verb is 作成 (`config:duplicateProject` is 「プロジェクトを複製」). |
| workspace | ワークスペース | Batch 1. Never abbreviated, and never the same word as プロジェクト — `config:batchGroupingDefaultOption` 「ワークスペース設定を使用」 sits directly opposite the project value. |
| entry | エントリ | Batch 1. **Counter is 件**, always (`config:orphanedCount` is 「孤立{{count}}件」). No trailing ー: -y/-ry loans drop the long-vowel mark here (エントリ・カテゴリ・メモリ) while -er/-or/-ar loans keep it (サーバー・プロバイダー) — see `style/ja.md`. Rejected 項目, which is reserved for **form fields and vault key slots** (`config:routing.promptOptionsOptional`, `config:credentialsMissing`), and 行, reserved for **CSV rows** (`config:rowsProcessed`, `config:malformedRows_other`). `config:routing.simpleHint` says *string* in English and means an entry: rendered エントリ per the canonical-term rule. Batch 2: where English itself says **row** rather than entry, Japanese follows English and counts 行, not 件 — `strings:bulk.rowsSelected_other` 「{{count}}行を選択中」 against `strings:compare.selectedCount` 「{{count}}件を選択中」. The two English strings differ ("{{count}} rows selected" vs "{{count}} selected"), so the two renderings differ; this is faithfulness, not drift. |
| source text | 原文 | Batch 1. Deliberately **not** the ソース of ソース言語／ソースラベル: 原文 is the idiomatic Japanese for the original text and is what makes every LQA description read naturally (`config:lqa.checks.whitespace-parity.description`). Reserved for the *text* sense only. |
| translation | 翻訳 | Batch 1. Noun and verb stem (翻訳する). Batch 2 settles the **tab label**: `strings:tabs.strings` is 「翻訳」, which `config:routing.categoriesConfiguredHint` 「カテゴリは翻訳タブで設定します。」 already named in batch 1 — the two agree. Japanese marks neither number nor the noun/verb split, so *Translations* and *Translation* land on the same 翻訳 (`strings:tabs.strings`, `strings:runs.judgeTargetLabel`, `strings:runs.typeTranslation`); that collapse is licensed. **English's *Translate* does NOT** — `strings:guide.groupTranslate` ships 「翻訳作業」, and `sidebar:groups.translate` (batch 4, byte-identical English) must copy **「翻訳作業」**, never 翻訳. It names the sidebar group that contains `strings:tabs.strings`, so 翻訳 there would put the heading directly above an identically-named child. See the group-heading section of `style/ja.md`; this row is the file batch 4 opens first, which is why the exception is stated here and not only there. The dead name *Multi-language Text* appears nowhere. |
| source label | ソースラベル | Batch 1. `config:routing.labelSources` shortens to 「ソース」, matching English's own shortened column heading; `strings:filters.allSources` 「すべてのソース」 follows it. Not to be confused with the *file*: `strings:columns.tooltipSource` is English "Source file" and ships 「ソースファイル」, and `strings:columns.tooltipAchievementSource` 「実績のソース」. |
| achievement | 実績 | Batch 1. The word Japanese game platforms print (Xbox 実績). トロフィー is PlayStation-specific and would name a different platform's feature. |
| inline tag | インラインタグ | Batch 1. |
| placeholder | プレースホルダー | Batch 1, the double-brace-token sense only (`config:lqa.checks.mask-integrity.description`). The **input-hint** sense of the same English word is a different concept and is never rendered with this term — fold it into the label instead (`config:enableModulePlaceholder` is 「有効にするモジュールを選択…」, with no noun at all). |
| translator context | 翻訳者コンテキスト | Batch 1. `config:includeContext` is 「翻訳者コンテキストの列を含める」: the bare form without 翻訳者 would collide with コンテキストウィンドウ (`config:models.confidenceReason.prompt-near-context`), which the lexicon forbids. The shared コンテキスト root is licensed because the heads differ. **Batch 2 licenses the bare コンテキスト inside the Compare tab only** — `strings:compare.addContext` 「+コンテキスト」 and `strings:compare.emptyContextFilter` 「コンテキストが空」 are a chip and a filter label sitting beside `strings:compare.editContext` 「翻訳者コンテキストを編集」, which establishes the full term in the same toolbar, and no context-window concept exists anywhere in `strings`. Outside a surface that establishes it, write 翻訳者コンテキスト. |
| source language | ソース言語 | Batch 1. Pairs with ターゲット言語, which is why 原文言語 was rejected — it would have taken 原文 away from *source text*. |
| target language | ターゲット言語 | Batch 1. `config:targetLanguages` (plural) and `config:routing.labelTargetLanguage` (singular) are the same rendering: Japanese marks no plural. |
| reference language | 参照言語 | Batch 2. `strings:compare.translateUseReferenceNone` is 「参照言語をコンテキストとして使用する」 — the dictionary-form checkbox shape, not 体言止め. The Compare toolbar picker shortens to 「参照」 (`strings:compare.reference`), mirroring English's own short/long split at `translateUseReference` vs `translateUseReferenceNone`. Never ソース言語 — a reference is a reading aid, never a second source. |
| writable language |  |  |
| Pseudo Test | 疑似テスト | Batch 1. The language code `pseudo-test` itself stays Latin, untranslated. |
| run | 実行 | Batch 1. Never ラン. Counted with 回, not 件 (`config:models.confidenceReason.batch-exceeds-reliable` is 「1回の実行で」). Batch 2 confirms the **noun-only** rule at the standalone label `strings:compare.run` 「実行」 (the Compare-toolbar run picker — the noun, per `english-review-notes.md`). One friction to know about: 実行中 is also the natural rendering of the *status* "Running" (`strings:runs.statusRunning`), so counting active runs as 実行中の実行 stutters; `strings:runs.activeRuns_other` ships 「進行中の実行{{count}}回」 and its sibling 「待機中の実行{{count}}回」 keeps the pair parallel. |
| Activity | アクティビティ | Batch 2 (`strings:tabs.runs`). **The kanji candidates are all on the lexicon's Not-list**: 履歴 is *history*, ログ is *log* (taken by the live server-log panel), 実行履歴 contains 履歴. アクティビティ is the surviving word and is what Japanese SaaS navigation calls this surface. The page title expands, deliberately: `strings:runs.title` is 「翻訳アクティビティ」. 履歴 stays free as an ordinary noun where English itself says *history* — `strings:tabPlaceholder.runs` and `strings:runs.emptyState` render "activity history" as 「アクティビティ履歴」. |
| batch | バッチ | Batch 1 — the request-packing sense, which is the only sense the lexicon defines (バッチモード, バッチサイズ, `config:batchGroupingLabel` 「バッチのグループ化」). **Batch 2: English's "Batch translate" at `strings:compare.translateDialogTitle` is not this term** — it is a user action over selected rows, which the lexicon tells you to keep distinct from *batch*, so it ships 「一括翻訳」 alongside `strings:bulk.bulkOperation` 「一括操作」. 一括 is the bulk-action root; バッチ stays the request-packing word. |
| batch grouping | バッチのグループ化 | Batch 1. Deliberately a **process** noun (…化) so it can never be confused with ルールグループ (*rule group*) or バッチモード (*batch mode*). |
| AI review | AIレビュー | Batch 2. `strings:runs.judgeBadge`, `strings:guide.topicAiReview`. Not チェック — that word is taken by *check* below, and `strings:runs.aiReviewChecksLabel` is a literal English "Checks" and correctly ships 「チェック」. The two tabs specialise it: 「原文AIレビュー」 (`strings:tabs`, review-source-ai) and 「翻訳AIレビュー」 (`strings:tabs`, review-translation-ai). Half-width AI, no 中黒, no space. |
| judge | 評価 | Batch 1, met only inside lists of run kinds (`config:batchGroupingDescription`). Evaluative sense; 裁く／裁判官 are the legal reading the lexicon warns about. **Batch 2 owns thirty-odd `strings:runs.judge*` keys and 評価 appears in none of them** — deliberately, per the lexicon's "do not introduce 'the judge' as a noun in a locale where English does not use it": the key names say *judge*, the values say AIレビュー, 提案, 指摘 and スコア. |
| source review | 原文レビュー | Batch 1. |
| finding | 指摘 | Batch 2 — the reservation is now shipped. `strings:runs.judgeAllFindingsTitle` 「すべての指摘」, `strings:runs.judgeViewAll` 「指摘を表示・未処理{{count}}件」. Distinct from 問題 (*issue*, a machine verdict) — the two are listed on the same entry. English's *flagged* in `strings:runs.judgeSummary` names the same object and ships 「指摘あり」, **not** the *flag* term below. |
| suggestion | 提案 | Batch 2. `strings:runs.judgeSuggestionLabel` 「提案」. The action on it is 適用 (*apply*), never 承認 — `strings:runs.judgeApproveAll` says *Approve all suggestions* in English for the very same action and ships 「すべての提案を適用」, per the lexicon's known-copy-bug instruction. Refusing one is 却下 (*discard*, sense 2). |
| discard | 破棄 | **Two senses, two words, both now shipped — this column can only hold one, and it holds sense 1.** Sense 1, unsaved edits — 破棄 (`config:discard`, `strings:editor.discard`, both the ghost button beside Save). Sense 2, refusing something offered — **却下** (`strings:runs.judgeDiscard`, `strings:runs.judgeDiscardSuccess` 「提案を却下しました」); 破棄 there would read as destroying the suggestion's subject rather than declining it. Batch 3's `glossary:generateDiscard` and batch 6's `colorText:assistant.discard` are sense 2 and take 却下. `config:discardUntranslatable` is a **third** English sense — omitting rows from an export — and takes 除外 (queued in `README.md`). |
| needs review | 要レビュー | Batch 2. One rendering across all three surfaces the lexicon names: the filter (`strings:filters.needsReview`, `strings:compare.needsReviewFilter`), the deliberately lowercase cell badge (`strings:compare.cellNeedsReviewBadge` — Japanese has no case, so the badge is byte-identical to the filter and that is licensed, not drift), and the bulk action `strings:compare.flagAllNeedsReview` 「すべてを要レビューにする」. Japanese needs no gender agreement, so the whole es/fr "reviewed" family question does not arise here. |
| flag |  | **Still not met in the review-queue sense** (`review:flag`) — batch 3 owns it. Three words are now taken and it must avoid all three: 検出 is the LQA sense (`config:lqa.checks.overflow.description` 「…を検出します」), **要レビューにする is the mark-as-needs-review action** (`strings:compare.flagAllNeedsReview`) which this term *clears*, and 指摘 is *finding*. The noun *flag* as a UI marker is a separate, non-term use and ships as フラグ (`strings:filters.clearNewFlags` 「新規フラグを解除（{{count}}）」, `strings:contextMenu.clearNeedsReview`); that does not reserve フラグ for this term. |
| Review (the sidebar group) | レビュー | Batch 2 (`strings:guide.groupReview`); `sidebar:groups.review` must copy it. Elimination: 校閲 claims the group for the human member, 検証／確認 claim it for the machine-checking member (*Quality*), 品質管理 claims it for Quality outright. The survivor レビュー is a loanword with no strong sub-sense in Japanese, so it stays the umbrella while each member specialises it — 原文AIレビュー／翻訳AIレビュー／手動レビュー — exactly as English's own vague "Review" does. |
| review queue |  |  |
| module | モジュール | Batch 1. |
| module instance | インスタンス | Batch 1. Long form モジュールインスタンス where the sentence has not yet established モジュール (`config:routing.deletedInstanceWarning`). |
| provider | プロバイダー | Batch 1. Trailing ー per the -er rule. Kept even in the three English strings that mislabel a module picker as *Provider* — `config:routing.simplePlaceholder` ships 「プロバイダーを選択」, per the lexicon's instruction to translate those three as written. |
| model | モデル | Batch 1. Never used for *template*, which takes テンプレート. |
| prompt | プロンプト | Batch 1. Distinct from リクエスト (`config:requestTimeoutLabel`) and from 検索 (`config:models.noMatches`). |
| reasoning effort | 推論の強度 | Batch 1. 努力 rejected: it reads as effort expended by a person. |
| routing rule | 振り分けルール | Batch 1. ルーティング in Japanese reads as **network** routing, which the lexicon forbids; 振り分け is content distribution. The same root carries `config:routing.routesTo` 「振り分け先」 and `config:routing.modeAriaLabel` 「振り分けエディターのモード」. |
| rule group | ルールグループ | Batch 1. |
| credential vault | 保管庫 | Batch 1. The word Japanese password managers ship (1Password / Bitwarden 保管庫). Checked against all four required frames before deciding: 認証情報の保管庫 / 保管庫はロック中 (`config:credentialsVaultLockedChip`) / 保管庫のロックを解除 (`config:credentialsUnlockButton`) / 保管庫のパスワード. |
| credential | 認証情報 | Batch 1. `config:credentialsMissing` calls the vault's key slots 項目, never エントリ. |
| LQA | LQA | Batch 1. Kept as the industry acronym — Japanese localization vendors use LQA untranslated, so no expansion is recorded. |
| quality gate | ゲート | Batch 1. English also says bare *the gate* once *quality checks* has been said, and Japanese does the same: `config:lqa.description` carries 「ブロッキングの問題はゲートを通過できず」 after it has said 「品質チェック」. 門／関門 are the physical-door readings the lexicon warns about. |
| check | チェック | Batch 1. One word across 品質チェック, LQAチェック and every individual check name. |
| issue | 問題 | Batch 1. Distinct from エラー, and reserved against 指摘 (*finding*), which batch 2 now ships. `strings:row.lqaIssues_other` is 「LQAの問題{{count}}件」 — an LQA verdict is counted with 件. |
| severity | 重大度 | Batch 1. 重要度 rejected — that is priority, not how hard a check fails. The two **values** are fixed by *check*: ブロッキング / 警告. |
| notification severity |  | When batch 4 reaches it, 警告 must be byte-identical with `config:lqa.severityWarning`. |
| assertion | アサーション | Batch 1. A fourth word was genuinely needed: 条件 belongs to routing conditions, チェック to the LQA checks, ルール to routing rules. |
| pattern | パターン | Batch 1, regex sense only. No collision with テンプレート. |
| overflow | オーバーフロー | Batch 1. Kept clearly apart from 長さ制限 — both appear in the same checks list. |
| length limit | 長さ制限 | Batch 1. Covers the character cap, the UTF-8 byte cap **and** the routing condition (`config:routing.labelMaxLength` 「エントリの長さ制限」). 文字数制限 rejected because it silently excludes the byte bound. |
| pass rate |  | Reserved: 合格率 (not yet shipped — the term is not met in `config`). **The trap is real in Japanese too**: `config:health.successRate` is a different metric and ships 「成功：{{rate}}%」, so 成功率 must never be used for *pass rate*. `config:tm.lqaPassedBadge` 「LQA合格」 already establishes the 合格 root for this idea. |
| glossary | 用語集 | Batch 1. |
| glossary term | 用語 | Batch 1. Never エントリ — `config:lqa.checks.forbidden-terms.name` is 「禁止用語」 and `config:tm.clearAllSuccess_other` counts エントリ in the same file. Counter is 語, never 件. Batch 2: the same lexeme carries English's literal "Terminology" at `strings:runs.aiReviewCheckTerminology` and `strings:runs.judgeIssueTerminology` 「用語」, and the guide group `strings:guide.groupContent` 「用語」 — one word family, not a rival rendering. Where the English means *words in the source text* rather than a glossary row, 用語 is wrong and the batch ships 語句: `strings:order.presortHint` 「原文の語句が似ているエントリをまとめ…」. |
| constant |  |  |
| match | 一致 | Batch 1. One root for the noun and the verb: `config:models.noMatches` 「検索条件に一致するモデルがありません」, `config:lqa.regexModeMustMatch` 「一致する」, `config:lqa.checks.number-parity.name` 「数字の一致」. |
| translation memory | 翻訳メモリ | Batch 1. トランスレーションメモリ rejected on length (twelve characters against five) and on idiom; メモリ alone would read as RAM. |
| approve | 承認 | Batch 1 (`config:tm.browserEmpty`). Distinct from 適用 (*apply*), レビュー済みにする (*mark as reviewed*) and 保存 (*save*). **Batch 2 is the bulk bar where all four meet, and all four are visibly different there.** 承認 is not a movement verb in Japanese, so 「翻訳メモリに承認」 is ungrammatical; `strings:bulk.approveSelected` ships 「承認して翻訳メモリに追加」, keeping 承認 in first position so the promotion — not the storing — is what the user reads first. 追加 is the app's generic *add* and carries no reserved sense. |
| category | カテゴリ | Batch 1. No trailing ー, per the -y rule under *entry*. |
| tone | トーン | Batch 1. The acoustic readings (音色・調子) are the trap; 文体 would read as the model's writing style. |
| orphan | 孤立エントリ | Batch 1. The state alone is 孤立 (`config:orphanedCount` 「孤立{{count}}件」, `config:importModeFullReplaceHint` 「孤立として扱われます」); the surface name adds エントリ. Note `config:fullReplaceOrphanNotice` says *Relink tab* in English, which does not exist — it ships 「孤立エントリタブ」. |
| relink | 再リンク | Batch 1. |
| backup | バックアップ | Batch 1. The verb is バックアップを作成; kept separate from エクスポート and スナップショット. |
| snapshot | スナップショット | Batch 1. `config:templatesDescription` uses the English word loosely for a saved configuration rather than a restore point; the same rendering is correct there. |
| template | テンプレート | Batch 1. モデル is the dangerous near-miss the lexicon names and is already taken by *model*. |
| collaborator | 共同作業者 | Batch 2 (`strings:runs.projectTotalCollaborators`, `strings:runs.manualRecordingPaused`). Elimination: the lexicon's Not-list bans *editor*, which rules out the otherwise-obvious 共同編集者 — and the collision is live rather than theoretical, because `strings:runs.manualEditedByColumn` ("Edited by") ships 「編集者」 in this same namespace; コラボレーター is an unnecessary loan where a kanji compound is idiomatic. The survivor 共同作業者 means "a person who works on it jointly", which is what a collaborator is — and it leaves メンバー free for *member*, which batch 4 needs as a separate word. |
| member |  |  |
| nickname |  |  |
| claim |  |  |
| invite |  |  |
| recording | 記録 | Batch 2 (`strings:runs.manualRecordingPaused` 「記録を一時停止中：参加中の共同作業者がいません」). 記録 does not collide with エントリ, so the lexicon's warning ("Recording paused" must not read as "Entry paused") is satisfied by construction in Japanese. |
| stage | ステージ | Batch 2 — met as the tab label `strings:tabs` (stage-details) 「ステージ詳細」, which `stage-details:title` must copy verbatim. The gaming word. 段階／工程 are the process readings the lexicon calls the single most likely mistranslation in the app; ステージ carries the playable-level sense unambiguously in Japanese game copy. |
| Text Styler | テキスト装飾 | Batch 2 (`strings:tabs`, color-text); `colorText:title` and `sidebar:colorText` must copy it exactly. Elimination: スタイルエディター is the lexicon's banned *style editor*; テキストエディター／書式ツール are the banned *text editor*／*formatter*; テキストスタイラー is a bare transliteration that names nothing to a Japanese reader, against `style/ja.md`'s standing preference for the kanji compound wherever both are idiomatic. **The length budget did not decide this and must not be cited as if it had** — an earlier version of this row argued テキストスタイラー was too long, which was wrong twice over: it is 9 full-width equivalents against a container that fits 14, and the container had been mis-described as a scrolling tab bar when it is in fact the sidebar. Both candidates fit comfortably; the choice is the kanji-over-katakana rule and the lexicon's Not-list, nothing else. The survivor テキスト装飾 means "text decoration/styling", which is exactly what the tool does — apply colour and formatting tags to game text. |
| element |  |  |
| theme |  |  |
| guide | ガイド | Batch 1 (`config:pseudoTestHelpLink`). One word — ヘルプ／マニュアル／ドキュメント must not alternate with it. Batch 2 ships the whole `strings:guide.*` topic tree; the word *guide* itself does not appear in any of those values, so nothing there re-decides this row. |
| release |  |  |
| changelog |  |  |
