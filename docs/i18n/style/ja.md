# Style guide — Japanese (ja)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/ja.md`. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**ですます体 (polite non-honorific).** Sentences and messages end in です / ます:
`vault:createDescription` becomes "…セッションごとに、このパスワードが必要です。" Do not
escalate into 尊敬語 or 謙譲語 — "ご確認いただけますでしょうか" is the register of a
customer-support email, not of a tool the user runs themselves. Do not drop into である体
either.

**Controls and labels use 体言止め — the noun form, with no verb ending.**
`sidebar:create` is 「作成」, not 「作成します」; `sidebar:cancel` is 「キャンセル」;
`strings:bulk.clearSelection` is 「選択を解除」. This is the single most visible marker of a
properly localized Japanese UI.

**Never write あなた.** Japanese software does not address the user with a pronoun.
`vault:unlockDescription` ("Enter your password…") drops it entirely:
"パスワードを入力してください。"

## Control shapes — decided once, in batch 1, and binding on every later batch

English writes the same words for a title, a button, a column header and a placeholder;
Japanese does not. Resolve the control **before** writing the string.

| Control | Shape | Batch-1 example |
| --- | --- | --- |
| Page / section / dialog title | bare noun phrase (体言止め), no verb, no 。 | `config:reviewProgress` 「レビューの進捗」, `config:models.pickTitle` 「モデルの選択」 |
| Button | 〈object〉を〈verb-stem〉 — an action phrase that still ends on the verb stem, never ～します | `config:duplicateProject` 「プロジェクトを複製」, `config:instances.createButton` 「インスタンスを作成」 |
| Confirm-dialog title | **same as the button it confirms** | `config:deleteProject` and `config:confirmDeleteTitle` are both 「プロジェクトを削除」, because their English is identical too. Where English differs, follow English. |
| Table column header | bare noun, shortest defensible form | `config:models.colConfidence` 「信頼度」, `config:models.colContext` 「コンテキスト」 |
| Select option / value label | bare noun or 〈noun〉ごと, never a sentence | `config:module.batchByLanguage` 「言語ごと」, `config:lqa.severityBlocking` 「ブロッキング」 |
| Placeholder inside a control | ～を選択／～を入力 + 「…」, no noun for the control itself | `config:enableModulePlaceholder` 「有効にするモジュールを選択…」 |
| Progress / status text | ～中… or ～しました — a state, never a command | `config:duplicating` 「複製中…」, `config:autoSaveSaved` 「保存しました」 |
| Description / help / toast | full ですます sentence ending in 。 | `config:maxBackupsDescription` |
| Inline fragment in a summary row | noun + なし / 指定なし, no verb, no 。 | `config:routing.anySource` 「ソース指定なし」, `config:routing.noModule` 「モジュールなし」 |

**The trigger label and the dialog title of the same picker are different controls even
when English is byte-identical.** `config:models.select` (the closed combobox's own label)
is 「モデルを選択」 and `config:models.pickTitle` (the dialog it opens) is 「モデルの選択」.
This is the one same-English/different-rendering group in batch 1 and it is deliberate.

## Casing

Japanese has no letter case, so the English sentence-case / Title Case / uppercase
distinctions have nothing to map onto. `english-review-notes.md` records that the uppercase
table header `strings:columns.config` ("STATUS") shouts for a layout reason and that a
language without case should simply translate it — 「ステータス」.

Latin-script material inside a Japanese string (`API`, `CSV`, `AI`, provider and model ids)
keeps its English casing and stays **half-width**. Never use full-width Latin letters or
full-width digits.

## Punctuation and spacing

- Use full-width Japanese punctuation: 、 。 （ ） 「 」 ： ？ ！ — never their half-width
  ASCII equivalents inside Japanese text.
- Quoting a value uses 「…」. Where English has `“{{category}}”`
  (`category:deleteConfirmBody_one`), Japanese writes 「{{category}}」.
- **No space between Japanese characters, and no space inserted around Latin runs
  either.** Write 「{{module}}モジュール」, not 「{{module}} モジュール」. This matches the
  house style of the major Japanese platform localizations and keeps line lengths
  predictable.
- **A label and its value are joined by 「：」, never by a space** — that is the shape that
  makes the rule above hold everywhere. `config:health.medianLatency` is 「p50遅延：{{latency}}」,
  `config:models.gpuPlacement` is 「GPU：{{pct}}%」, `config:lqa.lengthLimitValue` is
  「文字数：{{chars}}／バイト数：{{bytes}}」. Use the full-width 「／」 to separate two such
  pairs, not a spaced ASCII slash.
- **Three deliberate space exceptions in batch 1**, and no others: the space before the
  arrow in `config:pseudoTestHelpLink` 「…読む →」 and the spaces around the em-dash pair in
  `config:routing.selectPlaceholder` 「— 選択 —」 are symbol layout copied from English, not
  word spacing; and `config:lqa.forbiddenPlaceholder` 「用語1, 用語2」 keeps a **half-width
  comma and space** because that string is an example of what the user types into a
  comma-separated field — 、 there would teach the wrong separator.
- Ellipsis is the single character `…` (U+2026) wherever the English source has it, as a UI
  affordance: `common:loading` ("Loading…") is 「読み込み中…」.
- Use 中黒 「・」 to join loanword compounds (「アクセス・トークン」) only where the compound
  is genuinely ambiguous without it; otherwise run them together.
- Long-vowel marks follow the modern convention **for -er / -or / -ar loans**:
  「サーバー」「ユーザー」「フォルダー」「プロバイダー」 with the trailing ー, not the older
  truncated forms — so `config:models.colProcessor` is 「プロセッサー」 and
  `config:models.colParameters` is 「パラメーター」 even though both are table column headers
  where a shorter form is tempting. **Loans ending in -y / -ry take no mark**: 「エントリ」
  「カテゴリ」「メモリ」「ポリシー」 (a -cy loan, which lands on シー rather than a bare リ).
  Settled in batch 1 because *entry* and *category* are the two most repeated nouns in the
  app, and alternating between 「エントリ」 and 「エントリー」 across six batches would be
  visible on almost every screen.

## Numbers and dates

Half-width Arabic numerals. Comma thousands, period decimal: `1,234.56`. No space before
`%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string, and no era conversion should be attempted by hand.

## Length discipline

Japanese usually runs **shorter** than English — roughly 0.5–0.7× the character count —
so the chrome surfaces are rarely the constraint they are elsewhere. The real risk runs the
other way: a katakana transliteration that is _longer_ than the English it replaces.
「トランスレーションメモリ」 is twelve characters where 「翻訳メモリ」 is five and reads
better.

**Prefer the kanji compound over the katakana loan** whenever both are idiomatic, and in
the space-constrained surfaces — sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`), bulk-bar buttons (`strings:bulk.approveSelected`) — treat
the English character count as the ceiling rather than a target.

Japanese wraps at almost any character, so long body text is not a layout hazard.

The renderings used as examples above are illustrations of the length problem, not
decisions about wording. `terminology.md` defines every domain term, including the surface
names and _translation memory_; `terminology/ja.md` holds the rendering. Decide the
rendering on first use, write its row there, and then follow it here.

### The five per-class budgets — absolute character counts, never a multiple of English

Counted in **Japanese characters** (a full-width character is one), because that is what
the container has to fit. Four of the five are **provisional**: their anchor keys live in
namespaces batch 1 did not translate, so they were reasoned from the container rather than
measured from shipped Japanese. **The whole-language sweep replaces them with measured
numbers — that is a deliverable, not a note.**

| Class | Anchor key | Kind | Budget | Basis |
| --- | --- | --- | --- | --- |
| Sidebar item | `sidebar:globalConfig`, `sidebar:legal` | **hard** — fixed `16rem`, `truncate` | **10 chars** | provisional: 16rem = 256px, less the icon, gap and both paddings, leaves roughly 170px; a full-width character at the sidebar's font size is ~14px |
| Tab label | `strings:tabs.backup` | soft | **8 chars** | provisional |
| Table column header | `strings:columns.config` | soft | **7 chars** | **measured** on batch 1's twelve `config:models.col*` headers: the longest shipped is 「コンテキスト」 / 「プロセッサー」 / 「パラメーター」 at 6, so 7 leaves one character of headroom |
| Filter label | `strings:filters.needsReview` | soft | **8 chars** | provisional |
| Bulk-bar control | `strings:bulk.approveSelected` | soft | **12 chars** | provisional |

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, and never distort a term to
hit the number. A term rule outranks the budget: `config:models.colProcessor` is
「プロセッサー」 and not the shorter 「プロセッサ」 because the long-vowel rule above says so.

Japanese runs ~0.55x English over batch 1 (7,121 ja characters against 13,015 en over the
368 shared keys), so no key in this namespace came near its class budget and the guard's own
2.5x ratio cap is not a live risk for this language in either direction.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Japanese is comfortable here: nouns do not inflect, and a particle can follow a token
safely because it does not agree with anything. The closing clause of
`logs:translation.failedModuleDisabled` ("…the {{module}} module is turned off"; the full
string carries three tokens) becomes 「{{module}}モジュールが無効になっています。」

**Counted nouns take a counter and no plural marking.** `category:countLabel_other`
("{{count}} entries") is 「{{count}}件」 — pick the counter that fits the object (件 for
records and entries, 個 for generic items, 言語 for languages) and use the same counter for
the same object everywhere.

**Japanese has exactly one plural category: `other`.** A plural family therefore supplies
`_other` and nothing else — never a `_one` copied across from English. A `_one` key can
never resolve here, and the key-parity guard rejects any suffix that is not a plural
category of the language, so copying English's pair is a red build, not a harmless
duplicate. Batch 1 collapsed six `config` families this way and landed at 368 keys against
English's 374.

### Non-`count` numeric tokens — the one place Japanese still has to be careful

Japanese has no numeral agreement, so a counter after a number is grammatical at every
value and none of these can be *wrong* in the way they are in an inflecting language. What
they can be is **unreadable at some values**, and there is a second, mechanical reason to
avoid them: `scripts/i18n-preflight.mjs` matches `{{token}}` immediately followed by any
Han/Hiragana/Katakana character, so a counter written straight after a non-`count` token is
reported as an uncleared candidate on every run.

Batch 1 therefore uses the runbook's count-neutral devices for every non-`count` numeric
token, and the results read at least as well as the noun-first form would:

- **Number behind an invariant noun phrase and a colon or bracket.** `config:lqa.lengthLimitValue`
  is 「文字数 {{chars}} / バイト数 {{bytes}}」, not 「{{chars}}文字/{{bytes}}バイト」;
  `config:routing.templateMeta` is 「…最大文字数 {{maxLength}}…」;
  `config:models.confidenceReason.prompt-near-context` is
  「プロンプトのトークン数（約{{tokens}}）が…」.
- **A bare ratio with no noun.** `config:reviewProgressCount` is 「レビュー済み：{{reviewed}}/{{total}}」.
- **A textual token in brackets rather than in front of a particle.** `config:instances.formTitle`
  is 「新規インスタンス（{{base}}）」 rather than 「{{base}}の新規インスタンス」.

`{{count}}` itself is exempt from all of this — its own family handles it — so
「{{count}}件」 is the normal, preferred shape and appears throughout the file.

## Locale-specific traps

- **Katakana or kanji — decide per term and record it.** 「モジュール」 is right (there is
  no natural kanji compound), 「翻訳メモリ」 beats 「トランスレーションメモリ」, and
  「実行」 beats 「ラン」 for _run_. What matters is deciding once, in `terminology/ja.md`,
  rather than per string.
- **「ステージ」 is correct for _stage_** — it is the gaming word for a playable level.
  「段階」 and 「工程」 are exactly the process readings `terminology.md` warns about.
- **"Judge"** takes the evaluative sense (「評価」), never 「裁判官」/「裁く」.
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
  than inventing a second word to keep them apart.

## Surface names settled in batch 1 — repeat these verbatim

A surface's name is written out two or three times, in different namespaces, and the two
keys are never on screen together. These are the renderings batch 1 fixed; a later batch
that names the same surface **copies them exactly** and does not re-decide.

| Surface | Rendering | Fixed by | Also owed by |
| --- | --- | --- | --- |
| Global Config | 「グローバル設定」 | `config:globalConfigTitle` | `sidebar:globalConfig` — English is word-for-word identical in both, so Japanese must be too |
| Translation Memory | 「翻訳メモリ」 | `config:tm.policyTitle`, `config:tm.browserTitle` | `sidebar:translationMemory` |
| Translations (tab) | 「翻訳」 | named in prose by `config:routing.categoriesConfiguredHint` 「カテゴリは翻訳タブで設定します。」 | `strings:tabs.strings` |
| Compare (tab) | 「比較」 | named in prose by `config:routing.tonesHint` 「トーンは比較タブで…」 | `strings:tabs.compare` |
| Backup (tab) | 「バックアップ」 | named in prose by `config:importSnapshotNote` 「バックアップタブから復元できます。」 | `strings:tabs.backup` |
| Orphans (tab) | 「孤立エントリ」 | named in prose by `config:fullReplaceOrphanNotice` 「孤立エントリタブで解決してください。」 | `strings:tabs.orphans`, `orphans:title` |

The word for *tab* is 「タブ」, appended with no particle and no space: 「翻訳タブ」.

**`config:fullReplaceOrphanNotice` says *Relink tab* in English. There is no such tab** —
it is the known stale English name for Orphans, and Japanese ships the Orphans rendering.

## The six register and typography sweeps

Run all six over every batch before handing it to review. All six were clean on batch 1.

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
