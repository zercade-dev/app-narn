# Style guide — French (fr)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/fr.md`. This file settles register, casing, punctuation, length and
placeholder handling. French is already partly shipped, so most of what follows records
decisions the existing translation has made; the two places where the shipped file is
inconsistent are called out in the traps section and need fixing, not copying.

## Register

**Vous, not tu.** The shipped French already does this: `sidebar:selectProject` is
"Sélectionnez un projet" and `vault:unlockDescription` is "Saisissez votre mot de
passe…". This is not a formality upgrade over the English — in French professional
software _vous_ **is** the neutral register, and _tu_ would read as markedly casual, a
tone the English source does not have either.

Instructions use the _vous_ imperative ("Sélectionnez", "Saisissez", "Choisissez").
Button labels take the infinitive: `sidebar:create` is "Créer", `sidebar:cancel` is
"Annuler".

Do not use midpoint inclusive forms ("collaborateur·rice"). Where a gendered role noun is
awkward, rephrase around it ("les personnes invitées") rather than introducing typography
the rest of the UI does not use.

## Casing

Sentence case everywhere. French capitalizes only the first word and proper nouns, so
English Title Case (`config:routing.title` "Routing Rules") becomes "Règles de routage".
`english-review-notes.md` records that English Title Case on page titles is a per-surface
design convention carrying no meaning into other languages — do not mirror it.

Language names, months and weekdays are lowercase ("français", "janvier").

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "STATUT", because that header sits beside language names the table
uppercases in code.

## Punctuation and spacing

- **A no-break space (U+00A0) before `:` `;` `!` `?`**, and inside `« »`. This is a
  deliberate house simplification, so know what it costs: the French typographic norm is
  U+00A0 before `:` and inside the guillemets, but the **narrow** no-break space U+202F
  before `;` `!` `?`. U+00A0 is used throughout here because it is what the shipped French
  already uses where it uses anything, it never wraps, and it renders in every font and
  browser — U+202F still falls back to a visible box or a full space in some environments.
  The trade-off is a slightly wide gap before `; ! ?`. Never use a plain space, which can
  wrap and orphan the punctuation onto the next line.
- Quoting a value: `« valeur »` with a no-break space inside each guillemet.
  `english-review-notes.md` records that guillemets were kept in French on purpose when
  the English copy moved to `“ ”`.
- **Typographic apostrophe `’` (U+2019), never `'`.** The shipped file mixes both —
  `sidebar:changeProjectIcon` has "l’icône" while `sidebar:noProjects` has "l'instant".
- Ellipsis is the single character `…` (U+2026), matching `sidebar:searchProjects`
  ("Rechercher des projets…").
- Em dashes in the source stay em dashes with spaces around them.

## Numbers and dates

Decimal comma, and a no-break space as the thousands separator: `1 234,56`. A no-break
space before `%` and before currency symbols.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

French runs roughly **15–25% longer** than English. The space-constrained surfaces are:
sidebar items (`sidebar:translationMemory`, `sidebar:globalConfig`), tab labels
(`strings:tabs.strings`, `strings:tabs` for review-translation-ai), table column headers
(`strings:columns.config`), filter labels (`strings:filters.needsReview`) and bulk-bar
buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.6× the English character count**. French prepositional
chains are the usual cause of overflow — prefer "Mémoire de traduction" to "Mémoire des
traductions enregistrées", and drop the article in chrome where French tolerates it.

The renderings used as examples above are illustrations of the length problem, not
decisions about wording. `terminology.md` defines every domain term, including the surface
names and _translation memory_; `terminology/fr.md` holds the rendering. Decide the
rendering on first use, write its row there, and then follow it here.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Two French-specific hazards:

- **Never elide before a token.** "l'{{module}}" is unsafe because the value's initial
  letter is unknown. Put a real noun in front: the closing clause of
  `logs:translation.failedModuleDisabled` ("…the {{module}} module is turned off"; the
  full string carries three tokens) becomes "le module {{module}} est désactivé".
- **Never let an article agree with a token.** The value's gender is unknown for the same
  reason; the noun you insert carries the gender.

Plurals map one to one onto English `_one` / `_other`, but note that French treats 0 as
singular ("0 ligne sélectionnée"), which the `_one` form must cover.

One exception to that mapping: CLDR gives French a third category, `many`, which fires only
on whole millions (1 000 000, 2 000 000, …). The shipped files omit it and the parity guard
only *reports* the gap rather than failing on it, but a count that can plausibly reach a
million should carry `_many` as well; `LOCALE_PARITY_STRICT=fr` turns the omission into a
failure for anyone completing the locale.

## Locale-specific traps

- **"Modèle" is a live collision, and the shipped file is on the wrong side of it.**
  `sidebar:templateNone` ships as "Aucun modèle" — but "modèle" is also the obvious French
  word for the AI _model_ (`config:routing.labelModelOverride`), and `terminology.md`
  forbids sharing a word between the two. Decide a distinct rendering for _template_,
  record it in `terminology/fr.md`, and fix the shipped strings; do not add more uses of
  "modèle" for templates in the meantime.
- **"Credentials" is left in English in the shipped vault strings** (`vault:statusLabel` —
  "Coffre de credentials"). That is an unresolved decision, not a house style. Settle on a
  French rendering, record it in `terminology/fr.md`, and apply it to all four vault strings
  at once.
- **"Stage" is a false friend.** In French, _un stage_ is an internship. The English
  "Stage details" tab is a game level — never leave "stage" untranslated and never reach
  for "étape" or "phase", which are the process readings `terminology.md` warns about.
- **"Judge"** must take the evaluative sense; the legal reading ("juger", "arbitre") is
  wrong for the AI review.
- **Avoid anglicisms that have settled French equivalents** in this domain — "run" is not
  "un run", "check" is not "checker". `terminology.md` defines both terms; record the
  rendering in `terminology/fr.md`.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Do not imitate the parentheses; rephrase so one string
  covers every count.
