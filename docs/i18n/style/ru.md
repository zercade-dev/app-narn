# Style guide — Russian (ru)

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**Вы, written lowercase.** The capitalized «Вы» belongs in personal correspondence; in
software it reads as marketing deference. Lowercase «вы» is the standard Russian UI
register and is the right match for the informal-but-professional English source. Never
«ты».

Instructions use the polite plural imperative: `sidebar:selectProject` ("Select a
project") is «Выберите проект»; `vault:unlockDescription` is «Введите пароль…».

Button labels take the infinitive where the English is a bare verb: `sidebar:create` is
«Создать», `sidebar:cancel` is «Отмена» (a noun, which is the settled Russian convention
for that particular button).

Avoid addressing the user at all where the sentence works impersonally — «Требуется
пароль» rather than «Вам потребуется пароль» — but do not mix impersonal and «вы» inside
one dialog.

### Titles, buttons, column headers and placeholders — four shapes

English writes the same words for all four; Russian does not, so **resolve the control
before you translate the string.** The convention below is already shipped across the whole
`config` namespace and every later namespace follows it:

- **Titles, tab labels and section headings are noun phrases.** `config:importCsv` is
  «Импорт CSV», `config:routing.tabImportExport` is «Импорт / Экспорт»,
  `config:saveAsTemplateTitle` is «Шаблон проекта». A dialog title takes the deverbal noun
  for the same reason: `config:models.pickTitle` is «Выбор модели».
- **A confirm dialog is the exception, and takes the infinitive** — it names the action you
  are about to authorize, not a section you are looking at. `config:confirmDeleteTitle` is
  «Удалить проект», `glossary:confirmDeleteTitle` is «Удалить термин»,
  `category:deleteConfirmTitle` is «Удалить категорию?» and `collab:leaveConfirmTitle` is
  «Покинуть проект?». Keep English's question mark where it has one and leave it off where it
  does not — the source is inconsistent about it, and matching per key is what keeps a
  reviewer from "fixing" one of them.
- **Buttons are infinitives** — the rule above, restated here because this is where it
  contrasts: `config:routing.importBtn` and `config:routing.exportBtn` are «Импортировать»
  and «Экспортировать». English's "Import" is one word in both rows of this list; Russian's
  is two different ones.
- **Table column headers are bare nouns, and they keep English's abbreviation** where it has
  one: `config:models.colParameters` ("Params") is «Парам.», `config:models.colQuantization`
  ("Quant") is «Квант.». A header is chrome — the length rule below bites hardest here.
- **Placeholders inside a control are imperative**, not titles. `config:models.select` and
  `config:models.pickTitle` are byte-identical in English ("Select a model") and different
  controls: «Выберите модель» for the placeholder, «Выбор модели» for the dialog title.

A verbal noun («Создание…», «Импортирование…») is a **status**, not a command — use it for
progress text and never for a button.

**A term row fixes the lexeme. It does not fix the shape — and this guide said the opposite
for one round.** A row's `Example:` line exists to show the term *in use*; it is not a
prescription that the cited key must keep that grammatical form. Both authorities apply and
they apply to different things: the row decides **which word**, this section decides **which
shape that word takes in that control**.

The cost of getting it backwards is on screen now. `sidebar:createProjectTitle` and
`backup:createSection` are section titles, so the shape rule gives «Создание проекта» and
«Создание резервной копии» — but both took the infinitive because the _project_ and _backup_
rows quote those keys, and `backup:createSection` («Создать резервную копию») now sits
directly above «Восстановление из резервной копии», one title in each shape. The rows were
fixing «создать» against «открыть новый проект» and «резервная копия» against «бэкап».
Neither was ruling on titles.

So: take the **word** from the row, the **form** from the control. If a row genuinely means to
pin a form, it has to say so in words — a quoted example is not that.

**A word English reuses across controls does not have one Russian rendering, and forcing one
is the error.** "Custom" is the standing example: as an adjective before a noun it is
«пользовательский», agreeing — `config:models.useCustom` ships as `Использовать «{{model}}»
как пользовательскую модель`. As a bare select option it cannot stand alone at all, because
a lone «Свой» or «Пользовательский» is not idiomatic in a Russian option list, so the option
names what it configures: `config:batchGroupingCustom` ("Custom") is «Свой размер», the
option that reveals an entries-per-batch input. Resolve the control, then choose; do not
chase consistency across two controls that are not the same control.

## Casing

Sentence case only. Russian capitalizes the first word and proper nouns; nothing else.
`config:routing.title` ("Routing Rules") becomes «Правила маршрутизации», not «Правила
Маршрутизации». `english-review-notes.md` records that English Title Case on page titles
is a per-surface design convention with no meaning outside English.

Language names, months and weekdays are lowercase («русский», «январь»).

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes «СТАТУС», because that header sits beside language names the table
uppercases in code.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quotation marks are **«ёлочки»** at the outer level, „лапки“ when nested inside them.
  Where English quotes a value (`category:deleteConfirmBody_one` — `“{{category}}”`), Russian
  writes «{{category}}».
- Ellipsis is the single character `…` (U+2026), matching `common:loading` ("Loading…") —
  «Загрузка…».
- Em dash `—` with spaces around it, matching the English source
  (`batch:runCompleted`). Do not substitute a hyphen.
- **Do not write ё** except where its absence creates a genuine ambiguity; that is the
  standard convention in Russian software text.

## Numbers and dates

Decimal comma, and a no-break space as the thousands separator: `1 234,56`. No space
before `%`, matching how the English strings render percentages.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

Russian runs roughly **10–20% longer** than English in characters, and individual words
are markedly longer («маршрутизация», «предупреждение», «учетные данные»), so tight chrome
overflows before the sentence count suggests it will.

### The budget is in characters, not in multiples of English

**This guide used to say "never exceed ~1.5× the English character count", with a list of two
recorded exceptions. That rule was false the day it was written** — an audit of every
constrained-surface key across all 24 namespaces found **27** over 1.5×, in every batch,
including tab labels at 2.50× and a sidebar item at 3.80×. Nothing was wrong with those
strings. The rule was wrong, in two ways, and both are worth understanding before you use the
one below.

**A ratio is the wrong unit when the English is short.** Every one of those 27 was flagged for
having a *short source*, not a long rendering: "Legal" is five characters, so 1.5× is seven
and a half — no correct Russian rendering of it can exist. The ratio measures the wrong thing
at the other end too: `strings:bulk.approveNone` ("No translations to approve in the
selection.") is 44 English characters, so the old 1.5× rule let it run to 66, while
`strings:bulk.approveSelected` ("Approve to memory") is 17 and is one of the genuinely tight
labels in the same bulk bar. Length is a property of the container, and the ratio does not
know what the container is.

**And the five classes are not equally constrained.** Only one of them has a hard, fixed
width: the sidebar is `16rem` (`SIDEBAR_WIDTH` in `components/ui/sidebar.tsx`) and every item
label is wrapped in `truncate`, so overflow ellipsizes. Tab bars, table columns and filter
rows scroll, auto-size or wrap — going long there costs elegance, not correctness.

So: **budgets are absolute character counts, per class.**

| Class | Budget | Kind | Longest shipped |
| --- | --- | --- | --- |
| Sidebar item (`sidebar:globalConfig`, `sidebar:legal`) | **26** | **hard** — fixed 16rem, truncates | 23 |
| Tab label (`strings:tabs.backup`) | 32 | soft | 28 |
| Table column header (`strings:columns.config`) | 22 | soft | 19 |
| Filter label (`strings:filters.needsReview`) | 38 | soft | 34 |
| Bulk-bar control (`strings:bulk.approveSelected`) | 52 | soft | 48 |

**Hard** means fix it: a sidebar item over 26 characters is cut off with an ellipsis in a
container that cannot grow. **Soft** means prefer the shorter of two correct options —
«Активность» over «История выполнения» — but do not distort a term to hit a number, and do
not treat the figure as a failure threshold.

Two honesty notes about those numbers, so you can judge them rather than obey them. They are
anchored on the container where the container is fixed (the sidebar) and on the longest
shipped value plus headroom everywhere else; nobody has measured rendered pixel widths. And
if you need to go past a hard budget, **look at the running app before you decide** — a
measurement beats this table.

**There is deliberately no exception ledger.** The previous one recorded two of twenty-seven
and nobody noticed for four rounds, because a hand-maintained list of per-key exemptions goes
stale silently and invisibly. If a term rule forces a long label — `strings:tabs.review-source-ai`
is «ИИ-рецензия исходного текста» because `terminology.md` builds _source review_ from _AI
review_ + _source text_ and its sibling tab must match word for word — that is the term rule
doing its job, and the budget above already accommodates it. Terms outrank the budget; the
budget exists to stop *avoidable* length.

The renderings used as examples above are illustrations of the length problem, not
decisions about wording. `terminology.md` owns the rendering of every domain term,
including the surface names and _translation memory_ — decide it there on first use,
record it, and then follow it here.

### Surface names already shipped — repeat these verbatim

A surface is named in one namespace and owned by another, so these four are written by
different translators at different times. They are settled; copy them, do not re-render
them:

| Surface | Russian | Owning key | Repeated at |
| --- | --- | --- | --- |
| Compare | «Сравнение» | `strings:tabs.compare` | `config:routing.tonesHint` |
| Translations | «Переводы» | `strings:tabs.strings` | `config:routing.categoriesConfiguredHint` |
| Backup | «Резервные копии» | `strings:tabs.backup` | `config:importSnapshotNote` |
| Orphans | «Сироты» | `orphans:title` | `config:fullReplaceOrphanNotice` |
| Sharing | «Доступ» | `strings:tabs.sharing` | `collab:sharing.pageTitle` |
| Global Config | «Глобальная конфигурация» | `sidebar:globalConfig` | `config:globalConfigTitle`, and in prose at `stage-details:chatOpenConfig`, `colorText:assistant.openConfig` |
| Legal | «Правовая информация» | `sidebar:legal` | `legal:title`, which expands to «Правовая информация и политики» |

### Open, not settled: the three `legal` link labels

`legal:terms`, `legal:cookies` and `legal:subprocessors` are **link labels pointing at
published pages**, so they are not a translator's decision. Whatever the published Russian
page calls itself, the label must say — a link whose text differs from the title of the page
it opens is a defect no locale review can catch, because the page is not in this repo. The
three ship as «Условия использования», «Политика о файлах cookie» and «Субобработчики»
respectively, each of which is defensible on its own:

- **terms** — «Условия использования» over «Пользовательское соглашение»; both are standard,
  and they are not synonyms in Russian legal practice.
- **cookies** — «Политика о файлах cookie» (24 characters, 1.85×). Note that *cookie*
  qualifies «файлы» in Russian and never stands alone, so the shorter «…использования cookie»
  is not an option. **The length here is a guard question, not a preference:**
  `lengthOffenders` fails anything over `MAX_LENGTH_RATIO = 2.5`, and all three fuller
  standard forms breach it — «Политика использования файлов cookie» 2.8×, «Политика в
  отношении файлов cookie» 2.6×, «Политика использования cookie-файлов» 2.8×. So if the
  published page's own title is one of those, this label cannot simply follow it on a
  translator's say-so. **A per-key exemption mechanism now exists** — `LENGTH_EXEMPTIONS` in
  `scripts/locale-rules.mjs`, keyed locale → namespace → key → the reason, which
  `lengthOffenders` consults and which throws at module load if a reason is blank. It is
  empty today, deliberately: an exemption is *granted*, not helped oneself to. Escalate for
  one rather than shortening the rendering.
- **subprocessors** — «Субобработчики», the GDPR term of art, over the calque
  «субпроцессоры», which reads as CPUs.

**Reconcile all three against the published pages before treating them as settled**, and if a
page's own title differs, change the label, not the page.

**Sharing is the one to read twice.** «Доступ» is short for a reason the wording does not
show: «Совместный доступ» is the fuller and more obvious rendering, and at seventeen
characters against "Sharing"'s seven it does not fit the tab budget above. The tab is the
authority, so the `collab` page title and everything else naming that surface takes «Доступ»
too — a page title that expands to «Совместный доступ» while the tab says «Доступ» is exactly
the drift `terminology.md`'s surface-name rule exists to stop, and the two are never on
screen together to make it visible.

The punctuation pattern is the same in all four: «ёлочки» around the tab name at the top
level of the string, and the sentence's full stop **outside** the closing guillemet — «…на
вкладке «Сравнение».» The guillemets in the table above are citation marks; the ones in the
shipped string are part of it.

## Matching a sibling namespace — match the English, not the other locale file

Two namespaces often name the same thing, and the surface-name rule tells you to keep them in
step. When you do that, **read the sibling's English, not its Russian.** Copying the other
locale file's rendering imports whatever the English there says — including words your own
key's English does not have.

The worked example, caught in review: `config:lqa.checks.tag-equality.name` is "**Inline** tag
equality" while `quality:checkLabels.tag-equality` is the bare "Tag equality". Matching the
sibling by rendering put «встроенных» into a string whose own source has no such word. The
correct pair is «Идентичность встроенных тегов» in `config` and «Идентичность тегов» in
`quality` — same term, each faithful to its own key.

This is a distinct error class from ordinary drift, and it hides behind a *virtue*: the file
looks more consistent, not less. When two sibling keys disagree in English, that disagreement
is either deliberate or an English defect — carry it across, and if you think it is a defect,
raise it as one rather than silently harmonizing in one language only.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

The Russian hazard is **case government**: a token cannot be declined, so it must always
land in a position where the nominative is correct. Put a real noun beside it and let the
noun take the case: the closing clause of `logs:translation.failedModuleDisabled` ("…the
{{module}} module is turned off"; the full string carries three tokens) becomes «Модуль
{{module}} отключен» — the noun «модуль» inflects, the token never does.

The same rule covers counted nouns: never build «{{count}} записи» by guessing — use the
plural keys below.

**Only `{{count}}` triggers plural selection. Every other numeric token is a plural trigger
i18next cannot see.** This is the one placeholder rule that bites in any language with
numeral agreement, and its failure mode is silent: the string is grammatical for some values
of the token and wrong for others, so it passes every guard and every spot-check that
happens to use a number ending in 1. `{{total}}`, `{{maxLength}}`, `{{tokens}}`,
`{{entryCount}}` and their kind get **no** CLDR category — there is no plural key to write,
because i18next never looks for one.

So a numeric token that is not `count` must sit in a frame that is **grammatical for every
value it can take**. The devices, in order of preference:

- **Number after an invariant noun phrase, behind a colon or in brackets** — the same
  count-neutral device as above. `config:models` (confidenceReason.prompt-near-context) ships
  «Промпт (токенов: ~{{tokens}}) приближается…»; `config:models`
  (confidenceReason.batch-exceeds-reliable) ships «Число записей ({{entryCount}}) превышает…».
- **An abbreviation that does not decline** — `config:routing.templateMeta` ships «не более
  {{maxLength}} симв.», where the full «символов» would be right only for some values.
- **A bare ratio or fraction with no noun at all** — `config:models.footprintInspecting` is
  «Измерение {{done}}/{{total}}: {{model}}…».

Never «{{total}} записи» or «осталось {{n}} дня». If you cannot find a frame, say so rather
than shipping a string that is right one time in three.

**One recorded case where the count-neutral frame costs something.**
`logs:translation.queued` and `logs:sourceReview.done` each display `{{total}}` /
`{{findings}}` while their plural family selects on `count`, and the log-presentation
registry sets both members of each pair from the same value — so inflecting after the token
*would* have been correct in those two strings. They are count-neutral anyway, deliberately:
the guarantee lives in a different file from the string, so a later change there would break
the grammar silently and nothing would fail. The cost is real and is the point of writing it
down — those two log lines lose a singular/plural distinction English has. Do not "restore"
it without re-reading the registry and deciding to depend on it.

**And do not reach for the obvious alternative — it is blocked by the guard.** Interpolating
`{{count}}` instead, so the displayed number and the selected number are one variable, fails
placeholder integrity: the guard compares the **multiset** of tokens against English, and
English writes `{{total}}` / `{{findings}}`. Dropping the English token and adding a new one
is two violations, not a clever fix. The count-neutral wording was therefore forced, not
preferred — which is the whole reason it is recorded here rather than left to be
rediscovered.

### Checking your own work for numeral agreement

Two passes, because they catch different mistakes. Scan every string containing a `{{token}}`
followed by a Cyrillic word:

1. **Skip by token name first.** A placeholder that cannot hold a number cannot force
   agreement, whatever follows it. In this app that is `module`, `instance`, `language`,
   `languages`, `lang`, `name`, `message`, `date`, `verdict`, `headers`, `model`, `keys`,
   `slug`, `type`, `focus`, `field`, `why`, `label`, `filename`, `id`, `time` and `passRate` —
   module ids, language display names, field labels, error text, dates. This is the full list
   measured over all 24 namespaces: with exactly these, the detector has **zero** surviving
   false positives across 187 token-plus-Cyrillic-word occurrences. Skip `count` too:
   it is the one token that *does* get CLDR selection, so its family already handles it.
2. **Then skip by word.** What is left fires on the next Cyrillic word, which is often not a
   noun at all. Safe: prepositions and particles — «не» above all, which is invariant and can
   never agree with anything; invariant abbreviations («симв.», «байт»); and impersonal
   participles and short participles used as statuses («вычитано», «отключен»), which are
   never counted nouns and which the placeholder rule above deliberately puts beside a token.

Whatever survives both passes is a genuine numeric token with a Russian word after it —
check it by hand at 1, 2 and 5. Run the token pass first: it is precise, where the word list
exempts a word after *every* token and blunts the check if it grows.

**Russian supplies all four plural categories — that is settled, not a question to raise.**
Russian selects between _one_, _few_, _many_ and _other_, while the English source ships
only `_one` and `_other`, so a grammatically correct Russian file carries `_few` and `_many`
variants that have no English counterpart. **Those keys are required, not merely
tolerated.** The key-parity guard compares plural families by their base key, not by their
exact suffixes, so the extra Russian forms are the correct shape and need no permission;
conversely a suffix that is neither one of Russian's four categories nor one of the two
exceptions below is a hard failure — it can never resolve.

**The two exceptions, so you do not delete a legal key.** `_zero` is legal in *every*
locale, Russian included, whatever its CLDR categories: i18next appends an explicit
`key_zero` lookup whenever the count is 0, independent of the plural rules, and the guard
exempts the suffix for exactly that reason. English already ships one —
`strings:bulk.removeCategoryApply_zero` — so you will meet it, and Russian may keep or add
a `_zero` form where "0 of them" wants its own wording. The legacy i18next-v3 `_plural`
suffix is the other: the guard reports it rather than failing it, but it never resolves
under the v4 JSON format, so treat it as dead weight — never add one, and give the family
Russian's four categories instead.

**Settled convention: do not add a plural family over an English plain key.** The guard
permits it — a locale may turn one English `{{count}}` string into four, provided the plain
key survives — and the temptation is real, because Russian would often be richer for it. No
shipped locale does it: across all **41** families in each of the four locales, **zero** were added this
way, and every count English writes as one string is handled with the count-neutral device
above («Осиротевших записей: {{count}}», «Ключей в хранилище: {{count}}»). Follow that. If the
project ever wants added families, it is a decision to take **once, for every locale**, not
per namespace — half a language done each way is worse than either. (This convention is
project-wide rather than Russian; it lives here because Russian is the first locale with the
categories to make it tempting.)

**When English's family is `bare + _other`, its `_other` dictates the tokens of every Russian
form — including the singular.** This is the rule most likely to make a correct Russian file
look wrong, and nothing about it is visible from the locale files. The mechanism: your
`foo_one` has no English counterpart, so `resolveReference` falls back to `en:foo_other` and
then to `en:foo`, and the placeholder check compares your string's tokens against **whichever
it landed on**. English's *singular* here is the bare key, and the guard never reaches it once
`_other` exists.

The worked example, `vault:retrySuccess`. English's bare key is "Unlocked — your action went
through." with **no token**; its `_other` is "Unlocked — all **{{count}}** actions went
through." So Russian's `_one` is checked against the `_other`, and a true singular —
«Разблокировано — ваше действие выполнено.» — **fails**, for a missing `{{count}}` that
English's own singular does not have either. **What the constraint forces is the token, not sameness.** Put `{{count}}` in every category
and then inflect them normally, exactly as you would any other family:
«Разблокировано — выполнено {{count}} действие / действия / действий.» Four identical
count-neutral strings would also pass the guard, and that is the wrong lesson — it throws away
the CLDR machinery for no guard reason and reads worst at `count: 1`, which is the commonest
case. Make the categories differ.

`vault:retryFailed` is the exact mirror: English's `_other` carries **no** token, so no Russian
form may add one, and all four are worded without a number. **The full list, so nobody rediscovers it.** This is a mechanical property of the English
source, not a translation finding — twelve families are shaped `bare + _other`, and every
locale meets all twelve:

`console:unreadErrors` · `console:membersNotShown` · `logs:translation.queued` ·
`logs:translation.failedNoRoute` · `logs:translation.failedModuleDisabled` ·
`logs:translation.failedModuleNotFound` · `logs:sourceReview.done` · `logs:orphan.detected` ·
`vault:keysCount` · `vault:remainingAttemptsHint` · `vault:retrySuccess` · `vault:retryFailed`

Eleven of the twelve carry identical token sets in the bare key and in `_other`, so the
constraint binds without ever being visible. **`vault:retrySuccess` is the only token-asymmetric one** —
the bare key has no token and `_other` has `{{count}}` — and `vault:retryFailed` is the case
where neither has one, so no Russian form may add a number at all. Check English's `_other`,
not English's bare key, before writing your singular.

**Write the bare key count-neutral too.** Once all four categories exist it is unreachable, so
its only remaining job is to be grammatical if something ever does reach it —
`vault:keysCount` ships «Ключей в хранилище: {{count}}» beside its four inflected siblings.

**A category you leave out does not fall back to `_other`.** i18next picks the suffix for
the count first and then walks the *language* chain, so a file carrying only `_one` and
`_other` renders the **English** string at the counts Russian would have sent to `_few` and
`_many` — measured with `fallbackLng: 'en'`, counts 3 and 7 come back as "3 entries" and "7
entries" while 21 correctly takes the Russian `_one`. The one thing that rescues a gap is a
bare `key` sibling in the same locale, which i18next does try, so the locale's own text
still renders — ungrammatically, but in Russian. **That is not an escape hatch you may
reach for:** where English carries only `key_one`/`key_other`, adding a bare `key` to the
Russian family is reported as an `extra` key and fails the diff. The fix for a category you
find hard to word is the category, never a bare key that bypasses plural selection
everywhere. (The reverse — adding a *family* where English has a plain `{{count}}` key — is
allowed, provided you keep the plain key too.) The guard therefore already fails, without
being asked, on exactly the families that have no bare sibling: `LOCALE_PARITY_STRICT=ru` is
not what makes a missing `_few` or `_many` an error. What it adds is the bare-sibling cases,
holding the locale to its language's complete category set, which is why it is the setting
to run the backfill under.

## Locale-specific traps

- **Case endings mean a domain term appears inflected everywhere.** «проект» will show up
  as «проекта», «проекту», «проектом». That is expected and correct; `terminology.md`
  records the nominative citation form, and consistency means the same _lexeme_, not the
  same letters.
- **"Judge"** must take the evaluative sense («оценить», «оценка»), never «судья»/«судить»,
  which is the courtroom reading.
- **"Gate"** is a process checkpoint, not a physical gate — «ворота» and «шлюз» are both
  wrong.
- **"Stage" is a game level**, not a phase: «этап» and «стадия» are exactly the process
  readings `terminology.md` warns about.
- **Loanword or native word — pick once.** «дифф» vs «различия», «кеш» vs «кэш», «токен» vs
  «маркер». Both registers exist in Russian dev speech; alternating between them inside one
  namespace is the defect. (This is a register choice for words `terminology.md` does not
  cover, **not** a licence to re-open a settled term. Three are settled and closed: _run_ is
  «прогон» — «запуск» is unavailable, it is needed for the verb _start_; _backup_ is
  «резервная копия», not «бэкап»; _prompt_ is «промпт» — «запрос» is unavailable, it is
  already the HTTP request and the search query.)
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms at
  all where English writes "entr(ies)". Those cannot be fixed with plural keys — rephrase
  so one Russian string covers every count, typically by putting the number in front of an
  invariant noun phrase.
