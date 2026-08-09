# Style guide — Spanish (es)

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles the rest: register, casing, punctuation,
length and placeholder handling. Spanish is already partly shipped, so most of what
follows records decisions the existing translation has already made rather than inventing
new ones.

## Register

**Tú, not usted.** The English source is informal-but-professional ("Select a project to
view activity history"), and the shipped Spanish already follows it: `sidebar:selectProject`
is "Selecciona un proyecto" and `vault:unlockDescription` is "Introduce tu contraseña…".
Instructions use the _tú_ imperative — "Selecciona", "Introduce", "Elige" — never
"Seleccione", "Introduzca", "Elija".

Button labels take the bare infinitive where English uses a bare verb: `sidebar:create` is
"Crear", `sidebar:cancel` is "Cancelar". Do not turn a button into a sentence.

Use neutral Latin-American-compatible Spanish: no _vosotros_, no peninsular-only lexis.
Where a plural address is unavoidable, use _ustedes_.

## Casing

Sentence case for every control, label, tab and page title. Spanish does not capitalize
mid-sentence nouns, so English Title Case (`config:templatesTitle` "Project Templates")
becomes "Plantillas de proyecto" — one capital, at the front. `english-review-notes.md`
records that the English Title Case on page titles is a design convention that carries no
meaning into other languages, so do not mirror it.

Language names, months and weekdays are lowercase in Spanish ("español", "enero"), even
where English capitalizes them.

Preserve uppercase only where the English string is uppercase for a layout reason:
`strings:columns.config` is "STATUS" because it sits beside language names the table
uppercases in code, so Spanish writes "ESTADO", not "Estado".

## Punctuation and spacing

- No space before `:` `;` `!` `?` — unlike French.
- Opening `¿` and `¡` are required. `backup:confirmTitle` ("Replace current project
  data?") becomes "¿Reemplazar los datos actuales del proyecto?".
- Quoting a value: use `« »` with no inner spaces, as the shipped
  `category:deleteConfirmBody_one` does. English moved from guillemets to `“ ”`; Spanish keeps
  guillemets, and `english-review-notes.md` records that this was deliberate.
- Ellipsis is the single character `…` (U+2026), matching `glossary:matchTermSelectPlaceholder`
  ("Select a term…"). Never three periods.
- Em dashes in the source (`batch:runCompleted` — "Translation done — …") stay
  em dashes with spaces around them.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. Percentages take no space before `%`.

Dates and times are formatted by the app from the browser locale, not typed by
translators — if you meet something that looks like a date format string, it is not a
translatable string.

## Length discipline

Spanish runs roughly **15–25% longer** than English. The space-constrained surfaces are:
sidebar items (`sidebar:translationMemory`, `sidebar:globalConfig`), tab labels
(`strings:tabs.strings`, `strings:tabs` for review-translation-ai), table column headers
(`strings:columns.config`), filter labels (`strings:filters.needsReview`) and bulk-bar
buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.6× the English character count**, and prefer the
shorter synonym: "Actividad" over "Historial de actividad", "Calidad" over "Control de
calidad". Body text, descriptions and toasts are not constrained — expand there instead.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely, but every token in the English string must appear exactly once in the
translation.

The specific Spanish hazard is the **article before a token**. You cannot write
"el {{module}}" safely, because the value's gender is unknown. Put a real noun in front of
the token and let the article agree with the noun:
`logs:translation.failedModuleDisabled` ("the {{module}} module is turned off") becomes
"el módulo {{module}} está desactivado".

Plurals: Spanish uses the same `_one` / `_other` shape as English, so
`strings:bulk.rowsSelected_one` / `_other` map one to one.

## Locale-specific traps

- **"Modelo" is taken.** It is the AI model (`config:routing.labelModelOverride`). The
  shipped Spanish correctly uses "plantilla" for _template_ (`sidebar:templateNone` — "Sin
  plantilla"); keep it that way and never let "modelo" drift onto templates.
- **Standalone status words carry gender.** `vault:statusLocked` ships as "Bloqueada",
  agreeing with "bóveda". If the rendering chosen for _credential vault_ in
  `terminology.md` ever changes gender, every status word in that namespace changes with
  it — they are adjectives with no visible noun.
- **"Stage" is a game level**, not a phase. Spanish "fase" and "etapa" both read as
  process steps; use the gaming term recorded in `terminology.md`.
- **"Judge"** must take the evaluative sense, not the legal one — "evaluar", never
  "juzgar" in the courtroom reading.
- **Gerund for progress labels.** English "Saving…", "Generating…" are progress states;
  Spanish uses the gerund ("Guardando…", "Generando…"), not the infinitive, which would
  read as a button.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)" or "entry/entries". Do not imitate the parentheses —
  rephrase so one string works for every count ("elementos" with the number in front).
