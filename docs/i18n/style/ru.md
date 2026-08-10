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

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.5× the English character count**, and prefer the
shorter of two correct options — «Активность» over «История выполнения», «Качество» over
«Контроль качества».

**One recorded exception, so it does not read as a defect.** `strings:tabs.review-source-ai`
ships at **1.75×** — «ИИ-рецензия исходного текста» against "Source AI review" — and that is
correct. `terminology.md` builds _source review_ out of _AI review_ and _source text_ on
purpose, so the two review tabs read as siblings, and the neighbouring
`strings:tabs.review-translation-ai` («ИИ-рецензия переводов») has to match it word for word.
Shortening either one buys a few pixels and breaks a naming rule that costs more. Any future
exception needs the same shape: a named term rule that outranks the budget, written down
here — not a translator's judgement that the label "felt too long to shorten".

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
   `slug`, `type` — module ids, language display names, error text, dates. Skip `count` too:
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
