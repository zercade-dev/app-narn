# Style guide — Japanese (ja)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/ja.md`. This file settles register, casing, punctuation, length and
placeholder handling.

**Every key cited below is a key this locale has actually translated** — after batch 6 that is
**all twenty-four** namespaces: `config` (batch 1), `strings` (batch 2), `glossary` / `review` /
`category` / `quality` (batch 3), `collab` / `account` / `vault` / `settings` / `sidebar`
(batch 4), `logs` / `console` / `system` / `errors` / `generation` / `batch` (batch 5) and
`stage-details` / `colorText` / `orphans` / `backup` / `welcome` / `common` / `legal` (batch 6).
The constraint that produced this list is deliberate and still binds anything written here
later: **do not prescribe a rendering for a key in a namespace you have not
translated.** The original scaffold of this file illustrated nine rules with `vault:*`,
`sidebar:*`, `strings:*`, `common:*`, `logs:*` and `category:*` examples; each of those was a
guess that the batch owning the key would have inherited as a settled decision. They have been
replaced with shipped equivalents. Naming a key as a *class anchor* (the budget table below), or
as the second home of a surface name, is fine — that is a pointer, not a rendering.

**(Batch 5 corrects this paragraph rather than rewriting it away.** It enumerated only batches
1-3 and said "and nothing else" — batch 4 then cited `vault:*`, `collab:*`, `sidebar:*`,
`settings:*` and `account:*` throughout this file and did not come back to the sentence that
said it had not. The *rule* was never broken; the list of namespaces it named went stale the
moment the next batch shipped. A list of what exists is a standing claim, and it is re-derived
whenever anything is added to the file. **Batch 6 re-derived it again**, which is the last time
it can move: the language is complete, so the pointer-only clause has nothing left to point at.)

**Two pointers this file wrote about batch 6 were wrong about what batch 6 contains, and both
are corrected below rather than deleted** — the line at the ～にする row and the one closing the
collapse-boundary section each named *Close* as a `common` key. **`common` has eleven keys and
none of them is *Close***: `save`, `cancel`, `loading`, `changelogEntryError`,
`changelogShowOlder`, `saving`, `thinking` and four `webSearch.*`. *Close* occurs nowhere in
this batch's 282 keys, and *Back* is `orphans:actions.back`, not a `common` key. Both sentences
were written from an expectation of what a "common" namespace holds, never from
`locales/en/common.json` — the same failure the runbook's rule 3 names, committed about a file
one command away. The prediction they were making (that the collapse boundary would be tested
by repeated bare controls) was **right**; the keys it named were not.

**Quoting convention, so every claim here is checkable.** 「…」 marks a span quoted
**verbatim from a shipped value** — never truncated with an internal `…`, so it can be
verified by substring search against `locales/ja/`. A rejected candidate or an English source
phrase is written in plain text or *italics*, never in 「…」. The convention is what makes a hand
check cheap: batch 1's review found five defects among its 53 key-naming spans, including one
key quoted two incompatible ways in the same file.

**This file IS guarded, and two sentences in this block used to say it was not.** They read
"nothing guards a rendering quoted here" and "Nothing guards this file"; both were true when
batch 1 wrote them and false by the time batch 3 ran, because `scripts/check-lexicon-citations.mjs`
was extended to read the style guides as well as the lexicons. It reports its own scope on every
run ("style guide(s) checked"), and batch 5 falsified the claim by experiment rather than by
reading: appending one invented 「…」 citation of a real key to this file makes the guard print
`FAIL — ja (style guide)` naming that key, and removing it makes the run green again. So a
「…」 span here is a **falsifiable claim about the shipped file**, exactly like a lexicon row's,
and a backticked function name with parentheses in it is read as one too — the guard's own
key-shaped-span exemption does not cover parentheses, and batch 5 hit that inside this very
round. Put anything that is not a shipped rendering in *italics*. **Do not quote the guard's
citation counter anywhere**: it is global across every locale and moved by three between two
runs in this batch alone.

## Register

**ですます体 (polite non-honorific).** Sentences and messages end in です / ます:
`config:credentialsVaultLocked` is
「保管庫がロックされています。このモジュールの認証情報を使うには、ロックを解除してください。」
Do not escalate into 尊敬語 or 謙譲語 — "ご確認いただけますでしょうか" is the register of a
customer-support email, not of a tool the user runs themselves. Do not drop into である体
either.

**Controls and labels use 体言止め — the noun form, with no verb ending.** `config:delete`
is 「削除」, not 「削除します」; `config:cancelImport` is 「キャンセル」; `config:tm.clearAll`
is 「すべて消去」. This is the single most visible marker of a properly localized Japanese UI,
and it holds for **confirm buttons too**: `config:tm.clearAllConfirm` ("Yes, clear all") is
「はい、すべて消去」 — never the ～します form. Batch 1 shipped that key the wrong way and it was
caught in review — the fix matters beyond the one string, because batch 4 is almost entirely
confirm buttons and would have inherited the precedent.

**"Please try again." is 「もう一度やり直してください。」 — settled in batch 4, which met it seven
times.** The tempting *もう一度お試しください* is the お～ください pattern, and **no shipped `ja` value
in batches 1-3 uses one** (checked by grep over all six namespaces, zero hits): the established shape
is *もう一度〈verb〉てください*, as in `config:exportRoundtripWarning_other`
「もう一度インポートする前に」. やり直す is the generic member of that family, so the same sentence
covers `account:errorGeneric`, `mfaErrorEnroll`, `mfaErrorVerify`, `devicesError`,
`deviceForgetError`, `vault:errorInvalidPassword`, `vault:retryFailed` and
`collab:errors.join_failed`/`unknown_error` without alternating. Where the English names the action
to repeat, Japanese names it too (`vault:retryPartialFailed` 「失敗した操作をもう一度実行してください。」).
The button label *Retry* / *Try again* is a different control and keeps 「再試行」
(`collab:routing.retry`, matching the shipped `glossary:generateTryAgain`).

**Never write あなた.** Japanese software does not address the user with a pronoun.
`config:models.pricingNote` renders English's "with your own keys" with no possessive at
all: 「翻訳では、設定したキーを使って各プロバイダーのAPIを直接呼び出します。」

## Control shapes — decided in batch 1, extended twice in batch 2, binding on every later batch

English writes the same words for a title, a button, a column header and a placeholder;
Japanese does not. Resolve the control **before** writing the string.

| Control | Shape | Batch-1 example |
| --- | --- | --- |
| Page / section / dialog title | bare noun phrase (体言止め), no verb, no 。 | `config:reviewProgress` 「レビューの進捗」, `config:models.pickTitle` 「モデルの選択」 |
| Button | 〈object〉を〈verb-stem〉 — an action phrase that still ends on the verb stem, never ～します | `config:duplicateProject` 「プロジェクトを複製」, `config:instances.createButton` 「インスタンスを作成」 |
| Button whose action has no サ変 noun | 〈object〉を〈state〉にする — the 「既読にする」 shape, dictionary form, still never ～します | `strings:shortcuts.markReviewed` 「レビュー済みにする」, `strings:compare.flagAllNeedsReview` 「すべてを要レビューにする」 |
| Confirm-dialog title | **same as the button it confirms** | `config:deleteProject` and `config:confirmDeleteTitle` are both 「プロジェクトを削除」, because their English is identical too. Where English differs, follow English. |
| Table column header | bare noun, shortest defensible form | `config:models.colConfidence` 「信頼度」, `config:models.colContext` 「コンテキスト」 |
| Select option / value label | bare noun or 〈noun〉ごと, never a sentence | `config:module.batchByLanguage` 「言語ごと」, `config:lqa.severityBlocking` 「ブロッキング」 |
| Checkbox / radio label **whose English is a verb phrase** | dictionary-form verb phrase (～する／～しない), **not** 体言止め: the user is choosing what the app will do, not naming a thing | `strings:compare.translateModeRetranslate` 「既存の翻訳を再翻訳する」, `strings:compare.translateDisableMemory` 「この実行では翻訳メモリを使用しない」, `strings:compare.translateUseReferenceNone` 「参照言語をコンテキストとして使用する」 |
| Checkbox label whose English is a **noun phrase** naming a mode | follow English — 体言止め | `strings:runs.aiReviewVerbose` 「詳細ログ（プロンプト・パラメーター・生の応答）」 |
| Placeholder inside a control **whose English is an instruction** | ～を選択／～を入力 + 「…」, no noun for the control itself | `config:enableModulePlaceholder` 「有効にするモジュールを選択…」 |
| Placeholder **whose English is a descriptive noun phrase** | noun phrase — follow English, do not convert it into an instruction | `stage-details:fields.name.placeholder` 「ステージの名前」 over "The stage's name", `stage-details:fields.gameplayDetails.placeholder` 「ステージの遊び方」 over "How the stage plays". Added in batch 6, which met the first placeholders in this app that describe the content rather than command the user. **Follow English on how far the placeholder sits from its own label** — do not manufacture a distinction English does not make. Two of the three pairs separate naturally (label 「名前」 over 「ステージの名前」, label 「ゲームプレイ詳細」 over 「ステージの遊び方」); the third is label 「ステージ説明」 over placeholder 「ステージの説明」, a one-particle difference, and English's own pair is just as close ("Stage description" / "A description of the stage"). That is faithful, not a defect. **(The first version of this cell said "keep the placeholder distinct from its own label", which promised a distinctness the third pair does not deliver and English does not ask for.)** |
| Progress / status text | ～中 or ～しました — a state, never a command. The **ellipsis is English's to give**, not the shape's: add 「…」 only where the source has one | `config:duplicating` 「複製中…」 and `config:autoSaveSaved` 「保存しました」 (English has the ellipsis); `strings:row.translating` 「翻訳中」 and `strings:runs.statusQueued` 「待機中」 (English has none) |
| Description / help / toast | full ですます sentence ending in 。 | `config:maxBackupsDescription` |
| Inline fragment in a summary row | noun + なし / 指定なし, no verb, no 。 | `config:routing.anySource` 「ソース指定なし」, `config:routing.noModule` 「モジュールなし」 |
| Empty-state title | bare clause, and it takes 。 **only where English does** | `glossary:emptyTermsTitle` 「この用語集にはまだ用語がありません」 and `review:emptyTitle` 「レビューキューは空です」 (no period in en, none here); `category:noSuggestions` 「モデルからカテゴリの提案はありませんでした。」 (en has one) |
| Field label whose English *reads* as a verb phrase | noun phrase anyway — resolve the control, not the wording | `glossary:generateFocusSourceTextsLabel` ("Focus on source texts") is a `<Label>` over a textarea at `GenerateGlossaryDialog.tsx:699` and ships 「絞り込む原文」, not a ～する form |
| Button whose action has **neither** a サ変 noun **nor** a state to set | plain dictionary form (閉じる, 開く, 戻す, 折りたたむ) — not 体言止め, and not ～にする | `glossary:close` 「閉じる」, `review:openDetails` 「詳細を開く」, `review:undo` 「元に戻す」. Added in the batch-3 fix round: these three shipped correctly but had no row, and batch 4 is almost entirely buttons. **The clause that used to end this cell — "and *Close* recurs in batch 6's `common`" — is false and is left visible: `common` has no *Close* key** (see the correction at the head of this file). The row still earned batch 6: `orphans:actions.back` 「戻る」 and `welcome:themeChooser.confirm` 「この設定を使う」 are both verbs with neither a サ変 noun nor a state to set |

**A pair of opposite controls may legitimately take two different shapes, and batch 5 shipped one.**
`console:expand` / `console:collapse` and `system:countdown.expand` / `countdown.collapse` are
`aria-label`s on one toggle button (`ConsolePanel.tsx:386`, `RestartBanners.tsx:117`), and they ship
「展開」 and 「折りたたむ」 — 体言止め on one side, plain dictionary form on the other. That is not drift:
展開 **is** a サ変 noun and therefore takes the 体言止め row, while *collapse* has no サ変 noun at all
(折りたたみ names the fold, not the act) and falls to the plain-dictionary row above. Forcing symmetry
would mean either *展開する*, which breaks 体言止め, or *折りたたみ*, which is not a Japanese button
label. The English pair is symmetric and the Japanese one is not, because the two verbs are not the
same kind of word — resolve the shape from the verb, not from the sibling.

**Why the ～にする row exists.** The button shape above ends on a サ変 noun (複製, 作成), which
needs a verb-forming noun to end on. *Mark as reviewed* and *Flag as needs review* have none —
レビュー済み and 要レビュー are states, not actions — so batch 2 added the shape Japanese actually
uses for setting a state, the same one 「既読にする」 uses. It is the dictionary form, not ～します,
so it does not breach the 体言止め rule above; and it keeps the two opposite actions symmetrical,
which the lexicon requires (marking reviewed and flagging for review set and clear the same state).

**The trigger label and the dialog title of the same picker are different controls even
when English is byte-identical.** `config:models.select` (the closed combobox's own label)
is 「モデルを選択」 and `config:models.pickTitle` (the dialog it opens) is 「モデルの選択」.
This is the one same-English/different-rendering group in batch 1 and it is deliberate.

**Batch 4 adds the third such split, on the same grounds, and it must be recorded here rather than
only in a batch report** — `i18n-preflight` check 2 reports every one of these on every future run,
and an unexplained hit is one a later translator will "fix". English's **"Join project"** takes two
renderings:

- `sidebar:joinProject` 「プロジェクトへの参加」 — the `TabsTrigger` of the New Project sheet
  (`Sidebar.tsx:846`), a section label, so the **noun phrase**.
- `collab:join.joinButton` 「プロジェクトに参加」 — the submit button of the form inside that very
  `TabsContent`, so the **action phrase**.

The two **co-render nested**, which is why the split is not optional: rendering them alike would put
an identical label directly above its own panel's button — the `sidebar:groups.translate` shape in miniature.
`collab:join.title` ("Join a project", the `<h1>` of the standalone `/join` view at
`AppShell.tsx:502-504`) takes the noun phrase too, so it is **byte-identical to `sidebar:joinProject`**
— an equality that is licensed and reachable rather than merely theoretical: the `/join` view is
routed by URL (`lib/url-state.ts:37`), not from the rail, so ordinary navigation never paints both,
but opening the New Project sheet over that view does. Licensed because the two English strings name
one activity and differ only by an article, which carries nothing into Japanese.

**And the second split, which binds nobody but is recorded so nobody hunts for a rule.** English's
**"Default"** is 「既定」 in `config` (three keys: `module.reasoningEffortDefault`,
`routing.modelDefault`, `routing.defaultGroupName`) and 「デフォルト」 at
`settings:previewSamples.badgeDefault`. Two senses, not one: config's is *the default value to
inherit*, while the settings one names a **shadcn badge variant** in a four-member set whose other
three (「セカンダリ」「アウトライン」「デストラクティブ」) have no idiomatic kanji form — forcing 既定
into that set would break the paradigm, which is the error runbook 2.1 names. They cannot co-render
(`SettingsView` and `GlobalConfigView` are mutually exclusive `view` values). This note exists to stop
the collision report being read as a defect.

**Batch 6 falsified the sentence that used to close this paragraph and it is corrected here rather
than dropped.** It read "**`badgeDefault` is the only *Default* outside `config`**, so no later batch
inherits a choice here" — a standing claim about the corpus, written in batch 4 without scanning the
namespaces batch 6 owned. `welcome:themeChooser.taglines.techno` ends "The new default." and is a
third home. It ships **「既定」** — 「ネオンが光るコンソール。新しい既定のテーマです。」 — because it is
config's sense, *the default value to inherit* (techno is the theme a user gets without choosing),
not a badge-variant name. So the split survives with one more member on the config side, and the
sentence that said the question could not recur is gone. **A claim of the form "X is the only Y" is a
scan of the whole corpus, and it goes stale the moment a namespace nobody had read lands.**

## Narration — the `logs` and `console` register, settled in batch 5

`logs` (59 keys) and `console` (27) are the only namespaces whose text **narrates an event that
already happened** rather than labelling a control the user is about to press. The control-shape
table above still governs `console`'s chrome — its filter tabs, its buttons, its placeholder — but
`logs` is 59 sentences, and a wrong aspect rule there is wrong sixty times over. Three rules, and
the first is the one that makes the other two mechanical.

1. **English's own final punctuation decides the PUNCTUATION. The control-shape table still
   decides the SHAPE.** These are two axes, and the round-5 review caught this rule conflating
   them — its first wording said punctuation "decides the shape" and then illustrated the third
   case with three values that are not the shape it claimed. Corrected here rather than rewritten
   away, because the *punctuation* half is the useful part and it is verified over all 123 values
   with zero mismatches.
   - A value ending in an **ellipsis** carries 「…」 and is in-flight progress, so the table's
     progress row gives ～中…: `logs:translation.start` is 「エントリを{{language}}に翻訳中…」 — the
     one such value in the namespace.
   - A value ending in a **full stop** carries 。, and a narrated completed event takes the table's
     ですます sentence: 「エントリを{{language}}に翻訳しました。」,
     「保管庫のロックを解除しました。」, 「バックアップを復元しました。」 This is the same 〜しました the
     progress row already prescribes for a completed action; `logs` applies it 55 times.
   - A value ending in **neither** takes no final punctuation — and **that is all this rule says
     about it.** Its shape comes from the table like any other control: `console:statusConnected`
     「サーバーのログストリームに接続済み」 and `console:vaultLocked` 「保管庫はロック中」 are status
     chips, so 体言止め, while `console:repeatCount` 「{{count}}回繰り返されました」,
     `console:membersNotShown` 「他{{count}}件は表示していません」, `system:slot.aria`
     「{{label}}環境を使用しています」 and `batch:runCancelled` 「実行をキャンセルしました」 are a tooltip,
     an inline note, an `aria-label` and a toast — things a screen reader or a hover has to read as
     sentences, so they take a ですます verb clause and still no 。. **Four** of the batch's own
     NONE-class values are therefore **not** 体言止め — five keys, since `membersNotShown` carries
     the same string in its bare and `_other` members — and all of them are correct. (An earlier
     count here said three and omitted `runCancelled`, whose English ends in the colon its call site
     strips — see the punctuation section — so it reads as NONE-class on both sides. Derived by
     script over the 123 values, not by eye.)
     **Do not read "no full stop" as "noun phrase".**

   The one thing this rule does **not** license is a completed event written as a bare noun
   phrase. English's *Vault unlocked.* / *Backup restored.* / *Translation memory cleared.* are
   past participles, not nouns, and the Japanese for them is the verb.

2. **An English em-dash inside a log line is two different things, and they take two different
   renderings.** `logs`, `system`, `errors` and `batch` use " — " twenty times between them.
   - **Introducing a clause** → a full stop and a second sentence. `logs:translation.failedNoRoute`
     is 「エントリ{{count}}件を{{language}}に翻訳できませんでした。一致する振り分けルールがありません。」;
     `errors:http.rateLimited` is 「リクエストが多すぎます。少し待ってから、もう一度やり直してください。」
   - **Appending a datum** → *（ラベル：値）* before the full stop, or a bracketed 中黒 list where
     there are two. `logs:translation.runQueued` is 「翻訳の実行をキューに追加しました（順番：{{position}}）。」,
     `batch:runCompletedWithErrors` is 「翻訳が完了しました（成功：{{completed}}・失敗：{{failed}}）。」
   Never a spaced ASCII dash: the space rule in the punctuation section forbids it, and the em-dash
   exception there is for symbol layout (an arrow, a placeholder pair), not for a connective.

3. **The narration counts エントリ where English says *string*, and that is the lexicon's
   instruction, not a harmonisation.** `terminology.md`'s *entry* row names this namespace by
   name; `english-review-notes.md` item 3 records the same English inconsistency and leaves the
   **English** deliberately unchanged. Do not "restore" the English word, and do not raise it
   again — it is a decided, recorded English defect with a recorded reason.

   **The rule has exactly one exception and `terminology.md` now names it: `logs:translation.queued`.**
   Its `{{total}}` counts **jobs** — one entry for one target language — so エントリ there makes the
   number wrong by the language count on every multi-language run. It ships
   「翻訳キューに追加しました（翻訳数：{{total}}）。」; see the **job** row of the counter table. The three
   `failed*` families keep エントリ and are **correct**, because their aggregate is keyed on language
   as well as reason, so the language is fixed inside a group.

   **This exception was shipped wrong twice in one round, and the second time is the useful one.**
   The round-5 batch wrote a bare bracketed number; the round-5 review recommended 「エントリ数」; the
   fix round applied it — and the row in `english-review-notes.md` saying *do not render it with a
   word that promises entries* had been at HEAD for seven minutes by then. **A reviewer's
   recommendation is a claim like any other, and a fix round re-reads the frozen authorities at HEAD
   before applying one.** In a wave running three languages at once, another locale's escalation lands
   binding rows mid-round; the sibling locale that committed 51 seconds later had already applied it.
4. **A run-engine's name is a thing; 〜に失敗する and 〜が完了する want an action. Restore 実行.**
   English narrates a run as *"Stage details failed."*, naming the feature. Japanese cannot:
   〜に失敗する takes an action noun (実行に失敗, 生成に失敗, 接続に失敗), so *ステージ詳細に失敗しました*
   reads as *failed at stage details*. The fix round shipped
   `logs:stageDetails.failed` 「ステージ詳細の実行に失敗しました。」 and
   `logs:stageDetails.done` 「ステージ詳細の実行が完了しました（完了：{{completed}}・失敗：{{failed}}）。」
   The surface name survives intact as a prefix, so the verbatim-copy rule is untouched, and 実行 is
   the lexicon's own word for *run*.
   **The rule is per verb, not per key**, which is why `logs:stageDetails.queued`
   「ステージ詳細をキューに追加しました。」 needs nothing: queueing takes a **thing**, so no head noun is
   owed. The three `categoryGen`/`glossaryGen` siblings already satisfy it because English gives
   them one (*generation* → 生成).
   **This is the same rule as judgement call 7** — 用語集の実行 reads as *executing the glossary*, so
   `logs:glossaryGen.done` restored 用語集生成の実行 — and round 5 applied it there and missed it one
   namespace away, which the review caught. When English names a feature where Japanese needs an
   action, the head noun is not optional decoration.

**One call-site finding that changed a string, and it is the reason this section exists.**
`batch:runCancelled`'s English is *"Run cancelled:"* — with a trailing colon — and its **only**
call site strips it: `ComparisonTab.tsx:876` renders
`toast.info(tBatch('runCancelled').replace(':', '').trim())`. That replace matches the
**half-width** `:` only. A Japanese value ending in the full-width 「：」 this file mandates would
sail past it and the toast would ship a dangling colon. The value is therefore
「実行をキャンセルしました」 with **no** colon at all — which is what the only consumer displays in
every locale, `fr`'s "Exécution annulée :" included. **This is not writing around a guard**: no
guard is involved, the punctuation is ours to set by the runbook's own rule, and the colon is
vestigial layout that the code removes. The finding worth passing on is the general one — a
value whose English carries trailing punctuation is a value whose call site is doing something
with that punctuation, so open it.

## Casing

Japanese has no letter case, so the English sentence-case / Title Case / uppercase
distinctions have nothing to map onto. `english-review-notes.md` records that the uppercase
table header in `strings` ("STATUS") shouts for a layout reason, and that a language without
case should simply translate it in the ordinary way. **Batch 2 settled it: `strings:columns.config`
is 「状態」** — the ordinary word, with nothing standing in for the shouting. 状態 is the one
rendering of *Status* everywhere it occurs, control shape notwithstanding: the shouted table
header, the ordinary column header `strings:runs.statusColumn` 「状態」, and the filter label
`strings:filters.status` 「状態：」. ステータス was rejected as the katakana loan where a two-character
kanji word is equally idiomatic and this is a column header — the tightest of the five classes.

**Batch 5 met a second shouted English label and treated it the same way.** `console:title` is the
literal uppercase *CONSOLE*, and unlike `strings:columns.config` it is **not** covered by
`english-review-notes.md` — the note there is written about the string-table header only. Checked at
the call site rather than assumed: `ConsolePanel.tsx:257` and `:286` render it as an `aria-label` and
a `font-semibold` span with **no** `uppercase` class, so the shouting is in the source string itself,
exactly as in the documented case. Japanese carries no case, so it ships 「コンソール」 with nothing
standing in for the capitals. (`console:exportFormatJson` keeps 「JSON」 byte-identical to English for a
different reason — it is a format name, not a shout.)

Latin-script material inside a Japanese string (`API`, `CSV`, `AI`, provider and model ids)
keeps its English casing and stays **half-width**. Never use full-width Latin letters or
full-width digits.

## Punctuation and spacing

- Use full-width Japanese punctuation: 、 。 （ ） 「 」 ： ？ ！ — never their half-width
  ASCII equivalents inside Japanese text.
- **English's own final punctuation decides whether the value ends in 。 — everywhere, not only in
  `logs`. Batch 6 promoted this from a narration rule to a whole-language one, by measuring it
  rather than by asserting it.** Over the **1,597** keys shipped before this batch, comparing
  "English ends in `.` or `。`" against "Japanese ends in 。", there is exactly **one** mismatch:
  `strings:runs.estimateSuffix` ("est." → 「概算」), where the English full stop is an abbreviation
  mark and not a sentence end. Five batches had followed the rule without it being written down.
  It settles the cases the shape table leaves open: a `<DialogDescription>` whose English carries no
  period takes none (`common:webSearch.hint`
  「新しいタブで検索するには、Enterを押してください」 — and note the citation guard caught this row
  still quoting the value's earlier wording after a self-review reshaped it, the second time in two
  rounds that a two-value string edit's blast radius reached a different file), and a toast whose English carries one takes one
  (`backup:toastBackupCreated` 「バックアップを作成しました。」 against
  `orphans:toast.deleted` 「孤立エントリを削除しました」, whose English has no period).
  **The one shape it produces that looks wrong and is not:** an em-dash split into two sentences
  inside a value whose English has no final period ends with an internal 。 and no closing one —
  `orphans:toast.aiRetranslateStarted`
  「AIによる再翻訳を開始しました。アクティビティタブで確認できます」. The internal stop is the
  em-dash's (narration rule 2); the missing final one is English's.
- Quoting a value uses 「…」, whatever mark English used. `config:instances.slugReserved`
  turns English's curly quotes into 「{{slug}}」; `config:duplicateSuccess` turns English's
  escaped straight quotes into 「{{name}}」. The placeholder is untouched; the two characters
  around it are ours. (English also quotes values with `_one`/`_other` families elsewhere —
  read those families as a whole, and remember Japanese ships only the `_other` member.)
- **No space between Japanese characters, and no space inserted around Latin runs
  either.** `config:enableModuleAddInstance` is 「{{name}}のインスタンスをもう1つ追加…」 — the
  particle sits straight against the token, with no space on either side. This matches the
  house style of the major Japanese platform localizations and keeps line lengths
  predictable.
- **A label and its value are joined by 「：」, never by a space** — that is the shape that
  makes the rule above hold everywhere. `config:health.medianLatency` is 「p50遅延：{{latency}}」,
  `config:models.gpuPlacement` is 「GPU：{{pct}}%」, `config:lqa.lengthLimitValue` is
  「文字数：{{chars}}／バイト数：{{bytes}}」.
- **The two slashes are different characters and English spells both "/".** Full-width 「／」
  **separates two independent labelled facts**: `config:lqa.lengthLimitValue` above (characters
  and bytes are different quantities), and `strings:runs.usageTokens`
  「トークン：入力{{input}}／出力{{output}}」. Half-width `/` is the **ratio operator between two
  values of one quantity**, and batch 1 already shipped it that way at
  `config:reviewProgressCount` 「レビュー済み：{{reviewed}}/{{total}}」 — this file simply never said
  so. Batch 2 has six of them: `strings:pagination.rowsFiltered`, `strings:pagination.pageOfTotal`,
  `strings:compare.translateExamplesCount`, `strings:runs.judgeScoreLabel`,
  `strings:runs.judgeSummary`, `strings:runs.stringsProgress`. Never a spaced ASCII slash in
  either role.
- **Space exceptions come in three classes, and the count is per batch, not per locale.**
  An earlier version of this bullet said "four in batch 1, and no others"; batch 2 added ten
  more, all inside the classes below, so the claim is restated as classes with a checkable
  per-batch count rather than a frozen number that goes stale in the next namespace.
  `grep -o ' '` over a namespace's shipped values must land entirely inside these:
  **(a) symbol layout copied from English**, **(b) a Latin name that contains a space**, and
  **(c) an example of literal user input**. Batch 1: four keys (1, 2, 3, 4 below).
  Batch 2: ten keys — `strings:runs.estimatedCost` 「≈ ${{amount}}」 plus the three
  `strings:runs.projectTotal*` that embed it (class a), and the **five** `strings:guide.topic*`
  product names that contain a space plus 「Gemini 2.5」 inside `strings:runs.detailsCharNote`
  (class b). 1 + 3 + 5 + 1 = 10. "DeepSeek" and "OpenRouter" are allowlisted product names but
  have no space, so they are not exceptions to this rule.
  **Batch 5: one, and it is class (a).** `system:countdown.message` opens 「⚠️ 更新を適用するため」 —
  the warning sign, then a space, then the sentence, copied straight from English's own
  `"⚠️ The service will restart shortly…"`. It is the `config:pseudoTestHelpLink` arrow case with the
  symbol at the other end of the string: symbol layout, not word spacing. Nothing else in the 123
  values contains a space — the batch's two half-width runs are `JSON` (`console:exportFormatJson`,
  a format name on the never-translate list) and the ratio `/` in `batch:progressAriaLabel` and
  `batch:runCompleted`, and neither is spaced.
  **Batch 4: zero.** All 299 values contain **no space at all** — the first batch with an empty
  exception list, which is what the classes predict rather than a surprise: nothing in
  `collab`/`account`/`vault`/`settings`/`sidebar` copies symbol layout from English, no Latin product
  name with a space occurs, and the batch's two literal-input examples have none
  (`vault:keyPlaceholder` "KEY_NAME" is underscored, `collab:nickname.placeholder`
  「例：jamie-writes」 is hyphenated). Note the two deliberate non-exceptions: `vault:namePlaceholder`
  turns English's "e.g. Personal, Work" into 「例：個人・仕事」 — 中黒, **not** the half-width comma of
  `config:lqa.forbiddenPlaceholder`, because the vault-name field is not comma-separated and a comma
  there would teach a separator the control does not have — and `account:reportBugsPrefix` ends at
  「報告先：」 with no trailing space, because `AccountView.tsx:119` emits its own `{' '}` before the
  mailto link.
  1. `config:pseudoTestHelpLink` 「クリックしてガイドを読む →」 — the space before the arrow is
     symbol layout copied from English, not word spacing.
  2. `config:routing.selectPlaceholder` 「— 選択 —」 — same, around an em-dash pair.
  3. `config:lqa.forbiddenPlaceholder` 「用語1, 用語2」 — a **half-width comma and space**,
     because the string is an example of what the user types into a comma-separated field;
     、 there would teach the wrong separator.
  4. `config:lqa.checks.double-words.description` — the quoted English example
     「the the」 keeps its own space, because a doubled word with the space removed is no
     longer an example of the thing the check finds.
- **A half-width symbol English uses as an affordance stays half-width and stays unspaced**,
  even against katakana: `config:routing.langsMore_other` 「+{{count}}言語」 set the precedent and
  `strings:compare.addContext` 「+コンテキスト」 / `strings:compare.addTone` 「+トーン」 follow it.
  English writes "+ Context" with a space; the space goes, the `+` stays. Same for the `$` in
  `strings:runs.estimatedCost` and the `+` in `Shift+Enter`.
- Ellipsis is the single character `…` (U+2026) wherever the English source has it, as a UI
  affordance: `config:importing` ("Importing…") is 「インポート中…」. **The rule bites in both
  directions and batch 3 is where it shows**: `review:sourceAi.modulePlaceholder` ("Select a
  module") is 「モジュールを選択」 with no ellipsis, while `glossary:generateModulePlaceholder`
  ("Select a module…") is 「モジュールを選択…」 with one. Same control class, different English,
  two different Japanese values — and that is correct, not drift.
- **A sentence that begins with an unquoted button label takes 「…」 around that label.**
  English writes `review:sourceAi.emptyHint` and `review:translationAi.emptyHintRun` starting
  with the bare labels *Run review* and *Review last run* (`english-review-notes.md` flags both
  and tells you to render the label identically to its own key). In Japanese an unbracketed
  label at the head of a sentence is unparseable — 「レビューを実行」では… reads as a verb phrase
  unless the brackets are there — so the two shipped values quote it:
  「「レビューを実行」では、すべての原文エントリを…」 and 「「前回の実行をレビュー」では、…」.
  Punctuation is ours to set; the label inside is copied verbatim from `sourceAi.runReview` /
  `translationAi.runReview`. `review:emptyFlaggedHint` and `review:sourceAi.scopeNoneHint`
  follow the same shape, and the latter's English already carries quotes.
- 中黒 「・」 has **two** jobs here, and batch 1 only wrote down the first.
  1. Joining a loanword compound where it would otherwise be ambiguous; otherwise run them
     together. Batch 1 needed it nowhere and neither did batch 2.
  2. **Separating the items of an inline list** — which batch 1 shipped repeatedly without this
     bullet saying so (`config:requestTimeoutDescription` 「（翻訳・評価・原文レビュー・用語集・カテゴリ）」).
     Batch 2 follows it: `strings:row.ignoredTooltip`,
     `strings:runs.aiReviewVerbose` 「詳細ログ（プロンプト・パラメーター・生の応答）」,
     `strings:compare.translateCustomBatchSizeCaveat` 「（モジュール・言語）の組み合わせごとに送信されます。」.
     Never a half-width comma between Japanese items — that shape is reserved for
     `config:lqa.forbiddenPlaceholder`, which is an example of user input.
  Where English's own separator is `·`, 中黒 is also the faithful mapping of it:
  `strings:runs.judgeAllFindingsCount` 「指摘：{{total}}・未処理の提案：{{withSuggestions}}」.
  **That mapping is not optional, and batch 3 broke it once.** `review:provenance`
  ("{{module}} · {{date}}") shipped with English's spaced ASCII `·` intact — defensible in
  isolation, since the value is nothing but two tokens and a separator and `IDENTICAL_ALLOWLIST`
  carries it — while its sibling `review:previousVersionMeta` ("Previous version · {{module}} ·
  {{date}}") took 中黒. `ReviewTab.tsx:840` and `:941` paint both into the same review card, in
  the same `font-mono text-[11px]`, whenever a previous version exists, so the user saw
  `openai · …` above a 中黒-separated sibling in the same card. Fixed to 「{{module}}・{{date}}」. **The allowlist permits an
  identical value; it never requires one** — the entry stays live because es/fr/ru/de/tr all
  still ship it byte-identical, and `identicalValueOffenders()` marks it used per locale.
- Long-vowel marks follow the modern convention **for -er / -or / -ar loans**:
  「サーバー」 and 「プロバイダー」, both shipped, and likewise *yūzā* / *forudā* — trailing ー, not the older
  truncated forms — so `config:models.colProcessor` is 「プロセッサー」 and
  `config:models.colParameters` is 「パラメーター」 even though both are table column headers
  where a shorter form is tempting. **Loans ending in -y / -ry take no mark**: 「エントリ」
  「カテゴリ」「メモリ」「ポリシー」 (a -cy loan, which lands on シー rather than a bare リ).
  The rejected long forms — *entorī*, *toransurēshon memori* — are named in romaji
  deliberately: a rejected candidate never goes in 「…」. **That last clause used to end "so every
  「…」 span in this file stays verifiable against the shipped file", and the whole-language sweep
  found it false 28 times in this file and 11 in the lexicon** — rejected candidates, retracted
  values and ellipsis-truncated fragments, all wearing the notation that means *this is what we
  ship*. All 39 are repaired and the claim is now true, but it is restated as a **procedure rather
  than a promise**, because the promise is what went unchecked for six rounds:

  ```bash
  # every 「…」 span in both artifacts must occur in some locales/ja value
  python3 - <<'EOF'
  import io,re,json,glob
  def flat(o,p=''):
      out={}
      for k,v in o.items(): out.update(flat(v,p+k+'.')) if isinstance(v,dict) else out.update({p+k:str(v)})
      return out
  blob='\n'.join(v for f in glob.glob('packages/frontend/src/locales/ja/*.json')
                    for v in flat(json.load(io.open(f,encoding='utf-8'))).values())
  for p in ['docs/i18n/terminology/ja.md','docs/i18n/style/ja.md']:
      for n,l in enumerate(io.open(p,encoding='utf-8'),1):
          for m in re.finditer(r'\u300c([^\u300c\u300d\n]*)\u300d',l):
              if m.group(1) not in blob: print(p,n,m.group(1))
  EOF
  ```

  **Run it whenever you add a 「…」 span. The citation guard will not do it for you** — proven by
  the sweep rather than argued: `extractStyleCitations()` returns its citations only for
  **key-adjacent** spans, and not one of the 39 was key-adjacent, so none was ever extracted; and
  for three of them `renderingIsCovered()` returns **true** anyway, because containment attestation
  finds the pieces scattered elsewhere in the corpus. **Attestation is not attachment.**
  Settled in batch 1 because *entry* and *category* are the two most repeated nouns in the
  app, and alternating between 「エントリ」 and its long form across six batches would be
  visible on almost every screen.

## Keyboard key names

`terminology.md` settles this per locale and leaves ja to this file: **write the key name as it
is engraved on a Japanese keycap.** A JIS keyboard prints `Enter`, `Shift` and `Esc` in Latin,
so those three stay Latin — the same reasoning Russian records, and not an untranslated
leftover. Half-width, joined to the following particle with no space:
`strings:compare.contextPlaceholder` carries 「Enterで保存、Shift+Enterで改行、Escでキャンセル」 and
`strings:compare.cellEditTooltip` is 「編集・Enter・Escでキャンセル」. The `+` in `Shift+Enter` is
half-width with no spaces, matching English.

The same words translate normally where they are **verbs or ordinary nouns** — read the string,
not the word. `strings:shortcuts.enterEditMode` ("Enter edit mode") is 「編集モードに入る」, and
the *Tab* of a UI tab is 「タブ」 throughout `strings:guide.*`.

## Numbers and dates

Half-width Arabic numerals. Comma thousands, period decimal: `1,234.56`. No space before
`%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string, and no era conversion should be attempted by hand.

## Length discipline

Japanese usually runs **shorter** than English — roughly 0.5–0.7× the character count —
so the chrome surfaces are rarely the constraint they are elsewhere. The real risk runs the
other way: a katakana transliteration that is _longer_ than the English it replaces. Spelled
out in katakana, *translation memory* runs to twelve characters where 「翻訳メモリ」 is five
and reads better.

**Prefer the kanji compound over the katakana loan** whenever both are idiomatic, and prefer
it hardest in the five space-constrained classes tabulated below.

**Do not use the English character count as a ceiling.** That rule was in this file and is
now deleted, on the runbook's own evidence: an audit of every constrained-surface key across
all 24 namespaces found 27 renderings over 1.5x their English, and nothing was wrong with any
of them — a ratio measures the wrong thing, because a short English source denies slack a
loose control could afford. It also contradicted the absolute budgets two paragraphs down in
this same file. **The budgets below are the only length rule here.**

Japanese wraps at almost any character, so long body text is not a layout hazard.

`terminology.md` defines every domain term; `terminology/ja.md` holds this locale's
rendering. Decide the rendering on first use, write its row there, and then follow it here.

### The five per-class budgets — absolute character counts, never a multiple of English

Counted in **rendered Japanese characters**, with the convention stated because two of these
figures move with it: a full-width character is **1**, a half-width Latin character or digit is
**0.5** (a full-width glyph carries about twice the advance), and a `{{token}}` counts as the
three digits it can show, i.e. **1.5**. That is what the container has to fit.

| Class | Anchor key | Kind | Budget | Basis |
| --- | --- | --- | --- | --- |
| Sidebar item — **including every `strings:tabs.*` label** | `sidebar:globalConfig`, `sidebar:legal`, `strings:tabs.backup` | **hard** — fixed `16rem`, `truncate` | **13** | **derived from the component**, batch 2: `SIDEBAR_WIDTH` 16rem = 256px, less 1px `border-r`, less `SidebarGroup`'s `p-2` (16px), less `SidebarMenuButton`'s `p-2` (16px), less the `size-4` icon (16px), less `gap-2` (8px) = **199px**. At `text-sm` (14px) a full-width CJK glyph advances 1em = 14px, so 199 ÷ 14 = 14.2 glyphs fit and 13 leaves one glyph of headroom. Half-width Latin inside a label counts ~0.5 |
| In-panel sub-tab label | `config:routing.tabRules` | soft | 12 → **13** | **BUDGET REPLACED at the whole-language sweep, and it is the one row that had to move.** The 12 was measured in batch 1 over the *three* routing sub-tabs and never re-derived when batch 5 added the console's filter tabs. Measured over the whole class — **9** members across two namespaces (`config:routing.tab{Rules,Templates,ImportExport}` plus **six** `console:filter_*`, `FILTER_LEVELS` at `ConsolePanel.tsx:54` being `all/error/warn/info/debug/notifications`) — the maximum is **12** at `config:routing.tabImportExport` 「インポート／エクスポート」, next 9.5 at `tabTemplates`. That is the budget **exactly, i.e. zero headroom**, which no other soft row here has (8 vs 7, 14 vs 13, 9 vs 5, 17 vs 14.5), so a correct 13-glyph label would read as over budget. Runbook 2.4 derives a soft budget from the longest value the language ships **plus headroom**; **13** restores one glyph, the same method the hard sidebar row states |
| Table column header | `strings:columns.config` | soft | **8** | **basis replaced at the sweep — the number holds, its population was one batch's.** Measured over the whole class: **48** headers across eight namespaces (`config:models.col*`, `glossary:col*`, `strings:columns.*`, `strings:runs.*Column`, `orphans:columns.*`, `collab:{sharing,invites}.column*`, `quality:columns.*`), **max 7**, median 2. Two keys tie at the maximum — `collab:sharing.columnLanguages` 「編集可能な言語」 and `strings:runs.detailsLanguagesColumn` 「ターゲット言語」 — and both are fixed by a term rule, which outranks the budget. The class anchor `strings:columns.config` itself is 「状態」 at 2 |
| Filter label | `strings:filters.needsReview` | soft | **14** | **basis replaced at the sweep — number unchanged.** Whole class: **29** members (`strings:filters.*` plus the Compare filter row), **max 13** at `strings:filters.newOnly` 「新規（前回のインポート分）」, next 12, median 6. The anchor 「要レビュー」 is 4. The provisional 8 this row started from was badly wrong — reasoned from the anchor rather than from the class, which is what rubric item 7 exists to catch |
| **Swatch chip label** | `colorText:swatches.hydro` | **hard** — `max-w-24` + `truncate` | **8** | **derived from the component**, batch 6: `PaletteSection.tsx:39` renders the label in a *span* carrying *max-w-24* and *truncate*, inside a `text-xs` chip. 96px ÷ 12px = 8 full-width glyphs. Measured across the whole class at once (18 swatches): 1-5, the longest being 「タイトル」「セカンダリ」「パープル」「オレンジ」 and 「グリーン」 at 4-5. (**「グリーン」 was omitted from that list until the sweep** — the same transcription-of-a-measurement slip as the アクティビティ omission corrected one section earlier, and with the same shape: the measurement was never in doubt, the list beside it was.) The class is **hard** and nothing in it is close |
| **Palette group caption** | `colorText:groupElements` | soft | **9** | **derived from the component**, batch 6: `PaletteSection.tsx:78` and `:93` put each caption in a *w-28 shrink-0* `text-xs` span — 112px ÷ 12px = 9.33, taken down to 9 glyphs. Soft because an over-long caption **wraps to a second line inside the fixed box**, making the palette row taller — it costs elegance, not correctness. **(The first version of this cell said the caption "pushes the swatch row rather than clipping". That is wrong about the CSS and is corrected rather than dropped: *w-28* is a fixed `width`, not a max-width, and `flex-grow` defaults to 0, so the item's used width stays 112px and it cannot push anything; with `white-space: normal` and Japanese breaking between characters it wraps instead. The verdict — soft — was right and the mechanism behind it was not, which is the class this very file corrects three times elsewhere in the same round.)** All five measure 2-5 (「暗い背景」「明るい背景」「元素」「品質別の色」「自分の色」) |
| Bulk-bar control | `strings:bulk.approveSelected` | soft | **17** | **basis replaced at the sweep — number unchanged.** Measured over the keys `StringTableBulkBar.tsx` actually renders: **25** (21 `strings:bulk.*` + 4 `batch:*`), of which **18 are controls**; **max 14.5** at `strings:bulk.selectAllFiltered` 「絞り込まれた{{count}}行すべてを選択」 with a three-digit count, next 13, median 7. The anchor 「承認して翻訳メモリに追加」 is 12. **The seven non-controls in that bar are longer and are not a breach** — `strings:bulk.allFilteredSelected` 19.5 and `removeCategoryEmpty` 17 are status and empty-state *sentences*, and this class is scoped to controls. Stated so the next sweep does not read them as one |

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, and never distort a term to
hit the number. A term rule outranks the budget: `config:models.colProcessor` is
「プロセッサー」 and not the shorter 「プロセッサ」 because the long-vowel rule above says so.

**No provisional row is left.** Three rows are measured from shipped Japanese, three are derived
from the component's own CSS, and one (the in-panel sub-tab) was measured in batch 1.

**The table grew in batch 6 and that is a finding about the earlier batches, not only about this
one.** Two classes existed all along in `colorText` and no batch had a reason to look at them,
because the five classes were inherited from the runbook's list rather than re-derived per
namespace. **Rubric item 7 asks for the distribution of a whole class; nothing asks whether a
namespace introduces a class the table does not have** — so the check that finds one is reading
the component, and it has to be done once per namespace with chrome. Batch 5 learned the same
lesson from the other end (it claimed no constrained class was present and two were). Both new
rows are comfortable, and both are comfortable **because they were measured**.

**Batch 4 confirms the hard row against the namespace that owns it, and it is not close.** The **31**
labels the rail can paint at once (listed in the Sweep 4 table below) run from 2 to 7 rendered
characters. **Four** sit at the maximum of 7 full-width equivalents — 「グローバル設定」,
「原文AIレビュー」, 「翻訳AIレビュー」 and 「アクティビティ」, the AI ones counting the half-width `AI`
as ~1 — against a budget of 13 and a container of ~199px, so the widest label in the app's tightest
control uses **about half** the space it has. (An earlier version of this paragraph named only three
and omitted アクティビティ, contradicting the batch-2 paragraph in this same file, which lists it among
the 7s. The measurement was never in doubt; the transcription of it was.)
`sidebar` itself never came near it: its longest rail value is 「グローバル設定」 at 7, and its longest
value of any kind, 「ワークスペースのナビゲーション」 at 15, is an `aria-label` on `<SidebarContent>`
with no width at all. **Nothing in this batch was shortened to fit anything**, and the brief's
escalation path for an unfittable label was not needed.

### One guard escalation: `vault:keyPlaceholder` — granted, and its reason corrected

`vault:keyPlaceholder` ships English's **"KEY_NAME"** byte-identical, deliberately, and now carries an
`IDENTICAL_ALLOWLIST` entry. The conclusion was right from the start; **the reason this file gave for
it was false, and is restated here rather than quietly swapped.**

**What it is not:** a free-text field. The first version of this section — and the granted entry, and
the batch report — called it "the placeholder of the input the user types a vault key name into",
citing `VaultEditorDialog.tsx:281` and `:301`. Nothing is typed at either. `:281` is a
`ComboboxInput` on the `row.existing` branch that is **`disabled` with `value={row.key}`**, and
`row.key` is never empty for an existing row (`:99` builds the rows from the fetched key list), so the
placeholder cannot render there at all; `:301` is `<SelectValue placeholder={t('keyPlaceholder')} />`
on a `<Select>` whose options come from the modules' `requiredEnvVars`.

**What it is:** the empty-state placeholder of the vault-key **picker**, and its value **samples the
format of the options** — literal ASCII identifiers such as `OPENAI_API_KEY` and
`GENERIC_API_KEY__MY-OLLAMA`, which `terminology.md` puts on the never-translate list outright. A
rendered *キー名* would name the *field* where the string is sampling the *values*, and
*例：KEY_NAME* would pad the value purely to clear a check — the "absorb the workaround into the
string" failure the runbook names. Byte-identical is right for the same reason
`config:lqa.forbiddenPlaceholder` keeps its half-width comma: the value demonstrates a literal form.

**The scope argument was and remains sound**, and is the part worth keeping: the reason is
language-independent, so the entry is `*:vault:keyPlaceholder`. `ja` is merely the first locale able
to *see* the value — at 8 characters and one whitespace-delimited word it clears
`MIN_UNSPACED_CHARS` (8) and fails `MIN_WORDS` (3), the exact gap `isSubstantial()`'s own comment
documents.

**How the false reason got written, because it is the more useful lesson:** two translators
independently described the control the same way and neither had opened the file — agreement between
two guesses is not evidence. The runbook's rule 3 says a claim about a key is checked by whoever is
about to act on it; a claim about a *control* is no different.

**There was never a "main tab bar", and that mistake is the most valuable thing this batch
found.** Batch 1's table carried a separate soft *Main tab label* row, and the runbook's own
five-class table still calls the tab label **soft** — both are wrong. `strings:tabs.*` has
exactly **one** call site, `components/layout/Sidebar.tsx:785` (tooltip) and `:788`
(`<span className="truncate">`), inside a `SidebarMenuButton`. **The tabs *are* sidebar items**:
same fixed 16rem container, same `truncate`, same icon and gap. So the two rows were one class
described twice with two different numbers and two different *kinds*, and the softer, larger of
the two was the wrong one. They are now a single **hard** row. Caught mid-batch by the German
translator reading the call site, which is the runbook's rule 3 working exactly as written —
a claim about what a key does is checked by whoever is about to act on it.

**Nothing in batch 2 was shortened to hit a budget, and the correction changed no string.**
Re-measured against the real container, the longest `strings:tabs.*` label is 7 full-width
equivalents (「原文AIレビュー」, 「翻訳AIレビュー」, 「アクティビティ」 — 98px of 199px), so the
whole class sits at **49% of the space it has**. Japanese runs about half the width of a Latin
script here, which is why a container that constrains a 26-character German label barely
touches a Japanese one.

**Of the four figures batch 2 inherited as provisional, three were wrong.** The filter label was
reasoned at 8 and measures 13; the bulk-bar control was reasoned at 12 and measures 16 — both
derived from the *anchor key* rather than from the whole class, which is what reviewer-rubric
item 7 exists to catch. The tab label was wrong in the worse way: right number, wrong container,
wrong kind. Only the table column header was close, moving 6→7. The in-panel sub-tab row is
still the worked example of why a budget must name its container — `config:routing.tabRules` and
friends really do sit in a scrolling in-panel row, and they are the only tab-shaped control in
this app that does.

Batch 3 measures the same, over the four namespaces' **366 shared keys, as shipped after its fix
round**: 5,577 Japanese characters against **10,281** English, aggregate **0.54**, median
**0.53**, 90th percentile **0.80**, maximum **1.25**, minimum **0.18**. Seven keys sit at exactly
1.00 (`glossary:notesPlaceholder`, `glossary:sourceLink`, `glossary:exportCsv`,
`glossary:exportTbx`, `review:sourceAi.findingUnsafe`, `review:undo`,
`category:entryCheckboxLabel`) and exactly one exceeds it: `review:flag` 「保留にする」 at **1.25**
against the four-character "Flag" — the ratio measuring the wrong thing again, on a source too
short for it to mean anything. Three batches in, the distribution has not moved.

**State the population with the number, and re-derive it after the strings move.** These figures
have now been written three times and were wrong twice, both times mechanically:

1. Batch 3 wrote the English total as **10,744** — the **377**-key figure from the runbook's
   batch table — beside a ja total measured over the **366** keys this locale actually ships. The
   two do not produce the ratio printed next to them (5,578/10,744 = 0.52, not 0.543). It also
   undercounted the 1.00 keys as five, and the ratio-role `/` as six.
2. The fix round corrected all three — and then **invalidated its own correction in the same
   commit**, because `review:flag` 保留 → 保留にする and `review:provenance` 「{{module}} ·
   {{date}}」 → 「{{module}}・{{date}}」 moved the maximum off 1.00 and the character total by one.
   The "ceiling of 1.00, reached by eight, exceeded by none" sentence was true when written and
   false by the end of the round.

The lesson is not "be careful": it is that a distribution written before the last string edit is
stale by construction. **Re-run the measurement as the last step of the round, not the first.**

Batch 4 measures over its **299 shared keys, with the English measured over the same 299** — the
denominator batch 3 got wrong. English's own five files hold 300 keys and 7,851 characters; the 29
characters of `account:notificationsUnreadCount_one` come out of the English total because Japanese
supplies no `_one`, leaving **4,448 Japanese characters against 7,822 English** — re-derived after
the fix round's five string edits, which moved the Japanese total by a net **+1** (four `policy*`
keys at +1 each, `retrySuccess_other` at −3) and left every rounded figure here unchanged: aggregate **0.57**,
median **0.57**, 90th percentile **0.81**, minimum **0.15** (`account:tabNotifications`
「通知」 against "Notifications"), maximum **1.20**. Ten keys reach or pass 1.00 — six sit exactly on
it (`collab:leaveConfirmTitle`, `vault:unlock`, `vault:keyPlaceholder`, `vault:undoRemove`,
`settings:previewSamples.checkbox`, `sidebar:projectIconLabel`) and four exceed it
(`sidebar:groups.project` 「セットアップ」 at 1.20, the two `collab:sharing.remove*` at 1.17,
`vault:lockoutCountdown` at 1.09). **Every one of the four has a 5-22 character English source**, so
this is the ratio measuring the wrong thing again, exactly as at `review:flag` in batch 3 — and
`sidebar:groups.project` is the case that proves it hardest: 6 rendered characters against a 13
budget is 46% of its container while its *ratio* is the batch's worst.

The batch runs slightly **longer** than batch 3's 0.54, and the reason is the corpus rather than a
drift in register: batch 4 is chrome — 300 keys over 7,851 English characters, 26 per key, against
batch 3's 29 — and short English sources are where Japanese's advantage is smallest. Four batches in,
the aggregate had moved 0.55 / 0.55 / 0.54 / 0.57 and the 90th percentile 0.83 / 0.83 / 0.80 / 0.81
**as this paragraph computed them at the time — see the restated six-batch table below, which puts
every batch on one population and one percentile convention and moves this row's last two figures
to 0.57 and 0.82.**
Nothing here approaches the guard's ratio cap in either direction.

**Batch 5 breaks that flat run, and the cause is the register rather than the corpus.** Over its
**123 shared keys** — the same 123 in both languages, because this batch contains no `_one` key at
all, so nothing comes out of either total — **2,810 Japanese characters against 4,567 English**:
aggregate **0.62**, median **0.62**, 90th percentile **0.81** (`logs:stageDetails.failed`), minimum
**0.15** (`console:filter_notifications` 「通知」 against "Notifications"), maximum **1.11**
(`logs:judge.done`). Five keys reach or pass 1.00: 「JSON」 and 「テキスト」 and 「すべて」 all at exactly
1.00, `logs:vault.unlocked` 「保管庫のロックを解除しました。」 at 1.00 against *Vault unlocked.*, and
`logs:judge.done` alone above it — pushed there by the 判定 label a fix round added, on a key whose
English is already terse.

**Three measurement points, all recorded, because this figure has been written three times and was
stale twice.** The Japanese character total moved with each round of edits, and each figure was
correct when written:

| Measured after | ja chars | aggregate |
| --- | --- | --- |
| the batch (5 namespaces of edits before it) | 2,798 | 0.6127 |
| fix round 1 (`action.openQuality`, `judge.done`, `stageDetails.done`/`failed`, `translation.queued`/`_other`) | 2,814 | 0.6162 |
| **fix round 2** (`translation.queued`/`_other`, エントリ数 → 翻訳数) | **2,810** | **0.6153** |

Fix round 1 moved the total by +16 and the aggregate by **+0.0035** — not +0.005, which is what you
get by subtracting the *rounded* figures instead of rounding the difference. **Every row above was
re-derived after that round's last string edit**, and the table exists instead of a sentence because
a single "re-derived after the last edit" claim is true only until the next edit, and this file
carried two such sentences at once, naming two different edit lists.
**The aggregate rose from 0.57 to 0.62 because `logs` is narration**, and that is a structural
effect worth stating rather than a drift: English narrates a completed event with a bare past
participle — *Vault unlocked.*, *Backup restored.*, *Translation memory cleared.* — where Japanese
must write out a verb in ですます, so the 〜しました。 tail costs four to six characters that English
never spends. Every locale that marks politeness on the verb will meet the same effect in this
namespace. It is not a reason to drop the register: the narration section above settles that the
sentences are sentences. Five batches, as computed here at the time: aggregate **0.55 / 0.55 / 0.54 / 0.57 / 0.62**,
90th percentile **0.83 / 0.83 / 0.80 / 0.81 / 0.81**. **Both series are superseded by the restated
table below** — same conclusion, one population, one percentile convention. The tail has not moved
at all; only the body has.

**One constrained class IS present, and the first version of this paragraph said none was.** It
claimed "nothing in these six namespaces sits in one of the five constrained classes" and "no
layout risk anywhere". Four `batch:*` keys render inside `StringTableBulkBar.tsx` —
`translateSelected` (`:375`, `:397`), `cancelRun` (`:384`), `toTranslateCount` (`:401`) and
`progressAriaLabel` (`:368`) — which is the **bulk-bar** class, whose own anchor
`strings:bulk.approveSelected` lives in that same component. **Rubric item 7 was owed and skipped**:
the class was present and its distribution was never measured. Measured now, over the whole class at
once: 「選択範囲を翻訳」 **7**, 「実行をキャンセル」 **8**, 「翻訳対象{{count}}件」 **7** with a
three-digit count, and `progressAriaLabel` is an `aria-label` with no rendered width at all —
against a **soft budget of 17**. **The conclusion survives and the reason did not**, which is the
tracked failure class: the batch is comfortable, but it is comfortable because it was measured, not
because the class was absent. **A second class is present too, and the first correction missed it:**
the five `console:filter_*` labels 「すべて」「エラー」「警告」「情報」「デバッグ」 are tab-shaped, rendered
in a scrolling row at `ConsolePanel.tsx:414` — the **in-panel sub-tab** class, budget **12**. They
measure **2-4** characters, so there is no risk, but "everything else is unconstrained" was still
false and is corrected rather than left standing. Everything **outside those two classes** really is
unconstrained: the console log rows wrap freely, and the longest values are two multi-sentence
banners (`system:countdown.message`, `generation:ignoreGlossariesHint`) that wrap by design. **Do not read
"batch 5 had no constrained keys" as a precedent about which namespaces carry chrome**; `batch` and
`console` both do.
**Batch 6 measures over its 282 shared keys — the same 282 in both languages, because this batch
contains no plural key of any kind** (no `_one`, no `_other`, no `_zero`; checked over
`locales/en`, which is also why the count closes exactly). **3,639 Japanese characters against
6,514 English**: aggregate **0.56**, median **0.56**, 90th percentile **0.82** (nearest-rank —
see the method note below), minimum **0.14**
(`colorText:swatches.electro` 「雷」 against "Electro"), maximum **1.33** (`colorText:modeRaw`
「タグ表示」 against the three-character "Raw"). Five keys reach or pass 1.00 — three sit exactly on
it (`stage-details:chat`, `stage-details:translate`, `orphans:confirmDelete.title`) and two exceed
it, both `colorText` mode labels against three- and four-character English sources. **Re-derived
after the last string edit of the round**, per the rule two paragraphs up that this file has broken
twice — and it earned its keep again here: the first derivation of these figures was written before
a self-review moved four values onto ～てください (English gives the user a bare imperative at
`welcome:setupVaultBody`, `orphans:relink.confirmDescription`, `backup:backupsListDescription` and
`common:webSearch.hint`, and a ～ます statement describes where English instructs). That edit moved
the Japanese total by +14 and the aggregate from 0.5565 to 0.5586. Both figures were correct when
written; only the second is correct now.

### The six-batch series, restated on one population with the method pinned

**The series this file published for five rounds spliced two populations together.** It read
aggregate *0.55 / 0.55 / 0.54 / 0.57 / 0.62 / 0.56*, and the round-6 review re-derived it: batches
1 and 2 were computed against **all** of English's keys, batches 3-6 against the **shared** keys.
Runbook 2.10 says to state which population you measured, and a trend line is exactly where mixing
them does damage. Corrected here rather than dropped, because the conclusion drawn from it survives
untouched.

**Population: the keys this locale shares with English, with English measured over the same keys**
— the population batch 6 declares for its own figures. **Percentile: nearest-rank**
(`ceil(p·N)`), stated because two of these figures move with the convention.

| Batch | keys | ja | en (shared) | aggregate | median | 90th pct |
| --- | --- | --- | --- | --- | --- | --- |
| 1 `config` | 368 | 7,121 | 12,745 | **0.56** | 0.57 | 0.83 |
| 2 `strings` | 441 | 5,492 | 9,639 | **0.57** | 0.56 | 0.83 |
| 3 | 366 | 5,577 | 10,281 | **0.54** | 0.53 | 0.80 |
| 4 | 299 | 4,448 | 7,822 | **0.57** | 0.57 | 0.82 |
| 5 | 123 | 2,810 | 4,567 | **0.62** | 0.62 | 0.81 |
| 6 | 282 | 3,639 | 6,514 | **0.56** | 0.56 | 0.82 |

**Aggregate 0.56 / 0.57 / 0.54 / 0.57 / 0.62 / 0.56; 90th percentile 0.83 / 0.83 / 0.80 / 0.82 /
0.81 / 0.82.** Batch 5's 0.62 stands out and its cause was named at the
time — `logs` is narration, where English's bare past participles meet Japanese's 〜しました。 tail.
Batch 6 drops straight back to the body's own level, which is the confirmation that batch 5's
figure was a register effect and not a drift: this batch is half chrome and half short sentences,
the ordinary mix. **The 90th percentile has not moved across six batches** — 0.80 to 0.83 throughout, on one
population and one convention. The tail is the number that breaks layouts, and in this language it
never has.

**Two figures moved with the correction and one of them is the percentile method, not the data.**
Batches 4 and 6 read 0.81 before and are 0.82 under nearest-rank; batch 5's published **0.81** is
not reproducible under either convention I can name — the floor-index method this file had been
using gives **0.8043** (→ 0.80) and nearest-rank gives **0.8095** (→ 0.81), because four values sit
within 0.018 of each other there (0.8000, 0.8043, 0.8095, 0.8182). The review reports nearest-rank
as giving 0.80, which is the opposite labelling from my re-derivation; the substance is the same
either way and is the reason the method is now printed beside the number. **A percentile without
its convention is not a reproducible figure**, which is the same defect as a ratio without its
population, one row down.

### The whole language, measured once at the end

**1,879 shared keys: 29,087 Japanese characters against 51,568 English — aggregate 0.5641,
median 0.56, 90th percentile 0.82, minimum 0.14, maximum 1.50.** State the population with the
number: the English denominator is measured over **the same 1,879 keys**, not over English's own
1,908 — the 29 `_one` keys Japanese does not supply come out of both totals, exactly as batch 4
established. Fifty-seven keys reach or pass 1.00. **Most of them have a short English source — not
all, and the first version of this sentence said "every one".** The median English source among the
57 is **6** characters, but **seven** are 15 characters or longer and **three** are 20 or longer:
`glossary:sourceLink` at 42 (a do-not-translate sheet name carried by `IDENTICAL_ALLOWLIST`),
`logs:judge.done` at 38 and ratio 1.11, and `vault:lockoutCountdown` at 22. "Every one" is not true
of a 38-character sentence. The substance — no length risk anywhere — is unaffected, which is
exactly why the overreach survived being written. The single 1.50 is `strings:filters.matchAny`
「または」 against "OR", which is the ratio measuring the wrong thing in its purest form. Japanese is the first locale in this programme to
run *shorter* than English by a wide margin — `ru` 1.19, `es` 1.22, `fr` 1.26 against this
language's 0.56 — so **the guard's 2.5x ratio cap was never a live risk in either direction, and
not one string in six batches was shortened or lengthened to satisfy a length figure.**

Japanese runs a little over half the length of English in batches 1 and 2 alike — and **both
figures in this sentence were restated in round 6**, because it was one of the two rows that had
been measured against all of English's keys rather than the shared ones, and because later fix
rounds moved `strings` after it was written. On the shared population `strings` is **5,492**
Japanese characters against **9,639** English: aggregate **0.57**, median **0.56**, 90th percentile
**0.83**, single maximum **1.50** at `strings:filters.matchAny` 「または」 — a two-character English
source, which is the ratio measuring the wrong thing exactly as the runbook says it does. Length pressure in
this language runs the opposite way from every locale shipped before it, and the guard's own
2.5x ratio cap is not a live risk in either direction. **That is not the same as "nothing came
near a budget"** — an earlier version of this file said so and was wrong, by the sub-tab row
above, and batch 2 found two more budgets that were simply too small.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Japanese is comfortable here: nouns do not inflect, and a particle can follow a token
safely because it does not agree with anything. `config:enableModuleAddInstance` ("Add
another {{name}} instance…") becomes 「{{name}}のインスタンスをもう1つ追加…」 — the particle
sits straight against the token with no space and no agreement to get wrong.

### Counters, by object — the table batches 2–6 read instead of guessing

**Counted nouns take a counter and no plural marking**, and **件 is not a universal
counter.** Batch 1 shipped 件 for CSV rows, for languages and for spreadsheet cells before
review caught all three; the object classes below are the ones this app actually counts, and
the counter is a property of the object, not of the string.

| Object counted | Counter | Shipped example |
| --- | --- | --- |
| entry (a content entry) | **件** | `config:orphanedCount` 「孤立{{count}}件」, `config:new` 「新規{{count}}件」 |
| CSV row | **行** | `config:rowsProcessed` 「{{count}}行を処理しました」, `config:skipped` 「スキップ{{count}}行」, `config:malformedRows_other` 「破棄した不正な{{count}}行」 |
| language | **言語** | `config:routing.langsMore_other` 「+{{count}}言語」 |
| spreadsheet cell | **個** | `config:exportRoundtripWarning_other` 「{{count}}個のセル」 |
| glossary | **件** | `config:glossariesSkipped_other` 「無効化した用語集{{count}}件」 |
| glossary term | **語** | shipped batch 3: `glossary:toastPushed` 「用語{{count}}語をDeepLに送信しました」, `glossary:generateSuggestionCount` 「用語{{count}}語」, `glossary:bulkMarkConstant`, `glossary:flaggedTitle`, `glossary:importMoreItems`. Terms and words take 語, never 件. |
| routing rule | **件** | `config:routing.ruleCount_other` 「ルール{{count}}件」 |
| run, retry, attempt, request | **回** | an occurrence of an action, never 件. **Shipped batch 4, twice**: `vault:remainingAttemptsHint_other` 「残り{{count}}回です。」 (login attempts) and `vault:retrySuccess_other` 「{{count}}回の操作が完了しました。」 — the call site (`AppShell.tsx:770`, `count: retries.length`) counts the **queued HTTP requests** held while the vault was locked, i.e. occurrences of an action, which is what this row's *request* entry covers. 件 was rejected there for that reason and not by feel. The fix round dropped すべて from that value (it quantified a single item at count 1, which is the count Japanese's sole `_other` category has to serve), and **the citation guard caught this row still quoting the old text** — a two-word string edit whose blast radius reached a different file |
| person (member, collaborator) | **人** | **Still not shipped after batch 4, and the reason is worth recording so nobody hunts for it: `collab` counts nothing at all.** It has no plural family and no numeric placeholder in any of its 106 keys — checked over `locales/en/collab.json`, not assumed. `collab:errors.project_full` names a collaborator limit in words and shows no number. Whichever later batch first counts people decides this row |
| notification | **件** | added batch 4: `account:notificationsUnreadCount_other` 「未読の通知{{count}}件」. A notification is a stored record the user works through, like an LQA result or a review item — the same class as the 件 rows above it, not an occurrence of an action |
| **log entry** | **件** | added batch 5, and it is the one object this batch forced. `console:unreadErrors_other` 「未読のエラー{{count}}件」 counts unread **error rows in the console** (`ConsolePanel.tsx:317`, `unreadErrorCount`), and `console:membersNotShown_other` 「他{{count}}件は表示していません」 counts the **log entries folded into one aggregated row** (`ConsoleLogRow.tsx:158`, `group.count - group.members.length`) — the key name says *members* and the object is not a person. Both are records of an event, which is the 件 class the *notification*, *LQA result* and *routing rule* rows above already sit in. Not 行: a log line wraps and is not a table row. Not 個: nothing here is a discrete physical object. The noun itself is 「ログエントリはまだありません。」 (`console:empty`) — see the *entry* row in `terminology/ja.md` for why ログ disambiguates the reservation rather than breaking it |
| **job** (one entry × one target language) | **翻訳 + 件**, or the 翻訳数 label | **added in the round-5 re-review, and it is the counter table's first entry that is NOT what the English word says.** `logs:translation.queued` says *strings* and `batch:toTranslateCount` says *to translate*, but both numbers are **jobs**: the engine's nested loop over entries × target languages (`M9-translation-engine.ts:1161`, emitted at `:1248`) and, on the bulk-bar side, `StringTable.tsx:270-286`'s identical `for (id) for (lang)`. A 10-entry run into 3 languages reports **30**, so an *entry* word over-states it by the language count. The head noun that is true of a job is **翻訳** — a job is one translation to produce — which is also the unit `logs:translation.batchFailed` 「翻訳{{count}}件のバッチ」 already counts (`m.batchSize`). `logs:translation.queued` writes it as the label 「翻訳数：{{total}}」 because `{{total}}` is not skiplisted; `batch:toTranslateCount` 「翻訳対象{{count}}件」 keeps 対象 because it names the thing being translated rather than a content unit, and `{{count}}` is skiplisted so the counter can sit inline. **Never エントリ and never 行 here** |
| vault key slot | **項目** | added batch 4: `vault:keysCount` 「保管庫に{{count}}項目」. The **unit is the counter**, like 文字／バイト／トークン／ターン／バッチ. 項目 is batch 1's own word for these slots (`config:credentialsMissing` 「保管庫に次の項目を設定してください：{{keys}}」), so the count line and the prose name one object. Not 個 — a credential is a slot in a record, not a discrete physical object; not 件 — nothing here is a record of an event |
| discrete object (model, module, instance, backup, template, glossary file) | **個** | the generic object counter, for a thing that is a countable object rather than a record |
| character / byte / token | **文字 / バイト / トークン** | `config:routing.templateMeta` 「最大文字数：{{maxLength}}」 — the unit *is* the counter |
| category (a content label) | **件** | added batch 2: `strings:bulk.removeCategoryApply_other` 「カテゴリ{{count}}件を外す」. The verb moved from 削除 to 外す in batch 3's fix round (see the delete-verb section); **the counter did not** — the object counted is still a category |
| table row — where English itself says *row* | **行** | added batch 2: `strings:bulk.rowsSelected_other` 「{{count}}行を選択中」, `strings:bulk.selectAllFiltered`. Same counter as a CSV row and for the same reason: the object is a row, not a content unit. Where the same selection is described without the word *row*, it is entries — `strings:compare.selectedCount` 「{{count}}件を選択中」 |
| chat turn | **ターン** | added batch 2: `strings:runs.chatTurns_other` 「{{count}}ターン」 — the unit *is* the counter, like 文字／バイト／トークン |
| LQA issue, finding | **件** | added batch 2: `strings:row.lqaIssues_other` 「LQAの問題{{count}}件」 — a verdict is a record |
| glossary match (a place in an entry where a term was found) | **件** | added batch 3: `glossary:matchResultsCount` 「一致箇所{{count}}件」. The object is a located occurrence, i.e. a record — not a word, so not 語 |
| source text (as a scoping input) | **件** | added batch 3: `glossary:generateFocusSourceTextsCount_other` 「原文{{count}}件に絞り込みました。」. Each pasted line names one entry, so this is the *entry* counter under another name |
| LQA result, review item | **件** | added batch 3: `quality:overallStat.results` 「LQAの結果{{count}}件」, `review:allItemsCount` 「翻訳{{count}}件」, `review:sourceAi.lqaHint`. Consistent with batch 2's *LQA issue* row — a verdict is a record |
| batch (a packed request) | **バッチ** | added batch 3: `category:genBatchCount_other` 「{{count}}バッチで実行します」, `glossary:generateBatchCount_other` 「約{{count}}バッチで実行します」. The unit *is* the counter, like 文字／バイト／トークン／ターン. Never 回 — that counts an *action*, and a batch is a thing sent |
| **orphan** | **件** | added batch 6, and it is a rename of a row rather than a new class: `orphans:toast.bulkDeleted` 「孤立エントリ{{count}}件を削除しました」 counts orphans, and an orphan **is** an entry (`terminology.md`: "an entry that a full-replace CSV import found missing"), so it takes the *entry* counter. Batch 1 already shipped the state-only form 「孤立{{count}}件」 at `config:orphanedCount`; the two agree. Not 行 — the Orphans table is a table, but the object counted is a content unit, which is the distinction the *table row* row below draws |
| **release** (one published version) | **no counter — brackets** | added batch 6, and it is the row that shows a counter is not always owed. `common:changelogShowOlder` 「過去のリリースを表示（{{count}}）」 puts the number in brackets after a completed noun phrase, which the bare-number rule below already licenses — the same device as `config:modulesEnabledSection` 「有効（{{count}}）」 and `strings:runs.judgeApproveAllSuccess`. 件 would have been defensible (a release is a record) and was still rejected: the control is a *Show more* affordance whose number is a remainder, not a quantity the sentence is about. **Whichever later batch counts releases inside running text decides that counter; this row does not** |
| **second (elapsed time)** | **秒** | added batch 6: `common:thinking` 「思考中…{{seconds}}秒」. The **unit is the counter**, like 文字／バイト／トークン／ターン／バッチ. It is also this locale's second deliberate non-`count` detector survivor — see the exception section below |
| a genuinely mixed or unknown selection | **件** | `config:routing.nSelected` 「{{count}}件を選択中」 — one key rendering over both categories and tones. Batch 2 **narrows this row**: the category half is no longer a fallback at all, because *category* has its own row above and it is 件. The licence now rests on the tone half alone. **Batch 3 does NOT settle it, contrary to what this cell used to promise**: `category` counts categories and entries, and no `glossary`/`review`/`category`/`quality` key counts tones — the tone vocabulary lives in Compare (batch 2) and Config (batch 1), neither of which counts them either. The tone half is still open; whichever later batch counts a tone decides it. A key that counts one known class must still take that class's counter. |

**Open the call site and ask what is being counted — the counter is a property of the object,
never of the string or its namespace, and nothing mechanical will ever catch this.** Batch 3
proved it in the same commit that wrote the sentence: `glossary:importMoreItems` shipped
*+{{count}}件…* while five other `glossary` keys in the same file correctly used 語, because the
key *reads* like a generic overflow label. `GlossaryImportPreviewSheet.tsx:109-113` sums the
overflow of `diff.conflicts`, `diff.updated` and `diff.added`, and every row of all three renders
a term's `source` — glossary terms, so 語. The mirror check passed on the same day and by the
same method: `review:revealShowMore` counts review items and findings across all three
`RevealList` call sites, which are records, so 件 is right there. **The mixed-selection escape
hatch below is not available when you have not looked** — it is for a selection that genuinely
spans classes, not for one you have not identified.

**A bare number behind 「：」 or inside brackets takes no counter at all.** That is the
label:value shape from the punctuation section, and it is why
`config:health.rateLimitRetries` is 「429の再試行：{{count}}」 and not a trailing 回, and why
`config:modulesEnabledSection` is 「有効（{{count}}）」. Add a counter only when the number
sits inline in running text or inside a badge.

**If two badges sit in one row, they take one shape.** The import-result row renders seven
badges over three different object classes; the counters differ per object, but every one of
them is a **noun phrase**, never a button. `config:glossariesSkipped_other` and
`config:malformedRows_other` shipped with a ～を無効化 / ～を破棄 tail in batch 1 — the button shape,
beside four noun-shaped siblings — and were rewritten to 「無効化した用語集{{count}}件」 and
「破棄した不正な{{count}}行」. A status is a state, never a command.

**Japanese has exactly one plural category: `other`.** A plural family therefore supplies
`_other` and nothing else — never a `_one` copied across from English. A `_one` key can
never resolve here, and the key-parity guard rejects any suffix that is not a plural
category of the language, so copying English's pair is a red build, not a harmless
duplicate. Batch 1 collapsed six `config` families this way and landed at 368 keys against
English's 374. Batch 2 collapsed eleven `strings` families and landed at **441 against
English's 452** — 452 minus exactly the eleven `_one` keys English writes
(`row.lqaIssues_one`, `bulk.rowsSelected_one`, `bulk.approveSuccess_one`,
`bulk.removeCategoryApply_one`, `runs.queuedCount_one`, `runs.activeRuns_one`,
`runs.retryFailed_one`, `runs.revertSuccess_one`, `runs.chatTurns_one`,
`runs.detailsEntriesHeading_one`, `runs.detailsRetriesHeading_one`), and no key added or
dropped anywhere else.
**Batch 5 is the first batch with nothing to collapse, and it settles batch 6's arithmetic too.**
Its six namespaces contain **no `_one` key at all**, so Japanese lands at English's own 123. What
they do contain is **eight of the twelve bare-plus-`_other` families** (`console:unreadErrors`,
`console:membersNotShown`, `logs:translation.queued`, `failedNoRoute`, `failedModuleDisabled`,
`failedModuleNotFound`, `logs:sourceReview.done`, `logs:orphan.detected`) — and the rule for those
is batch 4's, unchanged: **ship the bare key AND `_other`, never a `_one`.** All eight are
token-symmetric between the two forms, so both members carry the identical count-neutral string,
exactly as `vault:keysCount` and `vault:remainingAttemptsHint` already do; the bare key is
unreachable once `_other` exists and its only job is to be grammatical if anything reaches it.
**A language with one plural category does not owe the twelve missing singulars** — that instruction
in the runbook is for a language with a `one` category, and copying it here would be a red build.
Counted over the seventeen shipped namespaces: **1,597 ja keys against English's 1,626**, a gap of
exactly the 29 `_one` keys English writes. **All 29 are now behind us — batch 6's seven namespaces
contain none** (checked over `locales/en`), so batch 6 lands at English's own 282 and the finished
language at **1,879**. If batch 6's count differs from English's, something is wrong.

**Batch 6 landed on both numbers: 282 and 1,879.** The prediction is now a measurement, and it is
worth saying what made it safe rather than lucky — the arithmetic never depended on the batch at
all. English's plural shape is a property of `locales/en`, readable before a single string is
written, and Japanese's single `other` category is a property of the language. The gap is therefore
fixed at 29 from the first batch onwards, and any batch can check its own contribution before it
starts. **The whole language is 1,879 keys across all 24 namespaces, 29 fewer than English's
1,908, and every one of those 29 is an English `_one`.** No key was ever added, dropped or renamed
anywhere else in six batches.

**`_zero` is the one non-category suffix you keep.** `strings:bulk.removeCategoryApply_zero`
is Japanese's only `_zero` key, and it stays: i18next makes an explicit `key_zero` lookup at
count 0 in every locale whatever its categories, so dropping it would render
*カテゴリ0件を外す* where English renders the countless "Remove categories".

### Non-`count` numeric tokens — the one place Japanese still has to be careful

Japanese has no numeral agreement, so a counter after a number is grammatical at every
value and none of these can be *wrong* in the way they are in an inflecting language. What
they can be is **unreadable at some values**, and there is a second, mechanical reason to
avoid them: `scripts/i18n-preflight.mjs` matches `{{token}}` immediately followed by any
Han/Hiragana/Katakana character, so a counter written straight after a non-`count` token is
**counted as a token-axis survivor and printed on every run.**

**(Batch 5 corrects the previous wording, which said "reported as an uncleared candidate".**
That has not been true for `ja` since the batch-3 escalation was resolved: `ja` is a member of
`NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES`, so a survivor is *cleared unconditionally* at the word
axis and the run stays green. The consequence is that this section's rule is a **readability and
house-style rule, not a gate**, and calling it a gate would have licensed the next batch to treat
a genuine escalation as a mere lint. The batch-4 paragraph at the end of this section already
recorded the tool change; the sentence six paragraphs above it was not re-derived at the time,
which is the same standing-claim failure again, one section apart. Re-run the script; do not
transcribe a previous batch's description of it.)

Both batches therefore use the runbook's count-neutral devices for every non-`count` numeric
token, and the results read at least as well as the noun-first form would. `i18n-preflight.mjs`
confirms it: over `config` + `strings`, **52 raw narrow-rule matches, 0 surviving the token
axis** — every single one sits behind a skiplisted token. Batch 1's examples:

- **Number behind an invariant noun phrase and a colon or bracket.** `config:lqa.lengthLimitValue`
  is 「文字数：{{chars}}／バイト数：{{bytes}}」, and not the counter-after-token draft it replaced;
  `config:routing.templateMeta` carries 「最大文字数：{{maxLength}}」;
  `config:models.confidenceReason.prompt-near-context` opens
  「プロンプトのトークン数（約{{tokens}}）」.
- **A bare ratio with no noun.** `config:reviewProgressCount` is 「レビュー済み：{{reviewed}}/{{total}}」.
- **A textual token in brackets rather than in front of a particle.** `config:instances.formTitle`
  is 「新規インスタンス（{{base}}）」 rather than putting the token in front of a particle.

Batch 2 met eleven more and used the same three devices, plus one new one:

- **Label and colon, then the number** — `strings:pagination.rows` 「エントリ数：{{formattedCount}}」,
  `strings:runs.usageTokens` 「トークン：入力{{input}}／出力{{output}}」,
  `strings:runs.judgeAllFindingsCount` 「指摘：{{total}}・未処理の提案：{{withSuggestions}}」.
- **A bare ratio behind a label** — `strings:runs.stringsProgress` 「エントリ：{{completed}}/{{total}}」,
  `strings:pagination.pageOfTotal` 「ページ：{{page}}/{{total}}」,
  `strings:compare.translateExamplesCount` 「例：{{count}}/{{max}}」.
- **The number in brackets after a completed sentence** — `strings:runs.judgeApproveAllSuccess`
  「提案を適用しました（{{applied}}）」. NEW in batch 2: it is the toast equivalent of
  `config:modulesEnabledSection` 「有効（{{count}}）」, and it is what lets a *success message*
  carry a count without either a counter or a label-colon opening.
- **A token in brackets rather than in front of a particle** — `strings:runs.copyRunId`
  「実行IDをコピー（{{runId}}）」. The draft *実行ID{{runId}}をコピー* put を straight against the
  token and would have been reported on every pre-flight run.

Batch 3 met eleven more and used the same devices — `glossary:generateProgressLabel`
「解析した原文エントリ：{{completed}}/{{total}}」, `glossary:toastGenerated`
「作成した用語集：{{glossaries}}・割り当てたエントリ：{{entries}}」,
`category:genProgressCount` 「バッチ：{{done}}/{{total}}」,
`quality:overallStat.legendPassed` 「合格：{{count}}」, `review:sourceAi.runSummary` — and
`review:sourceAi.scopeAll` 「すべてのエントリ（{{count}}）」 for the brackets device.

**Batch 5 is where this rule was hardest to keep, and the reason is worth recording because the
temptation will recur.** Ten non-`count` numeric tokens land in `logs` and `batch` —
`{{total}}`, `{{position}}` twice, `{{score}}`, `{{findings}}`, `{{suggested}}`, `{{analyzed}}`,
`{{suggestions}}`, `{{completed}}` twice, `{{failed}}` twice, plus a `{{languages}}` that is a
joined **name** list (`registry.ts:104-106` maps the codes through *languageName* and joins them)
— and unlike batches 1-4 these sit in **narrative sentences**, not in chrome. In a Japanese
sentence a number is followed by a particle or a counter, both of which are script-class
characters, so the only shapes that clear the narrow rule are a token before punctuation, before
a bracket, or at the end of a clause. Pushing all ten into those shapes is exactly the pressure
that produced `review:overflowIssue`'s exception below, and the honest question was whether to
generalise that exception across a 59-key namespace.

**It was not generalised, and nothing was distorted to avoid it**, because English's own log
lines are already summary-shaped: every one of the ten sits behind an em-dash that appends a
datum, and rule 2 of the narration section maps that construction onto *（ラベル：値）* anyway.
So the count-neutral device and the faithful rendering are the *same* rendering here:
`logs:judge.done` 「レビューを採点しました（スコア：{{score}}・判定：{{verdict}}）。」,
`logs:sourceReview.done_other` 「原文レビューが完了しました（指摘：{{findings}}）。」,
`logs:glossaryGen.done` 「提案した用語：{{suggested}}・解析したエントリ：{{analyzed}}」,
`logs:stageDetails.done` 「（完了：{{completed}}・失敗：{{failed}}）」,
`batch:progressAriaLabel` 「翻訳済み：{{completed}}/{{total}}」 (the ratio device, byte-parallel to
batch 1's `config:reviewProgressCount`), `logs:translation.queued_other`
「翻訳キューに追加しました（翻訳数：{{total}}）。」 (the label-and-colon device — the label was added
because two sibling log lines label theirs 「（順番：{{position}}）」 and an unlabelled number after a
queue verb invites a position reading), and `logs:translation.batchFailed`
「翻訳{{count}}件のバッチが失敗しました（対象言語：{{languages}}）。」, where the counter sits against
the **skiplisted** `{{count}}` and the name list is bracketed.
**Batch 5 therefore added zero token-axis survivors**: the run over seventeen namespaces still
reports exactly one, and it is still `review:overflowIssue` — the same single survivor batches 3
and 4 reported. (Identify it by re-running the script and re-deriving, not by trusting this
sentence, and note the trap a hand-rolled check falls into: 「・」 and 「ー」 are Unicode
**Common** script, not Katakana, so a hand regex built from the U+30A0–U+30FF *block* reports
thirteen survivors where `\p{Script=Katakana}` reports one. The script is right and the block is
wrong; every one of the twelve extra "survivors" is a token followed by a 中黒 separator. The raw
match total is deliberately not quoted here — it is a run counter and moves with the next batch.)

**Two of those bracketed frames are also the only 0-safe wording, which is a separate and
stronger reason to prefer them.** `logs:sourceReview.done` and `logs:categoryGen.done` fire
whatever the count, including zero (`registry.ts:136` and `:155` default the value to 0), so a
Japanese *…が見つかりました* or *…を提案しました* would assert a discovery at count 0. The
completed-event-plus-bracketed-datum frame states the number without claiming anything about it.
The cost is a small shift of verb — English's *found* / *finished* both become 完了しました — and
that shift is deliberate, not an oversight.

### The one deliberate exception, and why it is not a workaround

**`review:overflowIssue` ships 「オーバーフロー：翻訳の長さは原文の{{ratio}}倍です。」 — a
counter written directly against a non-`count` token, the only one in batches 1–3.** It is
reported by `i18n-preflight.mjs` on every run (`1 after the token-axis skip`, `1 after the
word axis too`), and it is **not** a defect:

- Japanese has no numeral agreement, and 倍 is invariant. The string is grammatical at every
  value the token can take, including the decimals it actually shows (1.75倍, 2.4倍).
- English writes "{{ratio}}× the source length". 倍 is the exact Japanese equivalent of that
  ×, so removing it is *less* faithful, not more.
- Every count-neutral rewrite that clears the detector destroys the sentence: the narrow rule
  for `ja` fires on a token followed immediately by **any** Han/Hiragana/Katakana character, so
  the only shapes that pass are a token at the end of a clause, a token before punctuation,
  or a skiplisted token — and a Japanese sentence cannot end on the number and still carry
  「です。」. The alternatives all convert a sentence into a label:value row that English does
  not have.

So the string stands and the **guard** was the finding. Batch 3 escalated it rather than editing
the script, because that script is shared by all three languages running in this one worktree.
**Do not "fix" this string in a later batch.**

**Batch 6 adds the second — and, since the language is now complete, the last — one:
`common:thinking` 「思考中…{{seconds}}秒」.** The pre-flight now reports **two** token-axis
survivors for `ja`, and both are named here. It clears the same three tests:

- 秒 is invariant, so the string is grammatical at every value the token can take, including 0 and
  the fractional values a live timer shows.
- English's own string is *Thinking… {{seconds}}s* — it spends a unit symbol there, so writing the
  Japanese unit is the faithful rendering rather than an addition.
- Every frame that clears the detector damages the string. The label-and-colon device gives
  *思考中…（経過秒数：{{seconds}}）*, which turns a live indicator two characters wide into a
  data row; dropping the unit loses it; keeping English's half-width `s` would clear the detector
  **for free**, which is precisely why it was considered and rejected — clearing a lint is not a
  reason to write *12s* where Japanese writes *12秒*. That is the "absorb the workaround into the
  string" failure the runbook names, and the fact that the cheap option was also the passing one is
  what made it tempting.

The call site is `components/ui/thinking-indicator.tsx`, a small inline chip beside a streaming
reply. **Two exceptions in 1,879 keys is not a licence to stop looking for a frame** — batch 5 met
ten non-`count` tokens in narrative sentences and found frames for all ten. Both exceptions are
counters welded to a unit that has no alternative; that is the whole class.

**Correction, batch 4 — the escalation was resolved a different way, and the sentence that used to
stand here is now false about the tool.** It said `NUMERAL_WORD_AXIS_EXEMPTIONS` "wants a `ja` entry
for 倍". It does not, and cannot: `ja` is now a member of `NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES`
(`scripts/i18n-preflight.mjs:359`), so for this locale **every** token-axis survivor is cleared
unconditionally and the word-exemption list is never consulted at all. The batch-4 run prints it in
so many words — "1 after the token-axis skip … 0 after the word axis too", with the note that the
word axis is not applicable because Japanese nouns do not inflect for number. The **conclusion** was
right (the string is correct and stays); the **mechanism** named here was overtaken by the fix, and
this paragraph is left visible rather than rewritten away, per the runbook's rule that a quietly
repaired proof is indistinguishable from one that was always sound. The general lesson is the
runbook's other one: a claim about a tool flips the moment the tool ships, so it is re-derived
whenever the paragraph it lives in is touched — which is why batch 4 re-ran the script before
citing it instead of transcribing batch 3's figures.

`{{count}}` itself is exempt from all of this — its own family handles it — so
「{{count}}件」 is the normal, preferred shape and appears throughout the file.

## Two English verbs that each need two Japanese words

Both were forced by batch 2, both bind every later batch, and neither is visible from a
locale file.

- **_Clear_ is 解除 or 消去, by what is being cleared.** 解除 releases a marker or a setting and
  destroys no content: `strings:compare.clearFilters` 「フィルターを解除」,
  `strings:bulk.clearSelection` 「選択を解除」, `strings:filters.clearNewFlags`
  「新規フラグを解除（{{count}}）」, `strings:contextMenu.clearReviewed`
  「「レビュー済み」の状態を解除」. 消去 deletes text the user can see, which is what batch 1
  already shipped for `config:tm.clearAll` 「すべて消去」: `strings:compare.cellClearAria`
   「{{language}}の翻訳を消去」, `strings:shortcuts.clearTranslation` 「翻訳を消去」. Getting this
  backwards makes "Clear translation" read as un-setting a flag.
- **_Discard_ is 破棄 or 却下** — see the *discard* row in `terminology/ja.md`. 破棄 throws away
  the user's own unsaved edit; 却下 refuses something the app offered.

**Batch 3 adds a third English verb with the same problem: _delete_ / _remove_ / _erase_.**
English uses three words and Japanese needs four, because the operations really differ.

- **削除 destroys the thing.** `glossary:confirmDeleteTitle` 「用語を削除」,
  `glossary:confirmDeleteGlossaryTitle` 「用語集を削除」, `category:deleteCategory`
  「カテゴリを削除」.
- **外す un-assigns it and destroys nothing.** `category:removeFromCategory` 「カテゴリから外す」,
  `category:deleteConfirmBody_other` 「「{{category}}」をエントリ{{count}}件から外し…」. Reach for
  解除 instead where what is released is a *marker or setting* (`glossary:bulkClearConstant`
  「{{count}}語の定数を解除」, `glossary:unassignGlossary` 「用語集の割り当てを解除」) — 外す takes a
  member out of a collection, 解除 turns a flag off.

- **消去 wipes a remote store.** `glossary:confirmPushReplaceTitle`
  「DeepLの古いエントリを消去しますか？」, `glossary:pushToDeepLReplace` 「送信して古い分を消去」,
  `glossary:confirmPushReplaceConfirm` 「消去して送信」. This is the same 消去 batch 1 shipped for
  `config:tm.clearAll` 「すべて消去」 — content the user can see, gone.

**Batch 4's two licensed collisions, stated so the next collision sweep does not re-open them.**
(This block sits *after* the four verbs on purpose: the fix round first inserted it between 外す and
消去, which left the promise two paragraphs up — "Japanese needs four" — showing only three.)

- 「取り消し済み」 covers `collab:invites.status.revoked` (*Revoked*) and the shipped
  `strings:runs.revertedBadge` (*Reverted*) — two different operations, a cancelled invite and an
  undone translation edit, and both are status badges in tables, which is what makes it worth
  naming. Licensed: Sharing and Activity are different tabs and cannot co-render. 失効 was rejected
  because it means *lapsed* and would collide with 「期限切れ」 one row above it in the same status set.
- 「無効」 gains a fifth member, `account:mfaStatusNotEnabled` (*Not enabled*). The five English
  values it now covers are *inactive* (`config:reviewProgressInactive`), *Inactive*
  (`config:inactiveLabel`), *Disabled* (`config:module.reasoningEffortDisabled`), *Off*
  (`glossary:disabled`) and *Not enabled*. **The licensed-collapse list further down names only the
  first three** — its parenthesis reads exactly `("inactive" / "Inactive" / "Disabled" are all
  「無効」)`; *Off* was never added to it in batch 3, and *Not enabled* joins them now. (The first
  version of this bullet asserted that list contained *Off* as well. It does not — a claim about
  another part of this same file, made without re-reading it, which is the tracked failure class in
  miniature and is left visible here rather than silently corrected.) All five are the same
  off-state concept; Account and Global Config are mutually exclusive `view` values. It also cannot
  co-render with `account:mfaDisableButton` 「無効化」 in its own section — `MfaSection.tsx` paints
  status+Disable only when MFA is enrolled and status+Enable only in the else branch.

**A batch-2 divergence, fixed in batch 3's fix round — four `strings` keys, one of them an
`aria-label`.** `strings:bulk.removeCategory` ("Remove category") shipped in batch 2 as
「カテゴリを削除」, but `StringTable.tsx:563-568` only filters the entry's own `categories` array
and calls `updateEntry` — it is the 外す operation wearing the 削除 word, and it was
byte-identical to `category:deleteCategory`, which really does destroy the category
(`CategoryTab.tsx` issues `DELETE /projects/:id/categories/:name`). A fourth key nobody had
named was worse: `strings:contextMenu.removeCategory` is the **`aria-label` on the category
chip's ✕** (`StringTableContextMenu.tsx:202`), and its handler at `:93` DELETEs one category
**from one entry** — so a screen reader spoke a destroy verb for an operation that destroys
nothing. All four now take 外す, plus the prose that describes the same sheet:

```
strings:bulk.removeCategory                 → 「カテゴリを外す」
strings:bulk.removeCategoryApply_other      → 「カテゴリ{{count}}件を外す」
strings:bulk.removeCategoryApply_zero       → 「カテゴリを外す」
strings:contextMenu.removeCategory          → 「カテゴリ「{{category}}」を外す」
strings:contextMenu.editCategoriesDescription → 「このエントリにカテゴリを追加したり、外したりします。」
```

`category:deleteCategory` 「カテゴリを削除」 was correct and did **not** move: the weaker string
is the one that changes.

### Batch 4 is the security surface, and it adds two verbs plus one confirmation

`vault` and `account` tell a user what will happen to their credentials, so every one of these was
decided **by opening the route the button calls**, never by reading the label. Overstating and
understating are both defects; the four-way split above decides which word by what the operation
actually does.

- **外す takes a person out of a collection, exactly as it takes an entry out of a category.**
  `collab:sharing.remove` / `removeConfirm` 「メンバーを外す」, `removeConfirmTitle`
  「メンバーを外しますか？」, `removing` 「外しています…」, `memberRemoved` 「メンバーを外しました。」.
  `MembersSection.tsx` deletes the member's grant; the person, their account and their past edits
  all survive. **削除 was rejected as an overstatement** — *メンバーを削除* reads as deleting the
  person — and that is the same defect class as the batch-3 `aria-label` finding, reached from the
  other direction. English's own bare *Remove* is given an object in Japanese **because 外す is
  semantically empty without one** — the bare verb means "take off / detach" and names no object at
  all — not merely because the button sits in a table row. That distinction matters, because the
  *same* row of the *same* page carries `collab:invites.revoke` 「取り消す」 with **no** object
  (`SharingTab.tsx:93`/`:98` paint MembersSection and InvitesSection into one page, so both Actions
  columns are on screen together). 取り消す names a complete action on its own, English is bare in
  both, and adding an object there purely for visual symmetry between two adjacent tables would
  invent content neither English string has. **Add an object when the Japanese verb needs one, never
  to make two columns look alike.**
- **抜ける for leaving a project yourself.** `collab:leaveProject` 「プロジェクトから抜ける」 is an
  **`aria-label`** (`Sidebar.tsx:465`) on a button that `DELETE`s the caller's *own* membership
  (`Sidebar.tsx:379`). A screen reader must not announce 「プロジェクトを削除」 there — the project is
  untouched — so the verb names the departure, not a deletion.
- **削除 stays for a real delete even when English softens the verb.** `account:notificationsDismiss`
  says *Dismiss*, but `notification-store.ts:137` issues `DELETE /notifications/:id`: the row is
  destroyed, not hidden. 「閉じる」 would understate it, so the string is 「削除」. It co-renders with
  `notificationsMarkRead` 「既読にする」 in the same row and the two read as the different actions they
  are.
- **解除 releases a *registration*, and this is the one place that widens the definition above.**
  `account:deviceForgetButton` 「登録を解除」. `DevicesSection.tsx` deletes one `device_vaults` row, so
  something **is** destroyed — the device's saved vault key — which is why 解除's "destroys no
  content" wording does not cover it unchanged. It is still the right verb: the object destroyed is a
  registration, the user's credentials on every other device are untouched, and the operation's whole
  point is that the device must be set up again. 「削除」 would read as deleting the device; English
  chose *Forget* over *Delete* for the same reason, and Japanese platform UIs use 登録を解除 for this
  exact operation. The consequence is not hidden behind the verb either —
  `account:devicesDescription` spells out that the saved vault key is deleted.
- **取り消す cancels an invite, and it is deliberately not a delete.**
  `collab:invites.revoke` 「取り消す」, `collab:invites.revoking` 「取り消し中…」, `collab:invites.status.revoked` 「取り消し済み」.
  The route sets `revokedAt`; `InvitesSection.tsx:224-254` keeps listing the row, greyed. A delete
  verb would promise the row disappears.
- **The one confirmation, stated because a reviewer will look for it:** `vault:delete` 「削除」 and
  `vault:discard` 「破棄」 render **in the same list at the same time**, one per row
  (`VaultEditorDialog.tsx:336-357` branches on `row.existing`). 削除 marks a stored credential for
  destruction on save (`updates[key] = null`); 破棄 drops an unsaved row from the form and writes
  nothing. `vault:undoRemove` 「元に戻す」 replaces 削除 on its own button and can be on screen beside
  破棄. All three are distinct, and 破棄 is also that button's `aria-label`.

### Batch 5 splits one more English verb, and it splits the opposite way from batch 4

**_Dismiss_ is 削除 or 閉じる, by whether anything is destroyed — and batch 4 already owns the
destroying half.** `account:notificationsDismiss` ships 「削除」 because the handler really issues a
DELETE. `system:restarted.dismiss` and `system:cancelled.dismiss` ship 「閉じる」 because
`RestartBanners.tsx:142` and `:161` write a `localStorage` flag and hide a banner — the restart
itself, the server's status and every other client are untouched, and there is nothing to destroy.
Both are `aria-label`s on an ✕ button, which is exactly the surface where the batch-3 finding
lived: a screen reader announcing 削除 for a banner that only hides would promise a deletion that
never happens. **The two co-render** — `AppShell.tsx:442` paints `RestartBanners` above the view
while `AccountView` is open — so the split is required, not merely defensible, and
`i18n-preflight` check 2 reports it as a same-English/different-rendering group on every future
run. It is licensed; do not "align" it.

「閉じる」 is the same value `glossary:close` already ships for English's *Close*, which the same
check reports from the other direction. That collapse is licensed too: *Dismiss* and *Close* name
one action here — make this thing go away without changing anything — and the plain-dictionary-form
row above is the shape for a verb with neither a サ変 noun nor a state to set.

## Locale-specific traps

- **Katakana or kanji — decide per term and record it.** 「モジュール」 is right (there is
  no natural kanji compound), 「翻訳メモリ」 beats the katakana transliteration, and
  「実行」 beats *ran* for _run_. What matters is deciding once, in `terminology/ja.md`,
  rather than per string.
- **_Stage_ takes the gaming reading, not the process one** — a playable level. The two obvious
  kanji compounds — *dankai*, *kōtei* — are exactly the process readings `terminology.md` warns about, and it is the single
  most likely mistranslation in the app. **Batch 2 settled it, not batch 6 as this bullet used to
  say**: the tab label `strings:tabs` (stage-details) is 「ステージ詳細」, so the rendering is
  ステージ and `stage-details:title` copies it. Batch 6 inherits the decision rather than making it.
- **_Judge_** takes the evaluative sense (「評価」, the rendering batch 1 shipped in
  `config:batchGroupingDescription`. The legal readings — saibankan, sabaku — are the trap.
- **Do not insert manual line breaks.** Japanese line breaking (禁則処理) is handled by the
  renderer; a hand-placed break will be wrong at every other window width and will break
  the line-break-parity quality check.
- **Do not carry the English period across into a label.** 「保存」 takes no 。; full stops
  belong in sentences, not in controls.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Japanese needs no parenthetical at all — number plus
  counter already covers every count.
- **Japanese collapses distinctions English marks, and that is licensed, not sloppy.**
  Number (`config:targetLanguages` "Target Languages" and `config:routing.labelTargetLanguage`
  "Target language" are both 「ターゲット言語」) and case ("inactive" / "Inactive" / "Disabled"
  are all 「無効」) carry no information into Japanese. Record such a group as licensed rather
  than inventing a second word to keep them apart. **Batch 2's licensed collapses, every one
  of them reported by `i18n-preflight.mjs` check 2 and every one deliberate:** 翻訳 over
  *Translations* / *Translation*; 状態 over *STATUS* / *Status* (the shouted
  header carries no case into Japanese — `english-review-notes.md` says so explicitly);
  要レビュー over the sentence-case filter and the deliberately lowercase badge; カテゴリを外す
  over *Remove category* / *Remove categories* (batch 2 wrote 削除 there and batch 3's fix round
  corrected the verb — the *collapse* over English's singular/plural was always fine, the verb
  was not); AIレビュー over *AI Review* / *AI review*;
  カテゴリ over *Category* / *Categories*; トーン over *Tone* / *Tones*; ターゲット言語 over
  *Target language(s)*; 完了 over *Done* / *Completed*; フィルター over *Filtering* / *Filters*;
  言語 over *Language* / *Languages*; LQA合格 over *Passed LQA* / *LQA passed*; and
  「スコア：{{score}}/100」 over `config:models.confidenceScore` and `strings:runs.judgeScoreLabel`,
  whose English differs only in spelling one fraction two ways.
  **One reported collision was a real find and was fixed rather than licensed:** *Start* and
  *Started* both landed on 「開始」, so `strings:runs.startedColumn` became 「開始日時」 — it is a
  timestamp column, and the more accurate rendering is also the one that separates it from
  `strings:compare.translateStart`. Reading the collision list as "all licensed" would have
  shipped that.
  **Batch 3's licensed collapses**, every one reported by `i18n-preflight.mjs` check 2 and
  every one checked against the whole-rail test rather than waved through: 用語集 over
  *Glossaries* / *Glossary*; カテゴリ over *Categories* / *Category*; 原文 over *Source* /
  *Source text*; 定数 over *Constant* / *constant*; 操作 over *Actions* / *Action*; 追加 over
  *Add* / *added* and 削除 over *Delete* / *removed* (the diff legend — the participle carries
  no information into Japanese); 合格 over *Passed* / *Pass* and 不合格 over *Failed* / *Fail*;
  レビューする言語 over *Language to review* / *Languages to
  review*; 有効な用語集 over *Active glossaries* / *Enabled glossaries*; モジュールを選択 over
  *Choose a module* / *Select a module*; すべて表示 over *View all* / *Show all*; 再試行 over
  *Try again* / *Retries*; 禁止用語 over *Forbidden terms* / *Forbidden term* — **that last one
  was checked in code, not reasoned**: `quality:checkLabels` is only ever read as
  `checkLabel(entry.key)` over an emitted LQA *issue* type (`QualityTab.tsx:100`, `:210`), and
  `forbidden-terms` is a check id that `modules/M10/` never emits as an issue, so the two
  cannot appear in one chart.
  **Batch 5's licensed collapses, and the boundary extension one of them forced.** Reported by
  `i18n-preflight.mjs` check 2, every one checked against the container both keys paint into:
  警告 over *Warning* (`account:notificationsSeverity.warning`, `config:lqa.severityWarning`,
  `settings:previewSamples.warn`) and *Warn* (`console:filter_warn`); 閉じる over *Close*
  (`glossary:close`) and *Dismiss* (`system:restarted.dismiss`, `system:cancelled.dismiss`);
  「カテゴリの生成に失敗しました。」 over *Failed to generate categories.* (`category:runFailed`) and
  *Category generation failed.* (`logs:categoryGen.failed`); and the **eight** bare/`_other` pairs
  this batch owns, where English's singular and plural land on one Japanese string exactly as
  batch 4's `vault:keysCount` did.
  **The first three all co-render, and none of the three differences is number, part of speech or
  an article** — so the boundary as batch 4 stated it did not decide them. The extension, on the
  **form-versus-sense** axis, with a **control-class veto**:
  > A collapse over two co-rendering keys is licensed when **(0)** the two keys name the same
  > operation **with the same consequence** — established by **opening the code**, never by
  > reading the labels — **and (1)** the English difference is one of *form* only — number, part
  > of speech, article, abbreviation, or two phrasings of one event — **and (2)** the two keys are
  > not two control classes that the shape table renders differently. All three clauses must hold.
  > A difference in **meaning** fails clause (0) and is never licensed.

  **Clause (0) said "on the same object" until the whole-language sweep, and the file's own table
  contradicted it.** The licensed 閉じる row covers `glossary:close` (a dialog button) and
  `system:restarted.dismiss` (the ✕ on a restart banner) — two plainly different *objects*, which
  do co-render (`AppShell.tsx:442` paints `RestartBanners` above every view) — so the clause as
  worded refused a row sitting directly beneath it. The discriminator in the refusal the clause was
  actually written for was never object identity: it is **consequence**, `DELETE /notifications/:id`
  against a `localStorage` flag. Reworded to match what it has always been doing.

  **Clause (0) is stated as a clause because it used to be a trailing sentence, and that was luck
  rather than structure.** The round-5 re-review found the gap: where two keys carry
  **byte-identical** English and sit in the **same** shape row but differ in **behaviour**,
  clause (1) is vacuously satisfied and clause (2) does not fire, so nothing in the rule refused
  them — only a separate paragraph did. The live instance is in this very batch:
  `account:notificationsDismiss` and `system:restarted.dismiss` are both *Dismiss*, both buttons,
  and one issues a `DELETE` while the other writes a `localStorage` flag. Promoted to clause (0) so
  the refusal is structural. **It is also the clause you check first**, because it is the only one
  that requires reading code, and the other two are cheap once it passes.

  **Both clauses were paid for, and the first wording of this extension failed on both.** Batch 5
  first wrote it as *"licensed when the English distinction names no difference in what the two
  controls do"*, and the round-5 review falsified it twice; the retraction is left visible because
  a quietly repaired rule is indistinguishable from one that was always sound.

  - **It was not sufficient — it was vacuously satisfied by byte-identical English**, where there
    is no distinction at all to name. That licenses the three splits this same file calls
    mandatory: `config:models.select` / `models.pickTitle` (the batch-1 deliberate group),
    `sidebar:joinProject` / `collab:join.joinButton` (which this file says in so many words is
    "not optional", because they co-render nested), and `review:filterFlagged` / `review:flag`
    (split in batch 3's fix round after the review found they co-render). **What keeps those three
    apart is control class, not behaviour** — a trigger, a title and a button are three rows of
    the shape table — which is why clause (2) is a veto and not a footnote.
  - **Its own first instance failed its own test.** A console log-level **filter tab** and a
    notification-severity **badge** do not do the same thing: one filters a stream, the other
    labels a record. What actually licenses 警告 is that both English strings name the same
    *value* and differ only by an **abbreviation** — a difference of form, in the same class as
    number, part of speech and article, and therefore one no Japanese rendering can carry. Right
    answer, unfounded reason, committed inside the paragraph that introduced the rule.

  **The rule applied to batch 5's own three, so it is checkable rather than asserted:**

  | Collapse | Clause (0) — same operation | Clause (1) — form | Clause (2) — control class |
  | --- | --- | --- | --- |
  | 警告 over *Warning* / *Warn* | both name the same severity **value**; neither is an operation | **abbreviation** of one value name | filter tab and status badge are both the bare-noun row — same class |
  | 閉じる over *Close* / *Dismiss* | both hide the thing and destroy nothing — checked at `RestartBanners.tsx:142`/`:161` | **two words for one action** | `glossary:close` and the two banner ✕ `aria-label`s are all the plain-dictionary-form button row — same class |
  | 「カテゴリの生成に失敗しました。」 over two English sentences | literally the same event, one toast and one log line for it | **two phrasings of one event** | both narration sentences — same class |

  And the refusal, which is the same table's fourth row and the reason clause (0) exists:

  | Refused split | Clause (0) | Verdict |
  | --- | --- | --- |
  | `account:notificationsDismiss` 削除 vs `system:*.dismiss` 閉じる — byte-identical *Dismiss*, both buttons | **fails** — `notification-store.ts:137` issues `DELETE /notifications/:id`; the banners write a `localStorage` flag | not licensed; the identical English is the thing that had to be **split** |

  **"Two words for one action" is the loosest member of the form list, and clauses (0) and (2) are
  what keep it safe.** Without them it reads as "same action ⇒ same string", which is precisely how
  a trigger and its dialog title, or a filter tab and the button that sets it, get collapsed — three
  defects this file has already paid for.

  **Batch 6 met the temptation and the prediction written here was right about the shape and wrong
  about the keys** — it said the test would come in "`common`'s *Close* / *Cancel* / *Back*", and
  `common` has no *Close* and no *Back* (see the head of this file). What it actually has is
  *Cancel*, one of **three** bare `Cancel`s this batch ships, and the pair that tested the rule
  hardest was not a control at all. The three clauses applied, in the order the rule now demands —
  clause (0) first, because it is the only one that needs the code:

  | Pair | (0) same operation, from the code | (1) form only | (2) control class | Verdict |
  | --- | --- | --- | --- | --- |
  | `stage-details:cancel` / `orphans:actions.cancel` / `backup:confirmCancel` — all bare *Cancel*, all 「キャンセル」 | **fails**: `StageDetailsTab.tsx:394` calls `cancelRun` on a **server-side run**; `OrphansTab.tsx:430` calls `closeRelink`, a sheet dismissal; `backup:confirmCancel` dismisses a `ConfirmSheet` | byte-identical | all buttons | **collapsed anyway — and NOT by these clauses.** The three sit in three different project tabs and **cannot co-render**, so the older boundary licenses them outright; the clause table is the *co-render* licence and never had to be reached. Stating which licence a collapse runs on is the point of the exercise |
  | `colorText:swatches.warn` / `console:filter_warn` — both *Warn*, both 「警告」 | fails on referents: a colour role against a log level | vacuous — byte-identical | swatch chip and filter tab are both the bare-noun row | **collapsed, on the paradigm rather than on the clauses.** `ConsolePanel.tsx:398` gates the filter tabs on `open`, so the panel really can be open over the Text Styler view. The console's five levels are scored as a set (「すべて」「エラー」「警告」「情報」「デバッグ」) and so are the swatch group's five roles (「タイトル」「通常」「キー1」「キー2」「警告」); nudging either to a synonym to dodge a report is the error runbook 2.1 names. Recorded as a documented exception, not a silent one |
  | `colorText:groupQuality` / `strings:tabs.quality` — both *Quality* | **fails**: a palette group of five rarity-tier colours (`palettes.ts:57-64` — gray/green/blue/purple/orange) against the LQA Quality dashboard | vacuous — byte-identical | both bare-noun labels, so no veto | **REFUSED.** `colorText:groupQuality` ships 「品質別の色」 |

  **The refusal is right and the ground first given for it was wrong.** The round-6 review
  falsified it and the retraction is left visible, because a quietly repaired rule is
  indistinguishable from one that was always sound. The discarded sentence read:

  > `strings:tabs.quality` is a **surface name**, which makes every occurrence of that string a
  > claim about that surface.

  **It fails in both directions.** It over-refuses: `strings:tabs.strings` 「翻訳」 is a surface
  name by exactly the same test, and `orphans:columns.translations` and
  `stage-details:translationsHeading` both render 「翻訳」 byte-identically while
  `AppShell.tsx:433-435` mounts the rail beside every view — the identical co-render fact the
  refusal rests on. Under the discarded rule both would have to be refused, and this file
  licenses them. **And it under-refuses**: applied consistently it condemns a pair nobody had
  looked at, `strings:tabs.data` 「データ」 against `account:tabData` 「データ」, which co-render
  for the same reason. The corroboration offered was wrong too —
  `strings:runs.judgeTargetLabel`'s English is **"Translation"**, singular, so it is an
  inflection collapse and not an equality with a surface name at all.

  > **The test is REFERENT IDENTITY.** Two keys may render identically when they name the same
  > referent — the same object, or the same concept. A collapse is refused when the identical
  > string would assert a referent the key does not have. Surface-name-ness is a property of one
  > key; a collapse is a relation between two, so only a relation can decide it.

  It reproduces every equality in this locale — **and the enumeration below is the claim that had
  to be corrected, not the test.** The whole-language sweep ran the collision check this file never
  ran, every rail label against the whole corpus, and found **four** co-rendering equalities the
  list omitted: `sidebar:groups.content` 「用語」 against the three terminology labels
  (`review:sourceAi.findingTerminology`, `strings:runs.aiReviewCheckTerminology`,
  `strings:runs.judgeIssueTerminology`); `strings:tabs.glossary` against
  `strings:columns.tooltipGlossary`; `strings:tabs.category` against
  `config:routing.labelCategories` and `strings:columns.tooltipCategory`; and
  `sidebar:translationMemory` against `config:tm.policyTitle` and `config:tm.browserTitle` — two
  identical section headings inside one panel, which English writes identically too. **All four are
  correctly licensed** by referent identity, so the test survived the widening intact; the sentence
  claiming the list was complete did not. *"Every X"* is a scan of the whole corpus — the same
  lesson this file already records about *"X is the only Y"*, one section up, and now committed
  twice. 「翻訳」 names *the translations*
  at all three keys, so an identical rendering asserts nothing false. 「カテゴリ」, 「用語集」,
  「アクティビティ」, 「品質」 over its guide topic, 「原文AIレビュー」, 「翻訳AIレビュー」,
  「ステージ詳細」, 「孤立エントリ」, 「共有」, 「テキスト装飾」 and 「メンバー」 are each one
  referent named twice. `colorText:groupQuality` is the one pair with **no referent in common** —
  a colour ramp against a quality dashboard — so an identical rendering would assert one, and it
  is refused. The 警告 row above survives on the same test rather than on the paradigm alone:
  both keys name the **warning** concept, one as a colour role and one as a log level, so no
  false identity is asserted; the paradigm argument is why 警告 rather than a synonym, not why a
  collapse is allowed at all.

  **The pair the new test surfaces, examined rather than left open.** `strings:tabs.data` is the
  project's Data tab (CSV import/export of entries, `config/DataTab.tsx`) and `account:tabData`
  is the account's Data tab (export and deletion of the **user's own** account data,
  `account/DataTab.tsx`, whose own file comment calls it "Data (export + deletion)"). The
  referents differ in scope, they co-render, and both ship 「データ」. **Licensed, narrowly:**
  *Data* is a generic noun in both English strings and neither is a domain term, so English
  ships the identical genericity and no Japanese rendering can mark a distinction English does
  not make — the opposite of 品質, where the rail's word names a specific product surface. If a
  later sweep disagrees, the fix is a batch-2/batch-4 string and belongs to a round that owns
  those namespaces, not to this one.

  **M8, accepted:** 「品質別」 shipped first and was a bare 別-modifier with nothing to modify —
  the substantivized-modifier shape this locale's own *match* row rejects ("a bare 一致 as a
  panel title is the substantivized-adjective shape reviewer-rubric item 4 rejects"), and not
  the shape of the precedent cited for it: every 別 construction here carries a head noun
  (「ソース別の問題」, 「言語別の合格率」). It ships **「品質別の色」** — 5 glyphs against a soft
  budget of 9, the collision refusal intact, the head noun restored, and its four sibling
  captions all plain noun phrases beside it (「暗い背景」「明るい背景」「元素」「自分の色」).

  **The category pair has harder evidence than batch 5 cited, and the round-5 review found it.**
  The parallel glossary pair — `glossary:generateFailed` and `logs:glossaryGen.failed` — is
  **byte-identical in English** ("Glossary generation failed."), and Japanese ships one string for
  it with no collapse required at all. Two sibling generators, one written two ways in English and
  one written one way, for the same kind of event: that asymmetry is the evidence that the category
  pair's two phrasings are an **English accident**, not a distinction. **It is now a row in
  `english-review-notes.md`** — filed from this locale's round-5 fix round — which tells every locale
  to render the category pair as one event, so the collapse is no longer a per-language judgement.
  **The console's five filter tabs are a paradigm, scored together rather than key by key** —
  「すべて」「エラー」「警告」「情報」「デバッグ」 — which is why 警告 was not nudged to a rarer synonym
  to dodge the collision report: it is the standard Japanese log-level word, and breaking the set
  to separate it from a severity badge in a different view would be the error runbook 2.1 names.
  情報 repeats `account:notificationsSeverity.info` and `settings:previewSamples.info` outright,
  and that is not even a collapse — all three English strings are the identical *Info*.

  **Batch 6's licensed collapses, and its four deliberate splits.** Licensed, each checked against
  the container both keys paint into: 原文 over *Source* at `orphans:columns.source`,
  `stage-details:sourceHeading` and `chatFocusSource` (one word, three homes, English identical);
  翻訳 over *Translations* at `orphans:columns.translations` and `stage-details:translationsHeading`
  (see the refusal table above); 項目 over *Fields* / *Field* (`stage-details:fieldsHeading`,
  `chatFocusField` — number only, and both name a stage-details form field); ガイド over *Guide* /
  *Guides* (`sidebar:guide`, `welcome:guidesHeading` — number only, and they **do** co-render, the
  rail beside the welcome view); 古い over *stale* / *Stale* (`config:module.cacheStale`,
  `stage-details:stale` — case only); 長さ制限 over *Length limit* / *Max length*; 翻訳はまだありません
  over *No translations yet* / *No translation yet*; 警告 over *Warn* in its fifth home; and
  クリップボードにコピーしました over the identical English toast in two namespaces
  (`stage-details:copied`, `colorText:copied` — one operation, checked at both call sites).
  The four **splits**, all reported by check 2 and all deliberate:

  - ***Create backup* takes two renderings.** `backup:createSection` is a `<CardTitle>`
    (`BackupTab.tsx:224`) and takes the title shape 「バックアップの作成」; `backup:createButton` is
    the `<Button>` inside that same card (`:233`) and takes the action shape 「バックアップを作成」.
    They co-render, one directly above the other, so clause (2) vetoes the collapse — the
    `config:models.select` / `pickTitle` split, in a second namespace. This is also the exact pair
    the runbook holds up as a Russian defect (a section title that took the button's shape because
    a term row quoted it); the term fixes the lexeme, the control fixes the form.
  - ***Raw* takes two renderings, because it is two senses.** `colorText:modeRaw` 「タグ表示」 is the
    editor mode that shows the markup tags themselves (`ColorTextView.tsx` — raw mode edits the
    tagged string in a textarea, rich mode is a contenteditable), paired with `modeRich`
    「リッチ表示」. `strings:runs.judgeViewRaw` 「全文」 is the suggestion panel's full-text view
    against 「差分」. A bare transliteration of *Raw* names nothing in Japanese in either place.
  - ***Translate* takes two renderings** — `sidebar:groups.translate` / `strings:guide.groupTranslate`
    「翻訳作業」 and `stage-details:translate` 「ステージ詳細を翻訳」. Both exist for the same reason:
    a bare 翻訳 would land on a heading or a column that reads 翻訳 on the same screen.
  - ***Quality* takes two renderings** — the refusal recorded above.

  **Two same-English pairs batch 3 deliberately kept apart**, which the same check reports from
  the other direction: 不合格 (`quality:legend.failed`, a verdict) against 失敗
  (`strings:runs.statusFailed`, a run that errored); and 「メモ」 (`glossary:colNotes`, the column
  header, matching the shipped `config:routing.promptNotes`) against 「メモを入力」
  (`glossary:notesPlaceholder`, the placeholder inside the field) — the same trigger/placeholder
  split as `config:models.select` / `pickTitle`.
  **One same-English pair that stays collapsed on purpose**: 前へ covers both *Previous*
  (`review:prev` and its two siblings) and *Prev* (`strings:pagination.prev`).
  `english-review-notes.md` item 7 tells translators not to align those two, and the licence is
  the rest of that same instruction — "use your locale's usual pager wording". 前へ *is* the usual
  Japanese wording for both controls, and they never co-render (`ComparisonToolbar.tsx` versus
  the review panel). **The licence is not "Japanese has no abbreviation"** — an earlier version
  of this bullet said so and it is false: Japanese pagers commonly write the bare 「前」／「次」, so
  the abbreviation exists and a later translator would have falsified the claim in one search.
  It is rejected here because 前へ reads better in both controls, not because nothing shorter
  exists.
  **The licence has one hard boundary, and batch 2 crossed it once.** A collapse is licensed
  only where the two keys **cannot co-render** — *unless the difference English is marking is
  number, part of speech, or an article*, which carry nothing into Japanese and therefore cannot
  be preserved by any rendering. That exception is not new and is not a softening: it is the same
  principle stated four bullets down ("Number and part-of-speech carry no information into
  Japanese"), and it is what already licenses 用語集 over 用語集 in the guide rail, 共有 over 共有 and
  カテゴリ over カテゴリ across a rail label and a page title, and — batch 4 — メンバー over メンバー
  in one card, 環境設定 over 環境設定, and プロジェクトへの参加 over itself. Every one of those pairs
  plainly **does** co-render, so stating the boundary absolutely made the file contradict its own
  shipped decisions in six places. **What the boundary still forbids absolutely is a collapse over
  two English strings that differ in *meaning*** — that is the case batch 2 crossed.
  *Translate* was in the list above until review
  found that its rendering would reach the sidebar and land on top of `strings:tabs.strings` —
  see the group-heading section below for the mechanism, which is **not** direct co-rendering
  and is the more useful thing to know.
  **Co-rendering is a property of any shared container, and "the whole rail" is one instance of
  that, not the definition.** A first draft of this rule said "check the call sites for
  containment", which is too narrow: `Sidebar.tsx` renders every group and every tab into one
  scrolling column, so any two labels in it are on screen together whether or not one contains
  the other. **Batch 3 then narrowed it the wrong way and shipped a defect for it.** Its report
  claimed every licensed collapse had been "checked against the whole-rail test" — but the
  whole-rail test is about the *sidebar*, and 「保留」 over *Flag* / *Flagged* lives in the review
  queue's own toolbar: `ReviewTab.tsx:755` always renders the 保留 filter tab and `:1073` renders
  the 保留 button under `filter !== 'flagged'`, i.e. **exactly when that tab is visible and
  inactive**, both carrying the same `Flag` icon. The boundary was right and the surface was
  wrong. The fix is `review:flag` 「保留にする」 — the ～にする shape this file already created for a
  state with no サ変 action noun, and the shape the key's own toast
  (`review:flaggedToast` 「翻訳を保留にしました」) was already using. `review:filterFlagged` stays
  「保留」, the state. **So the test is: name the container both keys render into — a rail, a
  toolbar, a card, a table row, a popover — and only then ask whether they can be on screen
  together.** A collapse is not cleared by checking one container class. That is why the Config/Settings hazard
  in the surface table needs its own hand-written warning — 「設定」 and a batch-4 *Settings*
  rendering would never be parent and child, and would still sit six rows apart in one rail.
  Number and part-of-speech carry no information into Japanese; a group/member distinction, or
  two different surfaces, do.

## Surface names settled so far — repeat these verbatim

A surface's name is written out two or three times, in different namespaces, and the two
keys are never on screen together. These are the renderings batches 1 and 2 fixed; a later batch
that names the same surface **copies them exactly** and does not re-decide. **Batch 2 owns
`strings:tabs.*`, so most rows below are now anchored on a shipped tab label rather than on
prose.** Those labels render as sidebar menu items, not in a horizontal bar — see the hard
budget row above — so every one of them is also subject to the 13-glyph truncation limit.

| Surface | Rendering | Fixed by | Also owed by |
| --- | --- | --- | --- |
| Global Config | 「グローバル設定」 | `config:globalConfigTitle` | `sidebar:globalConfig` 「グローバル設定」 (shipped batch 4) — English is word-for-word identical in both, so Japanese must be too |
| Translation Memory | 「翻訳メモリ」 | `config:tm.policyTitle`, `config:tm.browserTitle` | `sidebar:translationMemory` 「翻訳メモリ」 (shipped batch 4), `strings:guide.groupTranslationMemory`, `strings:guide.topicTranslationMemory` (both shipped batch 2) |
| **Settings** (the app-wide page) | **「環境設定」** | `sidebar:settings` and `settings:title`, both shipped batch 4 | English is byte-identical in both, so Japanese is too — the `sidebar:globalConfig` case exactly. **Not 「設定」** — see the three-way 設定 hazard below |
| **Changelog** | 「変更履歴」 | `sidebar:changelog` (shipped batch 4) | `common:changelogEntryError` 「このリリースの変更履歴を読み込めませんでした。」 (shipped batch 6). `common:changelogShowOlder` names the *release*, not the page: 「過去のリリースを表示（{{count}}）」 |
| **Legal** | 「法的情報」 | `sidebar:legal` (shipped batch 4) | `legal:title` is a **different English string** ("Legal & policies") and expands deliberately, like Activity's page title. **Batch 6 shipped 「法的情報とポリシー」** — the root kept, the bare rail value not copied onto it, and English's `&` rendered と rather than ・ (中黒 separates list items; this is a two-member conjunction in a title). The seven document names under it are surface names of external pages and take the established Japanese legal-document titles: 「利用規約」「プライバシーポリシー」「クッキーポリシー」「適正利用ポリシー」「サブプロセッサー」「セキュリティと責任ある開示」. 再委託先 was rejected for *Subprocessors* — it is the contract-law term for the relationship, not the name of a page a reader is looking for |
| **About Narn** | 「Narnについて」 | `sidebar:aboutNarn` (shipped batch 4) | the brand is copied **verbatim, in the spelling that key uses** (`Narn`, not `narn` or `NARN`), half-width, with no space before について |
| **Account** | 「アカウント」 | `sidebar:account` (shipped batch 4) | the Account page has **no** title key — `AccountView.tsx` renders no `<h1>`, so the rail item is the surface's only name |
| **Guide** | 「ガイド」 | `sidebar:guide` (shipped batch 4) | the *guide* term itself |
| Translations (tab) | 「翻訳」 | `strings:tabs.strings`; named in prose by `config:routing.categoriesConfiguredHint` 「カテゴリは翻訳タブで設定します。」 | `strings:guide.topicMultiLanguage` 「翻訳タブ」 (shipped batch 2) |
| Compare (tab) | 「比較」 | `strings:tabs.compare`; named in prose by `config:routing.tonesHint` 「トーンは比較タブでエントリごとに設定します。」 | `strings:guide.topicCompare` 「比較タブ」 (shipped batch 2) |
| Backup (tab) | 「バックアップ」 | `strings:tabs.backup`; named in prose by `config:importSnapshotNote` 「バックアップタブから復元できます。」 | `strings:guide.topicBackup` 「バックアップタブ」 (shipped batch 2). **Batch 6 shipped the page title on the same root and it expands, like Activity's:** `backup:title` ("Backup and Restore") is 「バックアップと復元」 — do not shorten it to match the tab. The `logs:backup.restored` binding was paid: `backup:toastRestoreSuccess` ships 「バックアップを復元しました。」, copied because the English is byte-identical |
| Orphans (tab) | 「孤立エントリ」 | `strings:tabs.orphans`; named in prose by `config:fullReplaceOrphanNotice` 「孤立エントリタブで解決してください。」 | `strings:guide.topicOrphans` 「孤立エントリタブ」 (shipped batch 2), `orphans:title` 「孤立エントリ」 (shipped batch 6, copied verbatim) |
| Config (tab) | 「設定」 | `strings:tabs.config` | `strings:guide.topicConfig` 「設定タブ」 (shipped batch 2). **Batch 4 did not reuse the bare 「設定」 for the app-wide *Settings* surface** — it took 「環境設定」; see the 設定 hazard below |
| Data (tab) | 「データ」 | `strings:tabs.data` | — |
| Routing (tab) | 「振り分け」 | `strings:tabs.routing` | `strings:guide.topicRouting` 「振り分けタブ」 (shipped batch 2). The *routing rule* term is 振り分けルール (`config:routing.title`); the tab is the bare root |
| Source AI review | 「原文AIレビュー」 | `strings:tabs` (review-source-ai) | `review:sourceAi.configTitle` 「原文AIレビュー」 (shipped batch 3). Built on batch 1's 原文レビュー (*source review*) plus AI |
| Translation AI review | 「翻訳AIレビュー」 | `strings:tabs` (review-translation-ai) | `review:translationAi.title` 「翻訳AIレビュー」 (shipped batch 3) |
| Manual review | 「手動レビュー」 | `strings:tabs` (review-manual) | `review:title` is a **different English string** ("Review queue") and takes its own rendering — batch 3 shipped 「レビューキュー」. Do not copy 手動レビュー onto it |
| Quality | 「品質」 | `strings:tabs.quality` | `strings:guide.topicQuality` 「品質」 (shipped batch 2). **`quality:title` is a different English string** — "Quality Dashboard", not "Quality" — and shipped in batch 3 as **「品質ダッシュボード」**, matching the 品質ダッシュボード inside `strings:tabPlaceholder.quality`. Keep 品質 as the root so the tab and the page title read as one surface; do **not** copy the bare 「品質」 onto it |
| Glossary (tab) | 「用語集」 | `strings:tabs.glossary` | `strings:guide.topicGlossary` 「用語集タブ」 (shipped batch 2), `glossary:glossaries` 「用語集」 (shipped batch 3 — the panel heading English pluralises and Japanese does not; identical and licensed) |
| Category (tab) | 「カテゴリ」 | `strings:tabs.category` | `strings:guide.topicCategory` 「カテゴリタブ」 (shipped batch 2), `category:title` 「カテゴリ」 (shipped batch 3). English's singular tab / plural page title carries no information into Japanese |
| Activity | 「アクティビティ」 | `strings:tabs.runs` | `strings:guide.topicActivity` 「アクティビティ」 (shipped batch 2). The **page title expands deliberately**: `strings:runs.title` is 「翻訳アクティビティ」. Do not shorten it to match and do not invent a third wording |
| Sharing | 「共有」 | `strings:tabs.sharing` | `collab:sharing.pageTitle` 「共有」 (shipped batch 4). Exact equality with the rail item, and they **do** co-render — `SharingTab.tsx:59` paints the `<h2>` beside the whole sidebar. Licensed: English is byte-identical in both homes |
| Stage details | 「ステージ詳細」 | `strings:tabs` (stage-details) | `stage-details:title` 「ステージ詳細」 (shipped batch 6, copied verbatim) |
| Text Styler | 「テキスト装飾」 | `strings:tabs` (color-text) | `sidebar:colorText` (shipped batch 4), `colorText:title` 「テキスト装飾」 (shipped batch 6). All three homes now agree in the shipped files |
| AI Review (guide topic) | 「AIレビュー」 | `strings:guide.topicAiReview` | the *AI review* term itself — `strings:runs.judgeBadge` |
| Pseudo Test | 「疑似テスト」 | `config:pseudoTestHelpAria` | `strings:guide.topicPseudoTest` 「疑似テスト」 (shipped batch 2) |
| Credential Vault | 「認証情報の保管庫」 | `strings:guide.topicVault` | `vault:statusLabel` 「認証情報の保管庫」 (shipped batch 4). The short form is 「保管庫」 — see the *credential vault* row in `terminology/ja.md`, which checked all four frames |
| **Theme names** (four proper nouns) | 「クラシック」／「ピクセル」／「テクノ」／「ミニマル」 | `settings:themes.default.name`, `.pixel.name`, `.techno.name`, `.minimal.name` (all shipped batch 4) | **`welcome:themeChooser.names.*` — shipped batch 6, byte-identical, all four, copied out of `locales/ja/settings.json` rather than out of this row.** That distinction is the point: `terminology.md` calls this the app's highest-risk duplication precisely because the two homes are never on screen together, so **nothing mechanical catches a divergence** — the citation guard checks that a quoted rendering exists *somewhere* in the locale, which both spellings would satisfy. `es` ships "Tecno"/"Techno" and "Minimal"/"Minimalista" to this day. The fifth key in that family reuses one of them: `welcome:themeChooser.keepDefault` ("Keep Techno") is 「テクノのままにする」 |

The word for *tab* is 「タブ」, appended with no particle and no space: 「翻訳タブ」. Every
`strings:guide.topic*` key whose English ends in "Tab" follows that shape; `topicQuality` and
`topicActivity` have no "Tab" suffix in English and take none in Japanese either.

### The guide / sidebar group headings

`strings:guide.group*` and `sidebar:groups.*` name the same groupings, so they must agree — but
**the two sets are not the same size, and an earlier version of this section said they were.**
Five headings are shared; each side has one the other lacks.

| Heading | en | ja | Owed by |
| --- | --- | --- | --- |
| Setup | Setup | 「セットアップ」 | `sidebar:groups.project` |
| Translate | Translate | **「翻訳作業」** | `sidebar:groups.translate` — **not** 「翻訳」, see below |
| Review | Review | 「レビュー」 | `sidebar:groups.review` |
| Terminology | Terminology | 「用語」 | `sidebar:groups.content` |
| Maintenance | Maintenance | 「メンテナンス」 | `sidebar:groups.maintenance` |
| Translation Memory | Translation Memory | 「翻訳メモリ」 | **no sidebar group** — Translation Memory is the sidebar *item* `sidebar:translationMemory`, covered by its own surface row above. It is not unswept, though: in the **guide** rail it sits directly above its only child `strings:guide.topicTranslationMemory` 「翻訳メモリ」, an exact equality collision that is **licensed** because English writes the identical pair. See sweep 1 below |
| Page | Page | 「ページ」 | `sidebar:groups.page` had **no** `strings:guide` counterpart, so batch 4 decided it alone. Faithful to a heading English itself makes little of; its four children (環境設定・変更履歴・法的情報・Narnについて) are the workspace's static content pages. It does not collide with `strings:pagination.pageOfTotal` 「ページ：{{page}}/{{total}}」, which is a label:value row in the string table and differs as a string even though the two are painted at once |

See the *Review (the sidebar group)* row in `terminology/ja.md` for why the umbrella is レビュー
and not one of its four members' words.

### Why `groupTranslate` is 「翻訳作業」 — a latent collision, not a live one

**`strings:guide.group*` does not render in the sidebar at all.** Its six call sites are all in
`components/guide/guides-registry.ts` (`GUIDE_GROUPS[].titleKey`), painted by `GuideView.tsx:73`
into the **guide page's own left rail**. The sidebar's group heading is `sidebar:groups.*`, under
`useTranslation('sidebar')` at `Sidebar.tsx:197`/`:773` — a namespace batch 4 owns.
`Sidebar.tsx:132-175` is the `NAV_GROUPS` data literal and contains no strings whatsoever. An
earlier version of this section cited that range and claimed the two keys "render nested in the
sidebar"; **they never do.**

**The fix was still right, and the real mechanism is the one worth writing down.** The two
headings are **byte-identical in English** ("Translate"), and the surface-name rule binds
`sidebar:groups.translate` to copy whatever `strings:guide.groupTranslate` says. So a batch-2
value of 「翻訳」 would have been copied into the sidebar by batch 4, and **there** it would sit
directly above `strings:tabs.strings` 「翻訳」. The collision is **latent until batch 4**, mediated
by the verbatim-copy rule rather than by any call site batch 2 owns.

> **The generalisable lesson: a batch-2 key can seed a collision that only appears two batches
> later, on a surface it does not itself render on.** Checking your own key's call sites is not
> enough. Check the call sites of every key the copy rule binds to yours.

The tab was not the thing to change — batch 1 anchored it in prose at
`config:routing.categoriesConfiguredHint` 「カテゴリは翻訳タブで設定します。」 — so the *group* took
the distinct word. Every other locale keeps the pair apart too (en Translate/Translations,
ru Перевод/Переводы, de Übersetzen/Übersetzungen, tr Çeviri/Çeviriler).

### The two sweeps, run separately because they are two different rails

An earlier version ran one sweep, against the wrong surface, and concluded "only
`sidebar:groups.translate` was an equality collision". **That was false twice over**: it measured
`guide.group*` against sidebar tabs, which never meet; and on the rail where `guide.group*`
actually renders there **is** an equality collision, which the sweep missed.

**Sweep 1 — the guide rail** (`guide.group*` over its own `guide.topic*` children):

| Heading | Children | Verdict |
| --- | --- | --- |
| 「セットアップ」 | 「クイックセットアップ」 + 11 others | **prefix, licensed — English does the same** (Setup > Quick Setup) |
| 「翻訳作業」 | 翻訳タブ・比較タブ・振り分けタブ・アクティビティ・疑似テスト | clear |
| 「レビュー」 | AIレビュー・品質 | prefix, licensed — English does the same (Review > AI Review) |
| 「用語」 | 用語集タブ・カテゴリタブ | prefix, licensed — **but not because English mirrors it**, see below |
| 「メンテナンス」 | 孤立エントリタブ・バックアップタブ | clear |
| 「翻訳メモリ」 | 「翻訳メモリ」 — its **only** child | **exact equality, live today — licensed** |

**`guide.groupTranslationMemory` over `guide.topicTranslationMemory` is an equality collision and
stays.** English writes the identical pair ("Translation Memory" over "Translation Memory"), a
one-topic group named after its topic, and es/fr/ru/de/tr all render the two identically. Copying
that is faithfulness, not drift — the earlier table's "Owed by: nothing" cell is what hid it from
the sweep. Do not "fix" it.

**「用語」 over 用語集 stands, but the grounds are not "English mirrors it".** English's
*Terminology* and *Glossary* share no substring, so that premise fails precisely here. The real
ground is in `terminology/ja.md`'s *glossary term* row: 用語 and 用語集 are **one word family**,
with the head 集 ("collection") carrying the distinction — a 用語集 is literally a collection of
用語. That is how Japanese expresses this relationship, and it is why no second word is needed.

**Sweep 3 — the sidebar rail against the page title it opens** (batch 3). Batch 3 writes no
rail label at all, but every one of its page titles is on screen *beside* the whole sidebar
rail, which is the co-render test as the whole-rail rule states it. All five checked:

| Sidebar rail label (batch 2) | Page title batch 3 wrote | Verdict |
| --- | --- | --- |
| 「用語集」 `strings:tabs.glossary` | 「用語集」 `glossary:glossaries` | **exact equality — licensed**: English writes Glossary over Glossaries for the same surface, the Translation Memory case exactly |
| 「カテゴリ」 `strings:tabs.category` | 「カテゴリ」 `category:title` | **exact equality — licensed**: English's Category / Categories, number only |
| 「品質」 `strings:tabs.quality` | 「品質ダッシュボード」 `quality:title` | prefix, licensed — English does the same (Quality > Quality Dashboard), and this is why the tab label must **not** be copied onto the title |
| 「手動レビュー」 `strings:tabs` (review-manual) | 「レビューキュー」 `review:title` | clear — the one pair English deliberately keeps apart, and Japanese follows |
| 「原文AIレビュー」／「翻訳AIレビュー」 | the same two, `review:sourceAi.configTitle` / `review:translationAi.title` | exact equality — licensed, English is byte-identical in both homes |

**Sweep 3b — the review queue's own toolbar**, added in the batch-3 fix round because sweep 3
above checked the sidebar and missed a container. `ReviewTab.tsx` paints one toolbar holding the
segmented filter (`filterNeedsReview` 「要レビュー」, `filterFlagged` 「保留」) and, beside it, the
action row (`approve` 「承認」, `edit` 「編集」, `flag` 「保留にする」, `retranslate` 「再翻訳」,
`backTranslate` 「原文の言語に逆翻訳」, `viewAll` 「すべて表示」). With `flag` at 「保留にする」 no two
labels in that toolbar are equal, and the only pair sharing a root — 保留 / 保留にする — is the
state and the action that sets it, which is the relationship English's Flagged / Flag has too.
The review card below it adds `provenance` and `previousVersionMeta`, both now 中黒-separated.

**Sweep 2 — the sidebar rail** (`sidebar:groups.*`, batch 4, over `strings:tabs.*`, batch 2).
This is the sweep the table above was really describing, and **batch 4 has now run it against the
shipped file rather than against a prediction.** With `sidebar:groups.translate` at 「翻訳作業」 there is no
equality collision; 「レビュー」 over the three ～レビュー tabs and 「用語」 over 用語集 are the same
two licensed prefixes, on the same grounds. `groups.page` had no `guide` counterpart and was batch
4's alone. Do not re-open any of these.

**Sweep 4 — the whole rail as one container, all 31 labels at once** (batch 4). Sweep 2 compares a
heading with its own children, which is the narrow question. `Sidebar.tsx` paints **every** group and
**every** item into one scrolling column, and `SidebarGroup` is not a render condition — the project
groups render whenever `allowedTabs` is non-empty, whatever `view` is, so the Page group's items and
the project tabs are on screen together even while a workspace page is open. The full painted set:

| Block | Labels |
| --- | --- |
| ungrouped (top) | 「グローバル設定」「翻訳メモリ」「ガイド」「アカウント」 |
| 「セットアップ」 | 「設定」「データ」「共有」 |
| 「翻訳作業」 | 「翻訳」「比較」「振り分け」「アクティビティ」「ステージ詳細」 |
| 「レビュー」 | 「原文AIレビュー」「翻訳AIレビュー」「手動レビュー」「品質」 |
| 「用語」 | 「用語集」「カテゴリ」「テキスト装飾」 |
| 「メンテナンス」 | 「孤立エントリ」「バックアップ」 |
| 「ページ」 | 「環境設定」「変更履歴」「法的情報」「Narnについて」 |

**No two are equal** — 31 labels, 31 distinct values, verified by set comparison over the shipped
files rather than by eye.

**Nine substring relations exist, and only four of them are mirrored in English.** The first version
of this paragraph said there were four and that "in every case English has the same relation between
the same pair". Both were wrong, and the second was **already refuted forty lines above in this same
file**, where the 用語/用語集 sweep records that English's *Terminology* and *Glossary* share no
substring "so that premise fails precisely here". A discarded reason was rebuilt as a new section's
closing premise — the standing-claim-not-re-derived failure, committed inside the very batch that
quotes the rule. The table is now derived mechanically, not by hand:

| ja relation | English pair | Mirrored? |
| --- | --- | --- |
| 設定 ⊂ グローバル設定 | Config ⊂ Global Config | **yes** |
| 設定 ⊂ 環境設定 | Config ⊄ Settings | no |
| 翻訳 ⊂ 翻訳メモリ | Translations ⊄ Translation Memory | no |
| 翻訳 ⊂ 翻訳作業 | Translations ⊄ Translate | no |
| 翻訳 ⊂ 翻訳AIレビュー | Translations ⊄ Translation AI review | no |
| レビュー ⊂ 原文AIレビュー | Review ⊂ Source AI review | **yes** |
| レビュー ⊂ 翻訳AIレビュー | Review ⊂ Translation AI review | **yes** |
| レビュー ⊂ 手動レビュー | Review ⊂ Manual review | **yes** |
| 用語 ⊂ 用語集 | Terminology ⊄ Glossary | no |

**The English column is case-folded, and the number changes if it is not.** Four rows read "yes"
under case-insensitive comparison; a **strict** byte-for-byte substring test returns **one** — only
Config ⊂ Global Config — because English writes "Source AI **r**eview" / "Translation AI **r**eview" /
"Manual **r**eview" against a heading capitalised "Review". The normalisation is stated because this
whole section exists to correct figures that were wrong, and a figure whose value depends on an
unstated fold is the same defect wearing a smaller hat. It moves the conclusion **further** in its own
direction — English mirrors even less than the table shows — so nothing below depends on which number
you take.

**The test this replaces the old premise with, and its scope, which is the load-bearing part.**

> **Applies to a *proper substring* relation only.** For two labels that render **identically**, the
> test is the co-render one further down, unchanged — not this.

Within that scope: **each pair is a licensed heading-over-specialising-child or root-over-compound
relation.** The four mirrored pairs need no further argument. The five unmirrored ones each rest on
grounds recorded elsewhere in this file or in `terminology/ja.md`: 設定/環境設定 on the three-way 設定
hazard below (one 設定 family, distinguished by heads, exactly as English distinguishes Config /
Global Config / Settings); 用語/用語集 on the *glossary term* row's one-word-family argument, where
the head 集 carries the distinction; 翻訳/翻訳作業 on the round-2 rename that created the prefix
**deliberately**, to replace an equality; and 翻訳/翻訳メモリ and 翻訳/翻訳AIレビュー on the same
footing — 翻訳 is the app's root morpheme for the whole domain, so every compound built on it shares
it.

**Why the scope line is not pedantry.** This file uses *collapse* for two strings rendering the
**same**, and "a heading over its own child" read at equality would license `strings:guide.groupTranslate`
「翻訳」 sitting on top of `strings:tabs.strings` 「翻訳」 — the exact equality round 2 spent a rename
removing. A structural licence must never reach equality; equality keeps the co-render test.

**Two riders on the disjunction, both learned from this locale's own nine pairs.**

1. **"Root over compound" is morphology, not hierarchy, so it makes a pair *defensible*, not
   *settled*.** Only four of the nine are genuinely a heading over its own child (レビュー over its
   three, 用語 over 用語集). The other five are peers in different rail blocks — or inverted, with
   翻訳 the *child* and 翻訳作業 its heading — so the containment implies a hierarchy the rail does
   not have. That is precisely the Config/Settings hazard below. **When neither label is the other's
   group heading, the licence holds only if the distinguishing element is written down somewhere.**
   Japanese survives here because the 設定 hazard has its own section; a locale without one would
   ship the hazard silently.
2. **Compounding is not the only asymmetry — English's inflection accounts for three of the five.**
   The mechanism fits 用語/用語集 (Terminology/Glossary) and 設定/環境設定 (Config/Settings), where
   English reaches for a separate lexeme. It does **not** fit the three 翻訳 pairs: English compounds
   there perfectly well ("Translation Memory", "Translation AI review") and the mirror breaks because
   English marks **number and part of speech** — *Translations* vs *Translation…*, *Translations* vs
   *Translate* — where Japanese marks neither. State both causes, because a language told to look for
   compounding and finding inflection will conclude the rule does not apply to it.

**English is corroboration where it agrees; it is not the test.** A locale that compounds, or whose
source inflects, will always show more substring relations than English does, and reading that as
drift would force it to invent synonyms.

### The three-way 設定 hazard, and why *Settings* is 「環境設定」

Batch 2 wrote a warning here without a rendering; this is the resolution, taken against the rail
above rather than against the pair that motivated it. **Three different English surfaces land on 設定
in Japanese and all three are painted simultaneously**: `strings:tabs.config` *Config* 「設定」,
`sidebar:globalConfig` / `config:globalConfigTitle` *Global Config* 「グローバル設定」, and
`sidebar:settings` / `settings:title` *Settings*. A fourth is one click away in the same rail's
target page — `config:workspaceSettingsTitle` *Workspace Settings* 「ワークスペース設定」.

The bare 「設定」 was therefore unavailable for *Settings*, and *アプリ設定*／*表示設定* were both
rejected as narrower than the page: `SettingsView.tsx` holds the UI **language** picker as well as
appearance, so a display-only word understates it. **「環境設定」 is the established Japanese for
exactly this class** — device-local user preferences — and it keeps the 設定 root, so the four read
as one family distinguished by their heads, which is what English's own Config / Global Config /
Workspace Settings / Settings do. The equality between `sidebar:settings` and `settings:title` is
required, not a collision: English is byte-identical in both, and `SettingsView.tsx:52` paints the
`<h1>` beside the rail item, the `sidebar:globalConfig` case exactly.

**`config:fullReplaceOrphanNotice` says *Relink tab* in English. There is no such tab** —
it is the known stale English name for Orphans, and Japanese ships the Orphans rendering.

**Three observations the whole-language sweep recorded here so a later sweep does not re-open
them.** Each was re-checked at the code rather than relayed.

- **「設定を開く」 uses the bare 設定 the hazard above reserves, and it stays.**
  `colorText:assistant.openSettings` and `stage-details:chatOpenSettings` ship 「設定を開く」 while
  the rail's `strings:tabs.config` 「設定」 is painted beside them, so the link *could* read as
  "open the Config tab". The handler is `AssistantPanel.tsx:353` — `setSettingsOpen(true)`, the
  assistant's own settings popover, whose sibling `colorText:assistant.settings` is
  「アシスタントの設定」. **Left as is:** English is the bare *Open settings*, and expanding it to
  アシスタントの設定を開く would import a word the key's own English lacks — the rubric-8 defect,
  which outranks a hazard that resolves itself the moment the popover opens.
- **`vault:remove` has no call site.** `VaultEditorDialog.tsx` renders `delete`, `undoRemove` and
  `discard`; no `t('remove')` bound to the `vault` namespace exists anywhere in
  `packages/frontend/src`. So the *Remove* leg of the same-English/different-rendering group the
  pre-flight reports (`vault:remove` 「削除」 against `collab:sharing.remove` 「メンバーを外す」) is
  **unreachable**, and the split is unfalsifiable rather than wrong. This is an English-corpus
  observation affecting all seven locales, not a `ja` defect.
- **`config:tm.policyTitle` and `config:tm.browserTitle` are both 「翻訳メモリ」 in one panel** —
  and English writes "Translation Memory" for both, so this is faithfulness, licensed by referent
  identity (one referent, named twice). Recorded because it is an equality inside a **single
  container**, which is the shape every other rule here treats as the dangerous one.

**`logs:action.openQuality` says *Open quality settings*. There are no quality settings** — the
second instance of the identical class, and the one round 5 got wrong. The handler is
`registry.ts:124` → `actions.ts:10` `setActiveTab('quality')`, i.e. the read-only Quality
dashboard, so the key ships **「品質ダッシュボードを開く」**, copying the surface's existing name
`quality:title` 「品質ダッシュボード」. Round 5 shipped the faithful-to-the-defect *品質設定を開く* and
filed the finding a second time; `english-review-notes.md:113` had already answered it — *"render
what the control actually opens"* — three minutes before the batch ended, so the timing was
excusable and the string was not. **Re-read `english-review-notes.md` at HEAD before a fix round,
not only at the start of a batch**: in a wave running three languages at once, another locale's
escalation can land a binding row mid-batch.

## The six register and typography sweeps

Run all six over every batch before handing it to review. All six were clean on batches 1, 2
and 3, as was the seventh below. **After the fix round, batch 3 has exactly one space in 366
values** — `glossary:sourceLink` "GI: MW Glossary / Common Translation Sheet", class (b), a
proper name carried by `IDENTICAL_ALLOWLIST` and kept byte-identical to English on purpose. It
had two: `review:provenance` also shipped English's spaced ASCII `·` verbatim, and the fix round
replaced it with 中黒 (see the separator bullet above). Its only half-width symbols against
Japanese are the ratio `/` — **eight** keys (`glossary:toastGeneratedPartial`,
`toastGenerateVaultLocked`, `generateProgressLabel`, `review:position`,
`translationAi.position`, `sourceAi.findingPosition`, `sourceAi.runSummary`,
`category:genProgressCount`); a ninth `/` exists but is not the ratio operator, being inside
`glossary:sourceLink`'s product name — and the `+` in `glossary:importMoreItems`
「+{{count}}語は表示していません」, both licensed above. Sweep 6 reports three hits
(`category:descriptionSaved`, `category:descriptionSaveFailed`, `glossary:matchNoResults`) and
all three are false positives: they are short *sentences* whose English carries the period, not
control labels.

**Batch 5 runs all seven clean**, with two hits and both accounted for. Sweep 6 (a 。 on a short
value) reports `logs:judge.suggestionDiscarded` 「提案を却下しました。」 — a false positive of the
same class as batch 3's three: it is a **log sentence** whose English ends in a full stop, and the
narration section above makes 。 mandatory there. Sweep 7 (spaces) reports the single ⚠️ layout
space in `system:countdown.message`, class (a) and recorded in the punctuation section. The other
five are empty: no あなた, no honorific escalation, no ASCII `,.():?!` between Japanese characters,
no full-width Latin or digits, and no three-dot ellipsis — the batch has exactly **two** ellipses,
`logs:translation.start` 「エントリを{{language}}に翻訳中…」 and `console:searchPlaceholder`
「ログを検索…」, both U+2026 and both mirroring an ellipsis the English source has.
**Sweep 6 has now cried wolf in two batches out of two in which `logs`-shaped copy exists**; it is
kept because it is the only thing standing between this locale and a full stop on a button, but
read its hits against the narration rule before treating one as a defect.

**Batch 6 runs all seven with one hit, and it is sweep 3's first false positive in six batches.**
Sweeps 1, 2, 4, 5, 6 and 7 are empty over the 282 values: no あなた, no honorific escalation, no
full-width Latin or digits, no three-dot ellipsis, no full stop on a short label, and **no space at
all** — the second batch after batch 4 with an empty exception list. Sweep 3 (ASCII punctuation
between two Japanese characters) reports `backup:createDescription` and `backup:restoreDescription`,
and both are the **literal file extension `.zip`** sitting inside a Japanese sentence
(「検証可能な.zipアーカイブ」, 「バックアップの.zipをアップロード」). A file extension is a literal
token, not sentence punctuation; *ドットzip* and a full-width *．zip* are both wrong, and
`restoreSelectFile` 「.zipファイルの選択」 carries the same token at the head of a value where the
sweep cannot see it. **Add it to the sweep's known-false-positive list rather than to the string.**
The batch's fifteen ellipses are all U+2026 and all mirror an ellipsis the English source has —
checked by comparing the two files key by key, not by eye, and the parity is exact in both
directions. Its two half-width symbols against Japanese are the ratio `/` in
`stage-details:runProgress` 「翻訳中：{{completed}}/{{total}}」 (the ratio-operator role batch 1
settled) and the `#` of the literal hex formats in `colorText:invalidHex`.

| Sweep | Japanese instance | Why |
| --- | --- | --- |
| the pronoun the guide bans | `あなた` | Japanese software does not address the user with a pronoun |
| the register the guide bans | `いただけますでしょうか`, `ください[ま]せ`, `お願いいたします` | 尊敬語／謙譲語 escalation |
| ASCII punctuation inside Japanese text | `,` `.` `(` `)` `:` `?` `!` between two Japanese characters | must be 、。（）：？！ |
| full-width Latin or digits | `[Ａ-Ｚａ-ｚ０-９]` | Latin and numerals stay half-width |
| three-dot ellipsis | `...` | must be the single character `…` |
| a 。 on a control label | a value that is a bare label and ends in `。` | 「保存」 takes no full stop |

A seventh, Japanese-specific check is worth running with them: **a space between two
Japanese characters, or between a Japanese character and a Latin run** — the house style
inserts none.
