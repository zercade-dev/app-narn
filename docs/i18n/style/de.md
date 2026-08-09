# Style guide — German (de)

Terminology — _which word_ — is settled in `terminology.md`, including the list of things
that are never translated. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**du, not Sie — a house decision, not the German default.** German business software still
mostly addresses the user with _Sie_, and _Sie_ would be defensible for a tool that holds
paid API credentials and spends the user's own provider budget. We chose _du_ anyway,
because modern developer-tool German has largely settled on it — GitHub, Vercel and Linear
all use _du_ in their German UI — and because _du_ matches the English source's
informal-but-professional register instead of lifting it a notch into business formality.
Like every register call it is all-or-nothing: if it is ever reversed, it is reversed
across every string at once, never per string.

**Prefer constructions with no direct address at all.** The _du_ decision does not change
this: German UI convention is the impersonal infinitive for controls and instructions, so
`sidebar:selectProject` ("Select a project") is "Projekt auswählen" — neither "Wähle ein
Projekt aus" nor "Wählen Sie ein Projekt aus". Reserve _du_ for sentences that genuinely
address the user, such as `vault:createDescription` ("…You will need this password to
unlock the vault each session") — "Du benötigst dieses Passwort…".

Button labels are always infinitives: "Speichern", "Löschen", "Abbrechen". _du_ makes this
rule harder to hold, not easier: it hands you a real imperative — "Speichere", "Lösche",
"Wähle" — that _Sie_ never offered, and that form is wrong on anything clickable. If the
string labels a control, it is an infinitive.

Where a full sentence really does instruct the user, the du-imperative is right, and it is
irregular in a way the _Sie_ form never was: strong verbs **with an e→i/ie stem change**
take that changed stem and drop the final -e — _gib_, not "gebe"; _lies_, not "lese";
_nimm_, not "nehme". `account:mfaDisableHint` ("Enter a current code from your
authenticator app…") is "Gib einen aktuellen Code aus deiner Authenticator-App ein…".

That is the only class that shifts. Verbs that umlaut in the present tense do **not** umlaut
here (_fahr_, not "fähr"; _lauf_, not "läuf"), and every other verb simply drops the -e.

_du_, _dich_, _dir_ and _dein_ are lowercase — see the casing section. And whatever you do,
never mix _du_ and _Sie_, in any string class: labels, errors, toasts and prose share one
voice, and one slip is visible immediately.

## Casing

German capitalizes **all nouns**. That is orthography, not Title Case, and it applies
regardless of what English does: "Projekt löschen", "Routing-Regeln", "Übersetzungsspeicher".

The address pronouns are the counter-example: _du_, _dich_, _dir_, _dein_ and their
inflections are **lowercase** in current orthography — never capitalized as an honorific in
a UI, though sentence-initial capitalization applies as normal ("Du benötigst dieses
Passwort…" in the register section is right for that reason). A **mid-sentence** "Du" or
"Dein" is the tell: it is usually a _Sie_-form reflex, since _Sie_ and _Ihr_ are capitalized
in any position, and it reads as a register slip rather than as politeness.

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
  "API-Schlüssel", "Token-Limit".
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
   is longer, split it with a hyphen ("Backup-Datei") or use a two-word form — do not insert
   soft hyphens or any other markup, which would trip the inline-tag checks.

Descriptions, toasts and guide prose are not constrained; put the precision there.

The renderings used as examples in this file — here and in the casing section — are
illustrations of German word formation, not decisions about wording. `terminology.md`
owns the rendering of every domain term, including the surface names and
_translation memory_ — decide it there on first use, record it, and then follow it here.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

The German hazard is **article and case before a token**. You cannot write "das {{module}}"
safely, because the value's gender is unknown, and you cannot decline the token. Put a real
noun in front and let it carry the gender and the case:
the closing clause of `logs:translation.failedModuleDisabled` ("…the {{module}} module is
turned off"; the full string carries three tokens) becomes "Das Modul {{module}} ist
deaktiviert."

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
- **Drop the possessive rather than translating it.** English marks possession far more
  often than German does, and dropping it is idiom, not a register choice.
  `vault:unlockDescription` ("Enter your password to decrypt module credentials for this
  session") reads best as "Passwort eingeben, um…" — "dein Passwort" is not wrong, just
  noise. Keep _dein_ where the possession is the point of the sentence, as in the
  `account:mfaDisableHint` example in the register section.
- **Genitive chains get long fast.** "Die Einstellungen der Instanz des Moduls" is correct
  and unreadable; prefer a compound or a hyphenated form.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Do not imitate the parentheses; rephrase so one string
  covers every count.
