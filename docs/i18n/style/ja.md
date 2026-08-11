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
- Ellipsis is the single character `…` (U+2026) wherever the English source has it, as a UI
  affordance: `common:loading` ("Loading…") is 「読み込み中…」.
- Use 中黒 「・」 to join loanword compounds (「アクセス・トークン」) only where the compound
  is genuinely ambiguous without it; otherwise run them together.
- Long-vowel marks follow the modern convention: 「サーバー」「ユーザー」「フォルダー」 with
  the trailing ー, not the older truncated forms.

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
duplicate.

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
