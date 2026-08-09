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
are markedly longer («маршрутизация», «предупреждение», «учётные данные»), so tight chrome
overflows before the sentence count suggests it will.

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.5× the English character count**, and prefer the
shorter of two correct options — «Активность» over «История выполнения», «Качество» over
«Контроль качества».

The renderings used as examples above are illustrations of the length problem, not
decisions about wording. `terminology.md` owns the rendering of every domain term,
including the surface names and _translation memory_ — decide it there on first use,
record it, and then follow it here.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

The Russian hazard is **case government**: a token cannot be declined, so it must always
land in a position where the nominative is correct. Put a real noun beside it and let the
noun take the case: the closing clause of `logs:translation.failedModuleDisabled` ("…the
{{module}} module is turned off"; the full string carries three tokens) becomes «Модуль
{{module}} отключён» — the noun «модуль» inflects, the token never does.

The same rule covers counted nouns: never build «{{count}} записи» by guessing — use the
plural keys below.

**Plural forms need attention before the backfill.** Russian selects between _one_, _few_,
_many_ and _other_, but the English source ships only `_one` and `_other`. A grammatically
correct Russian file therefore needs `_few` and `_many` variants that have no English
counterpart. **Those keys are expected, not merely tolerated.** The key-parity guard
compares plural families by their base key, not by their exact suffixes, so the extra
Russian forms are the correct shape and need no permission; conversely a suffix that is not
one of Russian's four categories is a hard failure. Supply all four — do not ship the
`_other` form for 2–4, and do not drop the extra forms. `LOCALE_PARITY_STRICT=ru` promotes
a missing category from a report to a failure, and is the setting to run the backfill
under.

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
- **Loanword or native word — pick once.** «бэкап» vs «резервная копия», «раннер» vs
  «запуск», «промпт» vs «запрос». Both registers exist in Russian dev speech; alternating
  between them inside one namespace is the defect.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms at
  all where English writes "entr(ies)". Those cannot be fixed with plural keys — rephrase
  so one Russian string covers every count, typically by putting the number in front of an
  invariant noun phrase.
