# Style guide — Italian (it)

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**Tu, not Lei.** Italian software localization moved off _Lei_ years ago, and _tu_ is what
the informal-but-professional English source calls for. Instructions use the second-person
singular imperative: `sidebar:selectProject` ("Select a project") is "Seleziona un
progetto", not "Selezioni un progetto" and not the impersonal "Selezionare un progetto".

Button labels take the same imperative, which for Italian is also the shortest form:
`sidebar:create` is "Crea", `sidebar:cancel` is "Annulla", `strings:bulk.apply` is
"Applica".

Progress states are the gerund with "in corso" where the English is a bare present
participle: `backup:restoring` ("Restoring…") is "Ripristino in corso…", not "Ripristinando…".

## Casing

Sentence case for every control, label, tab and page title. Italian capitalizes only the
first word and proper nouns, so `config:routing.title` ("Routing Rules") becomes "Regole di
routing". `english-review-notes.md` records that English Title Case on page titles is a
per-surface design convention with no meaning outside English — do not mirror it.

Language names, months and weekdays are lowercase ("italiano", "gennaio").

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "STATO", because that header sits beside language names the table
uppercases in code.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”` (U+201C / U+201D), matching the English source after its review.
  Reserve `«…»` for reported speech, which this UI does not contain.
- Ellipsis is the single character `…` (U+2026), matching `glossary:generateRunning`
  ("Generating…") — "Generazione in corso…".
- Write accented vowels with real accented characters — "è", "perché", "città" — never
  "e'" or "perche'". Distinguish "è" (verb) from "e" (conjunction); this is the most
  common Italian typing error in UI strings.
- Em dashes in the source stay em dashes with spaces around them.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. A space before `%` is optional; use no space,
matching the English rendering.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

Italian runs roughly **10–20% longer** than English, mostly through prepositional chains
("di", "della", "per il").

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.5× the English character count**, and drop the
article where Italian chrome tolerates it: "Memoria di traduzione", not "La memoria delle
traduzioni". Body text and descriptions are unconstrained.

The renderings used as examples above are illustrations of the length problem, not
decisions about wording. `terminology.md` owns the rendering of every domain term,
including the surface names and _translation memory_ — decide it there on first use,
record it, and then follow it here.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Two Italian-specific hazards:

- **Never elide before a token.** "l'{{module}}" is unsafe because the value's initial
  letter is unknown, and neither is its gender. Put a real noun in front:
  the closing clause of `logs:translation.failedModuleDisabled` ("…the {{module}} module
  is turned off"; the full string carries three tokens) becomes "il modulo {{module}} è
  disattivato".
- **Never let an article or a past participle agree with a token** — the inserted noun
  carries the agreement.

Plurals map one to one onto English `_one` / `_other`, with one exception: CLDR gives
Italian a third category, `many`, which fires only on whole millions (1 000 000, 2 000 000,
…). The shipped files omit it and the parity guard only *reports* the gap rather than
failing on it, but a count that can plausibly reach a million should carry `_many` as well;
`LOCALE_PARITY_STRICT=it` turns the omission into a failure for anyone completing the
locale.

## Locale-specific traps

- **"Stage" is a false friend, and a bad one.** In Italian, _uno stage_ is an internship.
  The "Stage details" tab is about a playable game level; never leave "stage" untranslated
  and never use "fase" or "tappa", which are the process readings `terminology.md` warns
  about.
- **"Modello" is taken by the AI model** (`config:routing.labelModelOverride`). It is also
  the obvious Italian word for _template_ (`config:templatesTitle`). Reserve "modello" for
  the model, choose something else for template, and record it in `terminology.md`.
- **"Libreria" / "supporto" / "eventualmente"** are the classic calque traps if English
  prose creeps in; none of them mean what the English cognate means.
- **"Judge"** takes the evaluative sense ("valutare"), never "giudicare" in the courtroom
  reading or "giudice".
- **Standalone status words carry gender.** `vault:statusLocked` ("Locked") has no visible
  noun; it must agree with whatever `terminology.md` fixes for _credential vault_. Change
  that noun's gender and every status word in the namespace changes with it.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Do not imitate the parentheses; rephrase so one string
  covers every count.
