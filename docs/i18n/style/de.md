# Style guide — German (de)

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**Sie, not du.** This is a professional tool that holds paid API credentials and spends
the user's own provider budget; German business software addresses that user with _Sie_,
and a _du_ localization would read as a consumer app. The English source is
informal-but-professional, and _Sie_ is the German neutral for exactly that band — it is
not a formality upgrade.

**Prefer constructions with no direct address at all.** German UI convention is the
impersonal infinitive for controls and instructions: `sidebar:selectProject` ("Select a
project") is "Projekt auswählen", not "Wählen Sie ein Projekt aus". Reserve _Sie_ for
sentences that genuinely address the user, such as `vault:createDescription` ("You will
need this password to unlock the vault each session") — "Sie benötigen dieses Passwort…".

Button labels are always infinitives: "Speichern", "Löschen", "Abbrechen". Never the
imperative "Speichere".

Whatever you do, never mix _du_ and _Sie_. One slip is visible immediately.

## Casing

German capitalizes **all nouns**. That is orthography, not Title Case, and it applies
regardless of what English does: "Projekt löschen", "Routing-Regeln", "Übersetzungsspeicher".

Do **not** mirror English Title Case, and do **not** lowercase German nouns to imitate
English sentence case — both produce wrong German. `english-review-notes.md` records that
the English Title/sentence split is a per-surface design convention with no meaning outside
English.

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "STATUS", which happens to be identical.

Adjectives derived from language names are lowercase ("deutsch"), the language name itself
is a noun and capitalized ("Deutsch").

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quotation marks are **German low-high: `„…“`**, not `“…”` and not `«…»`. Where English
  quotes a value (`category:deleteConfirmBody_one` — `“{{category}}”`), German writes
  `„{{category}}“`.
- Ellipsis is the single character `…` (U+2026), matching `backup:creating` ("Creating
  backup…") — "Sicherung wird erstellt…".
- Use **ß**, not "ss", where the rule calls for it ("Größe", "außer"). This locale is
  standard German; the Swiss variant that drops ß is a different locale.
- Hyphenate mixed compounds rather than running them together: "Routing-Regel",
  "API-Schlüssel", "KI-Prüfung".
- Em dashes in the source stay em dashes with spaces around them.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. A no-break space before `%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

German runs **10–35% longer** than English, and the worst case is not the sentence but the
**single unbreakable compound**: "Anmeldeinformationen", "Übersetzungsspeicher",
"Qualitätssicherungsprüfungen". A compound that overflows cannot wrap, so it clips.

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

Two rules for those classes:

1. **Never exceed ~1.5× the English character count.**
2. **No single unbroken token longer than about 20 characters.** If the natural compound
   is longer, split it with a hyphen ("KI-Prüfung") or use a two-word form — do not insert
   soft hyphens or any other markup, which would trip the inline-tag checks.

Descriptions, toasts and guide prose are not constrained; put the precision there.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

The German hazard is **article and case before a token**. You cannot write "das {{module}}"
safely, because the value's gender is unknown, and you cannot decline the token. Put a real
noun in front and let it carry the gender and the case:
`logs:translation.failedModuleDisabled` ("the {{module}} module is turned off") becomes
"Das Modul {{module}} ist deaktiviert."

Plurals map one to one onto English `_one` / `_other`.

## Locale-specific traps

- **Do not over-Germanize.** German technical registers use English loans naturally —
  "Backup", "Update", "Token", "Prompt". Coining "Sicherungskopie" where practitioners say
  "Backup" makes the UI harder to read, not more German. `terminology.md` records the
  choice per term; make it once and keep it.
- **"Gate" must not become "Tor".** The quality gate is a process-control checkpoint;
  "Tor", "Pforte" and "Schranke" all read physically.
- **"Stage" is a game level**, not a phase. German "Phase", "Etappe" and "Stufe" are the
  process readings `terminology.md` warns about; use the gaming term.
- **"Judge"** takes the evaluative sense ("bewerten"), never "richten"/"Richter".
- **Genitive chains get long fast.** "Die Einstellungen der Instanz des Moduls" is correct
  and unreadable; prefer a compound or a hyphenated form.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Do not imitate the parentheses; rephrase so one string
  covers every count.
