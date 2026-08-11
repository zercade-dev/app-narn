# Style guide — Brazilian Portuguese (pt-br)

This locale is **Brazilian** Portuguese, not European Portuguese. Where the two diverge,
Brazilian wins every time — see the traps section for the specific word list.

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/pt-br.md`. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**Você**, always. Never _tu_, never _o senhor / a senhora_, and never mesoclisis
("far-se-á") — all three read as either regional or bureaucratic, and the English source
is informal-but-professional.

Two verb forms split by control type, which is the Brazilian software convention:

- **Button labels take the infinitive**: `sidebar:create` is "Criar", `sidebar:cancel` is
  "Cancelar", `config:deleteProject` is "Excluir projeto".
- **Instructions and sentences take the third-person imperative**: `sidebar:selectProject`
  ("Select a project") is "Selecione um projeto"; `vault:unlockDescription` is "Digite sua
  senha…".

Progress states use the gerund: `backup:creating` ("Creating backup…") is "Criando
backup…".

## Casing

Sentence case for every control, label, tab and page title. Portuguese capitalizes only
the first word and proper nouns, so `config:templatesTitle` ("Project Templates") becomes
"Modelos de projeto" — one capital. `english-review-notes.md` records that the English
Title Case on page titles is a per-surface design convention with no meaning outside
English, so do not mirror it.

Language names, months and weekdays are lowercase ("português", "janeiro").

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "STATUS", which happens to be identical.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”`, matching the English source after its review. Guillemets are a
  European Portuguese habit — do not use them here.
- Ellipsis is the single character `…` (U+2026), matching `sidebar:searchProjects`
  ("Search projects…") — "Pesquisar projetos…".
- Follow the current orthographic agreement: no trema ("linguiça"), "ideia" not "idéia",
  and no accent on "voo" or "leem".
- Em dashes in the source stay em dashes with spaces around them.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. No space before `%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

Brazilian Portuguese runs roughly **15–30% longer** than English, the widest expansion of
the Romance set, because of prepositional chains and longer verb forms.

The space-constrained surfaces are sidebar items (`sidebar:translationMemory`,
`sidebar:globalConfig`), tab labels (`strings:tabs.strings`, `strings:tabs` for
review-translation-ai), table column headers (`strings:columns.config`), filter labels
(`strings:filters.needsReview`) and bulk-bar buttons (`strings:bulk.approveSelected`).

For those classes, **never exceed ~1.6× the English character count**. Drop the article
("Memória de tradução", not "A memória de traduções") and prefer the shorter verb
("Excluir" over "Remover permanentemente").

The renderings used as examples above are illustrations of the length problem, not
decisions about wording. `terminology.md` defines every domain term, including the surface
names and _translation memory_; `terminology/pt-br.md` holds the rendering. Decide the
rendering on first use, write its row there, and then follow it here.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

The Brazilian hazard is **article and contraction before a token**. "o {{module}}" is
unsafe (unknown gender) and "do {{module}}" doubly so (the contraction bakes the article
in). Put a real noun in front and let it carry both:
the closing clause of `logs:translation.failedModuleDisabled` ("…the {{module}} module is
turned off"; the full string carries three tokens) becomes "o módulo {{module}} está
desativado".

Plurals map one to one onto English `_one` / `_other`, with one exception: CLDR gives
Portuguese a third category, `many`, which fires only on whole millions (1 000 000,
2 000 000, …). The shipped files omit it and the parity guard only *reports* the gap rather
than failing on it, but a count that can plausibly reach a million should carry `_many` as
well; `LOCALE_PARITY_STRICT=pt-br` turns the omission into a failure for anyone completing
the locale.

## Locale-specific traps

- **Brazilian vocabulary, not European.** Use "arquivo" (not _ficheiro_), "tela" (not
  _ecrã_), "usuário" (not _utilizador_), "senha" (not _palavra-passe_), "excluir" (not
  _eliminar_), "salvar" (not _guardar_), "compartilhar" (not _partilhar_), "time" or
  "equipe" (not _equipa_), "cadastrar" for sign-up flows. A translation that mixes the two
  varieties is more jarring than one that is merely awkward.
- **"Fase" is the _right_ word here, unusually.** `terminology.md` warns every language
  away from the process reading of "stage" — but Brazilian gaming genuinely calls a
  playable level a _fase_. Use it for `stage-details:title` and its siblings, and do not
  let that leak into any other string where "stage" would mean a step.
- **"Modelo" is taken by the AI model** (`config:routing.labelModelOverride`). It is also
  the natural Portuguese word for _template_ (`config:templatesTitle`), and `terminology.md`
  fixes the direction of that collision: the rendering of _model_ stays where it is, and it
  is the rendering of _template_ that has to move. Choose a different word for template,
  record it in `terminology/pt-br.md`, and never let "modelo" drift onto templates.
- **"Judge"** takes the evaluative sense ("avaliar"), never "julgar"/"juiz".
- **Standalone status words carry gender.** `vault:statusLocked` ("Locked") has no visible
  noun and must agree with whatever `terminology/pt-br.md` records for _credential vault_.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Do not imitate the parentheses; rephrase so one string
  covers every count.
