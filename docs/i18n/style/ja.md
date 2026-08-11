# Style guide — Japanese (ja)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/ja.md`. This file settles register, casing, punctuation, length and
placeholder handling.

**Every key cited below is a key this locale has actually translated.** Batch 1 shipped
`config` only, so every example is a `config` key with its shipped value. That constraint is
deliberate and binds later batches too: **do not prescribe a rendering for a key in a
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
table header in `strings` ("STATUS") shouts for a layout reason, and that a language without
case should simply translate it in the ordinary way. **Batch 2 owns that rendering** — this
file does not pre-decide it.

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
  「文字数：{{chars}}／バイト数：{{bytes}}」. Use the full-width 「／」 to separate two such
  pairs, not a spaced ASCII slash.
- **Four deliberate space exceptions in batch 1**, and no others — the count is checkable:
  `grep -c ' '` over the shipped values returns exactly these four keys.
  1. `config:pseudoTestHelpLink` 「クリックしてガイドを読む →」 — the space before the arrow is
     symbol layout copied from English, not word spacing.
  2. `config:routing.selectPlaceholder` 「— 選択 —」 — same, around an em-dash pair.
  3. `config:lqa.forbiddenPlaceholder` 「用語1, 用語2」 — a **half-width comma and space**,
     because the string is an example of what the user types into a comma-separated field;
     、 there would teach the wrong separator.
  4. `config:lqa.checks.double-words.description` — the quoted English example
     「the the」 keeps its own space, because a doubled word with the space removed is no
     longer an example of the thing the check finds.
- Ellipsis is the single character `…` (U+2026) wherever the English source has it, as a UI
  affordance: `config:importing` ("Importing…") is 「インポート中…」.
- Use 中黒 「・」 to join loanword compounds only where the compound is genuinely ambiguous
  without it; otherwise run them together. Batch 1 needed it nowhere.
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
it hardest in the six space-constrained classes tabulated below.

**Do not use the English character count as a ceiling.** That rule was in this file and is
now deleted, on the runbook's own evidence: an audit of every constrained-surface key across
all 24 namespaces found 27 renderings over 1.5x their English, and nothing was wrong with any
of them — a ratio measures the wrong thing, because a short English source denies slack a
loose control could afford. It also contradicted the absolute budgets two paragraphs down in
this same file. **The budgets below are the only length rule here.**

Japanese wraps at almost any character, so long body text is not a layout hazard.

`terminology.md` defines every domain term; `terminology/ja.md` holds this locale's
rendering. Decide the rendering on first use, write its row there, and then follow it here.

### The six per-class budgets — absolute character counts, never a multiple of English

Counted in **rendered Japanese characters** — a full-width character is one, and a
`{{count}}`-shaped placeholder counts as the digits it will actually show (assume 1–3), not
as its source length. That is what the container has to fit.

| Class | Anchor key | Kind | Budget | Basis |
| --- | --- | --- | --- | --- |
| Sidebar item | `sidebar:globalConfig`, `sidebar:legal` | **hard** — fixed `16rem`, `truncate` | **10** | provisional: 16rem = 256px, less the icon, gap and both paddings, leaves roughly 170px; a full-width character at the sidebar's font size is ~14px |
| Main tab label | `strings:tabs.backup` | soft | **8** | provisional |
| In-panel sub-tab label | `config:routing.tabRules` | soft | **12** | **measured** on batch 1's three routing sub-tabs: `config:routing.tabRules` 「ルール（{{count}}）」 renders at 7, `config:routing.tabTemplates` 「テンプレート（{{count}}）」 at 9, `config:routing.tabImportExport` 「インポート／エクスポート」 at 12. They sit in a scrolling row inside the routing panel, a different container from the main tab bar |
| Table column header | `strings:columns.config` | soft | **7** | **measured** on batch 1's twelve `config:models.col*` headers: the longest shipped are 「コンテキスト」, 「プロセッサー」 and 「パラメーター」 at 6, so 7 leaves one character of headroom |
| Filter label | `strings:filters.needsReview` | soft | **8** | provisional |
| Bulk-bar control | `strings:bulk.approveSelected` | soft | **12** | provisional |

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, and never distort a term to
hit the number. A term rule outranks the budget: `config:models.colProcessor` is
「プロセッサー」 and not the shorter 「プロセッサ」 because the long-vowel rule above says so.

**The four provisional rows are reasoned from the container, not measured from shipped
Japanese, because their anchor keys live in namespaces batch 1 did not translate. The
whole-language sweep replaces them with measured numbers — that is a deliverable, not a
note.** The in-panel sub-tab row is the worked example of why: the 8-character tab budget
was written as if it covered every tab-shaped control, and batch 1's own
`config:routing.tabImportExport` renders at 12. That is not a defect in the string — the
sub-tabs sit in a different, scrolling container — but it *is* a defect in a budget stated
without knowing which container it belonged to, and it means **an 8 is not evidence about
the main tab labels either** until batch 2 measures them.

Japanese runs ~0.55x English over batch 1, so length pressure in this language runs the
opposite way from every locale shipped before it, and the guard's own 2.5x ratio cap is not a
live risk in either direction. **That is not the same as "nothing came near a budget"** — an
earlier version of this file said so and was wrong, by the sub-tab row above.

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
| a genuinely mixed or unknown selection | **件** | `config:routing.nSelected` 「{{count}}件を選択中」 — one key rendering over both categories and tones, so no object-specific counter is available. This is the **only** licensed use of 件 as a fallback; a key that counts one known class must take that class's counter. |

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
  is 「文字数：{{chars}}／バイト数：{{bytes}}」, and not the counter-after-token draft it replaced;
  `config:routing.templateMeta` carries 「最大文字数：{{maxLength}}」;
  `config:models.confidenceReason.prompt-near-context` opens
  「プロンプトのトークン数（約{{tokens}}）」.
- **A bare ratio with no noun.** `config:reviewProgressCount` is 「レビュー済み：{{reviewed}}/{{total}}」.
- **A textual token in brackets rather than in front of a particle.** `config:instances.formTitle`
  is 「新規インスタンス（{{base}}）」 rather than putting the token in front of a particle.

`{{count}}` itself is exempt from all of this — its own family handles it — so
「{{count}}件」 is the normal, preferred shape and appears throughout the file.

## Locale-specific traps

- **Katakana or kanji — decide per term and record it.** 「モジュール」 is right (there is
  no natural kanji compound), 「翻訳メモリ」 beats the katakana transliteration, and
  「実行」 beats *ran* for _run_. What matters is deciding once, in `terminology/ja.md`,
  rather than per string.
- **_Stage_ takes the gaming reading, not the process one** — a playable level. The two obvious
  kanji compounds — *dankai*, *kōtei* — are exactly the process readings `terminology.md` warns about, and it is the single
  most likely mistranslation in the app. Batch 6 owns the rendering and records it in
  `terminology/ja.md`; this file only rules out the wrong sense.
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
| Compare (tab) | 「比較」 | named in prose by `config:routing.tonesHint` 「トーンは比較タブでエントリごとに設定します。」 | `strings:tabs.compare` |
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
