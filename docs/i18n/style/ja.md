# Style guide — Japanese (ja)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/ja.md`. This file settles register, casing, punctuation, length and
placeholder handling.

**Every key cited below is a key this locale has actually translated** — `config` (batch 1)
and `strings` (batch 2), and nothing else. That constraint is deliberate and binds later
batches too: **do not prescribe a rendering for a key in a
namespace you have not translated.** The original scaffold of this file illustrated nine
rules with `vault:*`, `sidebar:*`, `strings:*`, `common:*`, `logs:*` and `category:*`
examples; nothing guards a rendering quoted here, so each of those was a guess that the
batch owning the key would have inherited as a settled decision. They have been replaced
with shipped `config` equivalents. Naming a key as a *class anchor* (the budget table below),
or as the second home of a surface name, is fine — that is a pointer, not a rendering.

**Quoting convention, so every claim here is checkable.** 「…」 marks a span quoted
**verbatim from a shipped value** — never truncated with an internal `…`, so it can be
verified by substring search against `locales/ja/`. A rejected candidate or an English source
phrase is written in plain text or *italics*, never in 「…」. Nothing guards this file, so the
convention is what makes a hand check cheap: batch 1's review found five defects among its
53 key-naming spans, including one key quoted two incompatible ways in the same file.

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
| Placeholder inside a control | ～を選択／～を入力 + 「…」, no noun for the control itself | `config:enableModulePlaceholder` 「有効にするモジュールを選択…」 |
| Progress / status text | ～中 or ～しました — a state, never a command. The **ellipsis is English's to give**, not the shape's: add 「…」 only where the source has one | `config:duplicating` 「複製中…」 and `config:autoSaveSaved` 「保存しました」 (English has the ellipsis); `strings:row.translating` 「翻訳中」 and `strings:runs.statusQueued` 「待機中」 (English has none) |
| Description / help / toast | full ですます sentence ending in 。 | `config:maxBackupsDescription` |
| Inline fragment in a summary row | noun + なし / 指定なし, no verb, no 。 | `config:routing.anySource` 「ソース指定なし」, `config:routing.noModule` 「モジュールなし」 |

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

Latin-script material inside a Japanese string (`API`, `CSV`, `AI`, provider and model ids)
keeps its English casing and stays **half-width**. Never use full-width Latin letters or
full-width digits.

## Punctuation and spacing

- Use full-width Japanese punctuation: 、 。 （ ） 「 」 ： ？ ！ — never their half-width
  ASCII equivalents inside Japanese text.
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
  affordance: `config:importing` ("Importing…") is 「インポート中…」.
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
  Where English's own separator is 「·」, 中黒 is also the faithful mapping of it:
  `strings:runs.judgeAllFindingsCount` 「指摘：{{total}}・未処理の提案：{{withSuggestions}}」.
- Long-vowel marks follow the modern convention **for -er / -or / -ar loans**:
  「サーバー」 and 「プロバイダー」, both shipped, and likewise *yūzā* / *forudā* — trailing ー, not the older
  truncated forms — so `config:models.colProcessor` is 「プロセッサー」 and
  `config:models.colParameters` is 「パラメーター」 even though both are table column headers
  where a shorter form is tempting. **Loans ending in -y / -ry take no mark**: 「エントリ」
  「カテゴリ」「メモリ」「ポリシー」 (a -cy loan, which lands on シー rather than a bare リ).
  The rejected long forms — *entorī*, *toransurēshon memori* — are named in romaji
  deliberately: a rejected candidate never goes in 「…」, so every 「…」 span in this file
  stays verifiable against the shipped file.
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

Counted in **rendered Japanese characters** — a full-width character is one, and a
`{{count}}`-shaped placeholder counts as the digits it will actually show (assume 1–3), not
as its source length. That is what the container has to fit.

| Class | Anchor key | Kind | Budget | Basis |
| --- | --- | --- | --- | --- |
| Sidebar item — **including every `strings:tabs.*` label** | `sidebar:globalConfig`, `sidebar:legal`, `strings:tabs.backup` | **hard** — fixed `16rem`, `truncate` | **13** | **derived from the component**, batch 2: `SIDEBAR_WIDTH` 16rem = 256px, less 1px `border-r`, less `SidebarGroup`'s `p-2` (16px), less `SidebarMenuButton`'s `p-2` (16px), less the `size-4` icon (16px), less `gap-2` (8px) = **199px**. At `text-sm` (14px) a full-width CJK glyph advances 1em = 14px, so 199 ÷ 14 = 14.2 glyphs fit and 13 leaves one glyph of headroom. Half-width Latin inside a label counts ~0.5 |
| In-panel sub-tab label | `config:routing.tabRules` | soft | **12** | **measured** on batch 1's three routing sub-tabs: `config:routing.tabRules` 「ルール（{{count}}）」 renders at 7, `config:routing.tabTemplates` 「テンプレート（{{count}}）」 at 9, `config:routing.tabImportExport` 「インポート／エクスポート」 at 12. They sit in a scrolling row inside the routing panel — the app's **only** tab-shaped control that is not a sidebar item, and the reason this row exists separately from the hard sidebar row above |
| Table column header | `strings:columns.config` | soft | **8** | **re-measured** across both batches: batch 1's longest `config:models.col*` header was 6, but batch 2's `strings:runs.detailsLanguagesColumn` 「ターゲット言語」 is 7 — a term rule (*target language*) fixes it and outranks the budget — so the figure rises to 8. The class anchor `strings:columns.config` itself is 「状態」 at 2 |
| Filter label | `strings:filters.needsReview` | soft | **14** | **measured** on batch 2's twenty-four `strings:filters.*` plus the Compare filter row: the longest are 「新規（前回のインポート分）」 at 13 and 「新規フラグを解除（{{count}}）」 at 13 with a three-digit count, then 「プレースホルダーの不一致」 at 12. The anchor 「要レビュー」 is 4. The provisional 8 was badly wrong — it was reasoned from the anchor rather than from the class |
| Bulk-bar control | `strings:bulk.approveSelected` | soft | **17** | **measured** on batch 2's `strings:bulk.*`: the longest is 「絞り込まれた{{count}}行すべてを選択」 at 16 with a three-digit count, then 「選択範囲からカテゴリを生成」 at 13. The anchor 「承認して翻訳メモリに追加」 is 12 |

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, and never distort a term to
hit the number. A term rule outranks the budget: `config:models.colProcessor` is
「プロセッサー」 and not the shorter 「プロセッサ」 because the long-vowel rule above says so.

**No provisional row is left.** Three rows are measured from shipped Japanese, one is derived
from the component's own CSS, and one (the in-panel sub-tab) was measured in batch 1. Batch 4
confirms the sidebar row against `sidebar:*`; the whole-language sweep confirms all five.

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

Japanese runs ~0.55x English over batches 1 and 2 alike (`strings`: 5,480 Japanese characters
against 9,900 English, aggregate **0.55**, median **0.56**, 90th percentile **0.83**, single
maximum **1.50** at `strings:filters.matchAny` 「または」 — a two-character English source, which
is the ratio measuring the wrong thing exactly as the runbook says it does). Length pressure in
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
| glossary term | **語** | not yet shipped — batch 3. Terms and words take 語, never 件. |
| routing rule | **件** | `config:routing.ruleCount_other` 「ルール{{count}}件」 |
| run, retry, attempt, request | **回** | an occurrence of an action, never 件 |
| person (member, collaborator) | **人** | not yet shipped — batch 4 |
| discrete object (model, module, instance, backup, template, glossary file) | **個** | the generic object counter, for a thing that is a countable object rather than a record |
| character / byte / token | **文字 / バイト / トークン** | `config:routing.templateMeta` 「最大文字数：{{maxLength}}」 — the unit *is* the counter |
| category (a content label) | **件** | added batch 2: `strings:bulk.removeCategoryApply_other` 「カテゴリ{{count}}件を削除」 |
| table row — where English itself says *row* | **行** | added batch 2: `strings:bulk.rowsSelected_other` 「{{count}}行を選択中」, `strings:bulk.selectAllFiltered`. Same counter as a CSV row and for the same reason: the object is a row, not a content unit. Where the same selection is described without the word *row*, it is entries — `strings:compare.selectedCount` 「{{count}}件を選択中」 |
| chat turn | **ターン** | added batch 2: `strings:runs.chatTurns_other` 「{{count}}ターン」 — the unit *is* the counter, like 文字／バイト／トークン |
| LQA issue, finding | **件** | added batch 2: `strings:row.lqaIssues_other` 「LQAの問題{{count}}件」 — a verdict is a record |
| a genuinely mixed or unknown selection | **件** | `config:routing.nSelected` 「{{count}}件を選択中」 — one key rendering over both categories and tones. Batch 2 **narrows this row**: the category half is no longer a fallback at all, because *category* has its own row above and it is 件. The licence now rests on the tone half alone, which batch 3 settles; if tones also take 件, this row stops being a fallback and becomes an ordinary coincidence. A key that counts one known class must still take that class's counter. |

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
**`_zero` is the one non-category suffix you keep.** `strings:bulk.removeCategoryApply_zero`
is Japanese's only `_zero` key, and it stays: i18next makes an explicit `key_zero` lookup at
count 0 in every locale whatever its categories, so dropping it would render
「カテゴリ0件を削除」 where English renders the countless "Remove categories".

### Non-`count` numeric tokens — the one place Japanese still has to be careful

Japanese has no numeral agreement, so a counter after a number is grammatical at every
value and none of these can be *wrong* in the way they are in an inflecting language. What
they can be is **unreadable at some values**, and there is a second, mechanical reason to
avoid them: `scripts/i18n-preflight.mjs` matches `{{token}}` immediately followed by any
Han/Hiragana/Katakana character, so a counter written straight after a non-`count` token is
reported as an uncleared candidate on every run.

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
  「実行IDをコピー（{{runId}}）」. The draft 「実行ID{{runId}}をコピー」 put を straight against the
  token and would have been reported on every pre-flight run.

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
  要レビュー over the sentence-case filter and the deliberately lowercase badge; カテゴリを削除
  over *Remove category* / *Remove categories*; AIレビュー over *AI Review* / *AI review*;
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
  **The licence has one hard boundary, and batch 2 crossed it once.** A collapse is licensed
  only where the two keys **cannot co-render**. *Translate* was in the list above until review
  found that `strings:guide.groupTranslate` and `strings:tabs.strings` render nested, one inside
  the other, in the sidebar — see the group-heading section below. Before licensing a collapse,
  check the call sites for containment, not just for "different screens": number and
  part-of-speech carry no information into Japanese, but a group/member distinction does, and it
  is visible at exactly the moment the two are stacked.

## Surface names settled so far — repeat these verbatim

A surface's name is written out two or three times, in different namespaces, and the two
keys are never on screen together. These are the renderings batches 1 and 2 fixed; a later batch
that names the same surface **copies them exactly** and does not re-decide. **Batch 2 owns
`strings:tabs.*`, so most rows below are now anchored on a shipped tab label rather than on
prose.** Those labels render as sidebar menu items, not in a horizontal bar — see the hard
budget row above — so every one of them is also subject to the 13-glyph truncation limit.

| Surface | Rendering | Fixed by | Also owed by |
| --- | --- | --- | --- |
| Global Config | 「グローバル設定」 | `config:globalConfigTitle` | `sidebar:globalConfig` — English is word-for-word identical in both, so Japanese must be too |
| Translation Memory | 「翻訳メモリ」 | `config:tm.policyTitle`, `config:tm.browserTitle` | `sidebar:translationMemory`, `strings:guide.groupTranslationMemory`, `strings:guide.topicTranslationMemory` (both shipped batch 2) |
| Translations (tab) | 「翻訳」 | `strings:tabs.strings`; named in prose by `config:routing.categoriesConfiguredHint` 「カテゴリは翻訳タブで設定します。」 | `strings:guide.topicMultiLanguage` 「翻訳タブ」 (shipped batch 2) |
| Compare (tab) | 「比較」 | `strings:tabs.compare`; named in prose by `config:routing.tonesHint` 「トーンは比較タブでエントリごとに設定します。」 | `strings:guide.topicCompare` 「比較タブ」 (shipped batch 2) |
| Backup (tab) | 「バックアップ」 | `strings:tabs.backup`; named in prose by `config:importSnapshotNote` 「バックアップタブから復元できます。」 | `strings:guide.topicBackup` 「バックアップタブ」 (shipped batch 2), `backup:*` titles |
| Orphans (tab) | 「孤立エントリ」 | `strings:tabs.orphans`; named in prose by `config:fullReplaceOrphanNotice` 「孤立エントリタブで解決してください。」 | `strings:guide.topicOrphans` 「孤立エントリタブ」 (shipped batch 2), `orphans:title` |
| Config (tab) | 「設定」 | `strings:tabs.config` | `strings:guide.topicConfig` 「設定タブ」 (shipped batch 2). **Batch 4 must not reuse the bare 「設定」 for the app-wide *Settings* surface** — グローバル設定 already contains it and this tab now holds it; pick a distinguishing word there |
| Data (tab) | 「データ」 | `strings:tabs.data` | — |
| Routing (tab) | 「振り分け」 | `strings:tabs.routing` | `strings:guide.topicRouting` 「振り分けタブ」 (shipped batch 2). The *routing rule* term is 振り分けルール (`config:routing.title`); the tab is the bare root |
| Source AI review | 「原文AIレビュー」 | `strings:tabs` (review-source-ai) | `review:sourceAi.configTitle`. Built on batch 1's 原文レビュー (*source review*) plus AI |
| Translation AI review | 「翻訳AIレビュー」 | `strings:tabs` (review-translation-ai) | `review:translationAi.title` |
| Manual review | 「手動レビュー」 | `strings:tabs` (review-manual) | `review:title` is a **different English string** ("Review queue") and takes its own rendering — do not copy this one onto it |
| Quality | 「品質」 | `strings:tabs.quality` | `strings:guide.topicQuality` 「品質」 (shipped batch 2). **`quality:title` is a different English string** — "Quality Dashboard", not "Quality" — and takes **「品質ダッシュボード」**, matching `strings:tabPlaceholder.quality` in this same batch. Keep 品質 as the root so the tab and the page title read as one surface; do **not** copy the bare 「品質」 onto it |
| Glossary (tab) | 「用語集」 | `strings:tabs.glossary` | `strings:guide.topicGlossary` 「用語集タブ」 (shipped batch 2), `glossary:*` |
| Category (tab) | 「カテゴリ」 | `strings:tabs.category` | `strings:guide.topicCategory` 「カテゴリタブ」 (shipped batch 2), `category:*`. English's singular tab / plural page title carries no information into Japanese |
| Activity | 「アクティビティ」 | `strings:tabs.runs` | `strings:guide.topicActivity` 「アクティビティ」 (shipped batch 2). The **page title expands deliberately**: `strings:runs.title` is 「翻訳アクティビティ」. Do not shorten it to match and do not invent a third wording |
| Sharing | 「共有」 | `strings:tabs.sharing` | `collab:sharing.pageTitle` |
| Stage details | 「ステージ詳細」 | `strings:tabs` (stage-details) | `stage-details:title` |
| Text Styler | 「テキスト装飾」 | `strings:tabs` (color-text) | `colorText:title`, `sidebar:colorText` |
| AI Review (guide topic) | 「AIレビュー」 | `strings:guide.topicAiReview` | the *AI review* term itself — `strings:runs.judgeBadge` |
| Pseudo Test | 「疑似テスト」 | `config:pseudoTestHelpAria` | `strings:guide.topicPseudoTest` 「疑似テスト」 (shipped batch 2) |
| Credential Vault | 「認証情報の保管庫」 | `strings:guide.topicVault` | `vault:statusLabel`. The short form is 「保管庫」 — see the *credential vault* row in `terminology/ja.md`, which checked all four frames |

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
| Translation Memory | Translation Memory | 「翻訳メモリ」 | **nothing** — there is no such sidebar group; Translation Memory is the sidebar *item* `sidebar:translationMemory`, covered by its own surface row above |
| Page | Page | — | `sidebar:groups.page` has **no** `strings:guide` counterpart; batch 4 decides it alone |

See the *Review (the sidebar group)* row in `terminology/ja.md` for why the umbrella is レビュー
and not one of its four members' words.

**A group heading and the tabs nested under it DO co-render, so the collapse licence does not
reach them.** `components/layout/Sidebar.tsx:132-175` nests each group's tabs directly under its
heading, so the two keys are on screen simultaneously — one inside the other — which is exactly
the condition the surface-name rule ("the two keys are never on screen at the same moment")
assumes away. Batch 2 shipped `strings:guide.groupTranslate` as 「翻訳」 and that put the heading
「翻訳」 directly above its first child `strings:tabs.strings` 「翻訳」. **The tab is not the thing to
change** — batch 1 anchored it in prose at `config:routing.categoriesConfiguredHint`
「カテゴリは翻訳タブで設定します。」 — so the *group* took the distinct word, 「翻訳作業」. Every other
locale keeps the pair apart too (en Translate/Translations, ru Перевод/Переводы,
de Übersetzen/Übersetzungen, tr Çeviri/Çeviriler).

**All six groups were then checked against their own children, not just the one that failed.**
Only `groups.translate` was an equality collision. Two are prefix relationships and both are
**licensed**: 「レビュー」 over 原文AIレビュー／翻訳AIレビュー／手動レビュー, and 「用語」 over 用語集 —
in each case the heading is the general word and the child specialises it, which is the same
group/member relationship English has (Review > Source AI review; Terminology > Glossary) and is
how Japanese ordinarily expresses it. 「セットアップ」 and 「メンテナンス」 share nothing with their
children. Do not re-open these two when batch 4 writes `sidebar:groups.*`.

**`config:fullReplaceOrphanNotice` says *Relink tab* in English. There is no such tab** —
it is the known stale English name for Orphans, and Japanese ships the Orphans rendering.

## The six register and typography sweeps

Run all six over every batch before handing it to review. All six were clean on batch 1 and on
batch 2, as was the seventh below — batch 2's only spaces are the ten recorded exceptions in the
punctuation section, and its only half-width symbols against Japanese are `+`, `$` and the ratio
`/`, all licensed above.

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
