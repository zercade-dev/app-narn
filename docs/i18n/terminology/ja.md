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
| entry | エントリ | Batch 1. **Counter is 件**, always (`config:orphanedCount` is 「孤立{{count}}件」). No trailing ー: -y/-ry loans drop the long-vowel mark here (エントリ・カテゴリ・メモリ) while -er/-or/-ar loans keep it (サーバー・プロバイダー) — see `style/ja.md`. Rejected 項目, which is reserved for **form fields and vault key slots** (`config:routing.promptOptionsOptional`, `config:credentialsMissing`), and 行, reserved for **CSV rows** (`config:rowsProcessed`, `config:malformedRows_other`). `config:routing.simpleHint` says *string* in English and means an entry: rendered エントリ per the canonical-term rule. |
| source text | 原文 | Batch 1. Deliberately **not** the ソース of ソース言語／ソースラベル: 原文 is the idiomatic Japanese for the original text and is what makes every LQA description read naturally (`config:lqa.checks.whitespace-parity.description`). Reserved for the *text* sense only. |
| translation | 翻訳 | Batch 1. Noun and verb stem (翻訳する). |
| source label | ソースラベル | Batch 1. `config:routing.labelSources` shortens to 「ソース」, matching English's own shortened column heading. |
| achievement | 実績 | Batch 1. The word Japanese game platforms print (Xbox 実績). トロフィー is PlayStation-specific and would name a different platform's feature. |
| inline tag | インラインタグ | Batch 1. |
| placeholder | プレースホルダー | Batch 1, the double-brace-token sense only (`config:lqa.checks.mask-integrity.description`). The **input-hint** sense of the same English word is a different concept and is never rendered with this term — fold it into the label instead (`config:enableModulePlaceholder` is 「有効にするモジュールを選択…」, with no noun at all). |
| translator context | 翻訳者コンテキスト | Batch 1. `config:includeContext` is 「翻訳者コンテキストの列を含める」: the bare form without 翻訳者 would collide with コンテキストウィンドウ (`config:models.confidenceReason.prompt-near-context`), which the lexicon forbids. The shared コンテキスト root is licensed because the heads differ. |
| source language | ソース言語 | Batch 1. Pairs with ターゲット言語, which is why 原文言語 was rejected — it would have taken 原文 away from *source text*. |
| target language | ターゲット言語 | Batch 1. `config:targetLanguages` (plural) and `config:routing.labelTargetLanguage` (singular) are the same rendering: Japanese marks no plural. |
| reference language |  |  |
| writable language |  |  |
| Pseudo Test | 疑似テスト | Batch 1. The language code `pseudo-test` itself stays Latin, untranslated. |
| run | 実行 | Batch 1. Never ラン. Counted with 回, not 件 (`config:models.confidenceReason.batch-exceeds-reliable` is 「1回の実行で」). |
| Activity |  |  |
| batch | バッチ | Batch 1. |
| batch grouping | バッチのグループ化 | Batch 1. Deliberately a **process** noun (…化) so it can never be confused with ルールグループ (*rule group*) or バッチモード (*batch mode*). |
| AI review |  | Not yet met as a surface name. Do **not** render it with チェック — that word is taken by *check* below. |
| judge | 評価 | Batch 1, met only inside lists of run kinds (`config:batchGroupingDescription`). Evaluative sense; 裁く／裁判官 are the legal reading the lexicon warns about. |
| source review | 原文レビュー | Batch 1. |
| finding |  | Reserved: 指摘. Must stay distinct from 問題 (*issue*) — the two are listed on the same entry. |
| suggestion |  |  |
| discard | 破棄 | Batch 1, **unsaved-edits sense only** (`config:discard`, the ghost button beside Save). `config:discardUntranslatable` is the other English sense — dropping entries from an export — and takes 除外; 破棄 there would read as destroying the entries themselves. |
| needs review |  |  |
| flag |  | Not met in the review-queue sense. The LQA descriptions' English verb *flag* — as in "Flags translations longer than…" — is **not** this term: it means the check reports an issue, and is rendered 検出します (`config:lqa.checks.overflow.description`). Keep whatever word *flag* takes in batch 3/4 clear of 検出. |
| Review (the sidebar group) |  |  |
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
| issue | 問題 | Batch 1. Distinct from エラー, and reserved against 指摘 (*finding*). |
| severity | 重大度 | Batch 1. 重要度 rejected — that is priority, not how hard a check fails. The two **values** are fixed by *check*: ブロッキング / 警告. |
| notification severity |  | When batch 4 reaches it, 警告 must be byte-identical with `config:lqa.severityWarning`. |
| assertion | アサーション | Batch 1. A fourth word was genuinely needed: 条件 belongs to routing conditions, チェック to the LQA checks, ルール to routing rules. |
| pattern | パターン | Batch 1, regex sense only. No collision with テンプレート. |
| overflow | オーバーフロー | Batch 1. Kept clearly apart from 長さ制限 — both appear in the same checks list. |
| length limit | 長さ制限 | Batch 1. Covers the character cap, the UTF-8 byte cap **and** the routing condition (`config:routing.labelMaxLength` 「エントリの長さ制限」). 文字数制限 rejected because it silently excludes the byte bound. |
| pass rate |  | Reserved: 合格率 (not yet shipped — the term is not met in `config`). **The trap is real in Japanese too**: `config:health.successRate` is a different metric and ships 「成功：{{rate}}%」, so 成功率 must never be used for *pass rate*. `config:tm.lqaPassedBadge` 「LQA合格」 already establishes the 合格 root for this idea. |
| glossary | 用語集 | Batch 1. |
| glossary term | 用語 | Batch 1. Never エントリ — `config:lqa.checks.forbidden-terms.name` is 「禁止用語」 and `config:tm.clearAllSuccess_other` counts エントリ in the same file. |
| constant |  |  |
| match | 一致 | Batch 1. One root for the noun and the verb: `config:models.noMatches` 「検索条件に一致するモデルがありません」, `config:lqa.regexModeMustMatch` 「一致する」, `config:lqa.checks.number-parity.name` 「数字の一致」. |
| translation memory | 翻訳メモリ | Batch 1. トランスレーションメモリ rejected on length (twelve characters against five) and on idiom; メモリ alone would read as RAM. |
| approve | 承認 | Batch 1 (`config:tm.browserEmpty`). Distinct from 適用 (*apply*), レビュー済みにする (*mark as reviewed*) and 保存 (*save*) — all four meet in one bulk bar later. |
| category | カテゴリ | Batch 1. No trailing ー, per the -y rule under *entry*. |
| tone | トーン | Batch 1. The acoustic readings (音色・調子) are the trap; 文体 would read as the model's writing style. |
| orphan | 孤立エントリ | Batch 1. The state alone is 孤立 (`config:orphanedCount` 「孤立{{count}}件」, `config:importModeFullReplaceHint` 「孤立として扱われます」); the surface name adds エントリ. Note `config:fullReplaceOrphanNotice` says *Relink tab* in English, which does not exist — it ships 「孤立エントリタブ」. |
| relink | 再リンク | Batch 1. |
| backup | バックアップ | Batch 1. The verb is バックアップを作成; kept separate from エクスポート and スナップショット. |
| snapshot | スナップショット | Batch 1. `config:templatesDescription` uses the English word loosely for a saved configuration rather than a restore point; the same rendering is correct there. |
| template | テンプレート | Batch 1. モデル is the dangerous near-miss the lexicon names and is already taken by *model*. |
| collaborator |  |  |
| member |  |  |
| nickname |  |  |
| claim |  |  |
| invite |  |  |
| recording |  | Must not reuse エントリ's word. 記録 is the obvious candidate and is still free. |
| stage |  | ステージ (the gaming word). 段階／工程 are the process readings. Not yet met. |
| Text Styler |  |  |
| element |  |  |
| theme |  |  |
| guide | ガイド | Batch 1 (`config:pseudoTestHelpLink`). One word — ヘルプ／マニュアル／ドキュメント must not alternate with it. |
| release |  |  |
| changelog |  |  |
